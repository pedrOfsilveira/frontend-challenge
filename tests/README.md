# Testes e auditoria

Os resultados da revisão entregue foram validados no commit `347e855`: Vitest 47/47; Playwright completo (chromium-desktop + chromium-mobile, sem atualizar baselines): 141 aprovados, 5 ignorados por projeto, 0 falhas em 6,5 min no commit `347e855`; 8 aprovados como falha esperada (`test.fail`) documentam pendências de acessibilidade W2B-R1/R3/R4/R5/R6.
Este guia descreve como executar as verificações e o que cada uma cobre. Os
números finais ficam em [docs/evidencias.md](../docs/evidencias.md#resultado-da-validação-final).

## Instalação

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec playwright install chromium
```

O worker do MSW já está em `public/`. Nenhum script de instalação precisa rodar.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | Gera as rotas e verifica a aplicação, a configuração e os E2E (`tsconfig.e2e.json`). |
| `pnpm lint` | ESLint. |
| `pnpm test` | Vitest: ETH, search params, idempotência e formulário de checkout, domínio de pedidos e auth do mock, ledger, aplicação de eventos e reconciliação. |
| `pnpm build` | Build de produção (com mocks, por `.env.production`). |
| `pnpm test:e2e` | Build + preview em `127.0.0.1:4173`, Chromium em 1440×1000 (`chromium-desktop`) e 390×844 (`chromium-mobile`). |
| `pnpm test:e2e:report` | Abre o relatório HTML da última execução. |
| `pnpm exec playwright test --list` | Lista os testes sem abrir navegador. |
| `pnpm audit:lighthouse` | Build + preview em `127.0.0.1:4175`; início e detalhe, 3 execuções por perfil. |

Opções úteis:

- `E2E_BASE_URL=https://… pnpm test:e2e` roda contra um servidor existente com mocks
  (sem build nem preview próprios).
- `E2E_BROWSER_CHANNEL=chrome pnpm test:e2e` usa o Chrome instalado.
- `pnpm test:e2e --update-snapshots` só depois de revisar a diferença visual. Não
  atualize baselines para fazer a suíte passar.

Configuração (`playwright.config.ts`): `fullyParallel`, 2 workers, sem retries,
locale `pt-BR`, timezone `America/Sao_Paulo`, movimento reduzido,
`trace: retain-on-failure` e captura de tela em falha. O relatório HTML vai para
`playwright-report/`, e traces e capturas para `test-results/` (os dois fora do Git).

## Checkout limpo

Para provar que a entrega não depende de arquivos locais, clone a revisão em um
diretório novo e rode:

```sh
git clone https://github.com/pedrOfsilveira/frontend-challenge kurio-clean
cd kurio-clean
git checkout <sha>
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Arquivos ignorados (`node_modules/`, `dist/`, `src/routeTree.gen.ts`, relatórios)
são gerados por esses comandos. Checkout limpo (clone novo do commit `347e855`, 09/11/2026): `pnpm install --frozen-lockfile --ignore-scripts`, typecheck, lint, Vitest 47/47 e build aprovados; `NOTES/` ausente.

## Execução isolada em paralelo

Duas execuções na mesma cópia disputam `dist/`, a porta 4173,
`playwright-report/` e `test-results/`. Para rodar em paralelo (por exemplo, em
worktrees diferentes), cada execução deve ter build, porta e saídas próprios:

```sh
# terminal 1, na cópia A
pnpm build
pnpm preview --host 127.0.0.1 --port 4181 --strictPort

# terminal 2, na cópia A
PLAYWRIGHT_HTML_OUTPUT_DIR=/tmp/kurio-a-report \
E2E_BASE_URL=http://127.0.0.1:4181 \
pnpm test:e2e tests/e2e/realtime.spec.ts --output=/tmp/kurio-a-results
```

Use outra porta e outras pastas na cópia B. Com `E2E_BASE_URL` definido, o
Playwright não tenta subir o próprio servidor na 4173. Depois de alterar o
código, refaça o build e reinicie o preview. O Lighthouse não deve rodar junto
com builds ou suítes de navegador, porque a concorrência distorce as medições.

## Isolamento e controle

- Cada teste recebe um contexto de navegador novo (storage vazio) e abre
  `/?mock-reset` (`helpers.ts › reset`), que restaura o servidor simulado
  inteiro e zera a latência.
- Login, cadastro e operações passam pela interface e pelo Axios/MSW. Nenhum
  teste usa `page.route` nem injeta dados no cache da interface.
- `window.__kurioMock` só configura o servidor simulado: latência, falhas,
  resultado do pagamento, preço/estoque, expiração, retenção de respostas
  (`holdNext`/`releaseHeld`) e queda do socket. A interface recebe as mudanças
  pelo REST ou pelo `socket.io-client` real.
- Tempo: `page.clock` controla a validade da cotação; `setPaymentOutcome('hold')`
  e `settlePendingOrders` decidem quando o pagamento termina; `holdNext` define
  exatamente quando uma resposta REST calculada antes de um evento é entregue.
- `snapshot()` e a contagem de `POST /api/orders` são evidência complementar de
  que retries não criaram um segundo pedido. A asserção principal observa a interface.

## Mapa dos cenários

Itens do §9 do enunciado e os testes que os exercitam:

| # | Cenário | Testes |
|---|---|---|
| 1 | Busca, filtros combinados, ordenação, paginação, histórico | `catalog.spec`, `requirements-gaps.spec` (parâmetros enviados, ordem exibida, resposta fora de ordem) |
| 2 | Detalhe direto e recurso inexistente | `catalog.spec`, `requirements-gaps.spec` (esgotado, limite de quantidade) |
| 3 | Cadastro, login, expiração, logout, troca de usuário | `session.spec`, `account-failures.spec`, `purchase.spec` |
| 4 | Favoritos, falha de mutation e recuperação | `catalog.spec`, `favorites.spec` |
| 5 | Carrinho, quantidades, remoção, cupom, persistência | `cart.spec`, `checkout-failures.spec` (cupom na revisão), `purchase.spec` (carrinho do visitante após login) |
| 6 | Compra completa até o recibo confirmado | `purchase.spec` |
| 7 | Pagamento recusado, clique repetido, timeout com o mesmo pedido | `purchase.spec`, `realtime.spec`, `checkout-failures.spec` (protocolo de idempotência, carteira) |
| 8 | Perfil, avatar, senha, carteiras, erros de validação | `account.spec`, `account-failures.spec` |
| 9 | Preço/disponibilidade via Socket.IO no checkout | `realtime.spec`, `checkout-failures.spec`, `realtime-consistency.spec` (catálogo com filtro, ordem e paginação) |
| 10 | Eventos duplicados/antigos, desconexão, pedido pendente | `realtime.spec`, `realtime-consistency.spec` (resposta em voo no CONNECT e na primeira carga) |
| 11 | Teclado, foco de diálogos, formulários | `session.spec`, `home-polish.spec`, `header.spec`, `accessibility.spec` |
| 12 | Skeleton em rede lenta, falha e nova tentativa | `catalog.spec` |

Layout e regressão visual:

- `visual.spec.ts` compara início, detalhe, carrinho e pagamento nos dois projetos
  (8 baselines em `visual.spec.ts-snapshots/`). Os dados vêm da seed, e
  locale/timezone são fixos. Fontes e imagens visíveis terminam de carregar antes da captura.
- `responsive.spec.ts` verifica 320/390/414/768/1024/1440 px: largura do
  documento, promoções inteiras, revisão sem overflow interno e rótulos longos de carteira.
- `home-polish.spec.ts`, `header.spec.ts` e `nft-mobile-layout.spec.ts` cobrem
  filtros no mobile, paginação estreita, alinhamento do cabeçalho, alvos de toque
  e texto a 200% no detalhe mobile.
- `accessibility.spec.ts` roda axe nos fluxos principais. Axe cobre regras
  automatizáveis; não substitui leitor de tela, zoom e comparação com o Figma.

Lacunas conhecidas (sem E2E dedicado): aviso de redução de estoque na mescla do
carrinho do visitante; skeletons do detalhe e do resumo do carrinho em rede
lenta; mudança de preço com a página `/carrinho` aberta; reenvio de
`order.updated` de outra conta. Ver [docs/evidencias.md](../docs/evidencias.md).

## Lighthouse

`scripts/lighthouse.mjs` usa o build completo e o cenário padrão, sem desativar
imagens, fontes, MSW ou Socket.IO. Grava HTML/JSON de cada execução,
`summary.json` (versões e ambiente) e `summary.md` (medianas, LCP, CLS e TBT) em
`reports/lighthouse/`. Termina com exit 1 se alguma mediana ficar abaixo das
metas (P 90, A 95, BP 95, SEO 90). Aceita `CHROME_PATH` e `LIGHTHOUSE_BASE_URL`.

A auditoria do build final foi executada em 09/11/2026 no commit `347e855` (relatórios em `reports/lighthouse/`).
