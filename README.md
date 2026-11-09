# Kurio — NFT Marketplace

Desafio frontend da Jungle Gaming: descoberta, compra e conta de colecionador em
React/TypeScript, com APIs, autenticação, carteiras e pagamentos simulados por MSW.
O [enunciado original](docs/challenge.md) foi preservado.

- [ARCHITECTURE.md](ARCHITECTURE.md): contratos, sessão, cache, tempo real, decisões e limitações.
- [docs/evidencias.md](docs/evidencias.md): matriz requisito → implementação → evidência → status → lacuna.
- [tests/README.md](tests/README.md): execução dos testes, isolamento, checkout limpo e auditoria.

## Execução local

Ambiente de referência: Node 26.13 e pnpm 12.18 (fixado em `packageManager`).

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev            # Vite com MSW ativo
```

O worker do MSW está versionado em `public/mockServiceWorker.js`, então nenhum
script de instalação das dependências precisa rodar (`pnpm-workspace.yaml` nega
o build do pacote `msw`). Abra a URL indicada pelo Vite.

```sh
pnpm build          # tsr generate + tsc -b + vite build
pnpm preview        # serve dist/ (também com MSW)
```

O build de demonstração usa os mesmos mocks. Não há backend privado, extensão de
carteira nem pagamento real. O service worker exige localhost ou HTTPS.

## Variáveis de ambiente

| Variável | Padrão | Função |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` em `.env.development` e `.env.production` | Liga MSW REST e Socket.IO. Somente o valor `true` ativa. |
| `VITE_API_URL` | `/api` | Base do Axios e dos handlers MSW. |
| `VITE_REALTIME_URL` | origem da página | Origem do Socket.IO (cliente e `ws.link` do mock). O caminho é sempre `/realtime/`. |
| `E2E_BASE_URL` | preview local em `127.0.0.1:4173` | Roda os E2E contra um servidor existente, sem build próprio. |
| `E2E_BROWSER_CHANNEL` | Chromium do Playwright | `chrome` usa o Chrome instalado. |
| `PLAYWRIGHT_HTML_OUTPUT_DIR` | `playwright-report/` | Pasta do relatório HTML (variável oficial do Playwright). |
| `LIGHTHOUSE_BASE_URL` | preview local em `127.0.0.1:4175` | Audita um servidor existente, sem build próprio. |
| `CHROME_PATH` | Chromium do Playwright ou `/opt/google/chrome/chrome` | Navegador usado pelo Lighthouse. |

Variáveis `VITE_*` são públicas e entram no bundle; não coloque segredos nelas.

## Credenciais fictícias e dados

| Usuário | E-mail | Senha | Estado inicial |
|---|---|---|---|
| Nova Sato | `nova@kurio.dev` | `kurio123` | Carrinho vazio, sem favoritos, carteira principal Ethereum. |
| Leo Martins | `leo@kurio.dev` | `kurio123` | Golden Beat #207 no carrinho, dois favoritos, principal Polygon e secundária Ethereum. |

O cadastro cria outras contas no mesmo servidor simulado. Senhas ficam como
hash PBKDF2-SHA256 com salt; o banco simulado não guarda texto claro.

O catálogo tem 48 NFTs em Ethereum, Polygon e Solana, com edições de estoques
distintos e um NFT totalmente esgotado. O pagamento aceita Ethereum (taxa
0,016 ETH) e Polygon (0,002 ETH). Cupons: `KURIO10` (10%, subtotal mínimo
1 ETH), `LANCAMENTO` (0,05 ETH) e `EXPIRADO25` (expirado). A cotação vale 10 min
e a sessão, 2 h. ETH trafega como string decimal; os cálculos usam wei com `bigint`.

## Cenários e reset

Selecione o cenário pela URL. A escolha fica salva no `localStorage` até outra:

| Cenário | Comportamento |
|---|---|
| `default` | Latência 120–400 ms (semente fixa). |
| `fast` | Sem latência. |
| `slow` | 1,8–2,6 s: mostra os skeletons. |
| `jitter` | 50 ms–1,5 s. |
| `out-of-order` | Listagem do catálogo: a 1ª resposta leva 1,5 s, a 2ª 150 ms. |
| `offline` | Toda requisição falha na rede; o Socket.IO recusa conexões. |
| `server-error` | Leituras (GET) respondem 503. |
| `flaky` | Uma em cada duas requisições responde 503. |
| `empty` | Catálogo vazio. |

Exemplo: `/?scenario=slow`. Volte com `/?scenario=default`.

**Reset integral:** abra `/?mock-reset` (ou `/?mock-reset&scenario=slow`). Antes
de qualquer requisição, ele reconstrói banco, sessões, carrinhos, pedidos e
cotações. Também restaura o cenário (padrão `default`), latência, falhas
injetadas, respostas retidas, histórico de eventos e conexões Socket.IO. Os dois
parâmetros saem da URL. Tokens anteriores deixam de existir no servidor, e a
próxima chamada autenticada leva ao login. O token e o rascunho guardados no
navegador não são apagados. Para uma sessão totalmente limpa, use um contexto de
navegador novo, como fazem os E2E.

## Reproduzir falhas

Depois que a página carregar, `window.__kurioMock` fica disponível no console.
Os controles só alteram o servidor simulado. A interface recebe as mudanças por
REST e Socket.IO, nunca por escrita direta no cache.

```js
// Preço/estoque durante a compra: adicione Emerald Ape #042, abra a revisão e então:
await __kurioMock.updateNft('emerald-ape-042', { priceEth: '2.5' })
await __kurioMock.updateNft('emerald-ape-042', { available: 0 })

// Sessão expirada: a próxima chamada autenticada leva ao login, preservando o retorno.
await __kurioMock.expireSessions()

// Cupom que expira durante a revisão.
await __kurioMock.expireCoupon('KURIO10')

// Pagamento pendente até decisão explícita (configure antes de pagar).
await __kurioMock.setPaymentOutcome('hold')        // 'confirm' (padrão) | 'decline' | 'hold'
await __kurioMock.settlePendingOrders('confirm')   // ou 'decline'

// Pedido gravado com a resposta perdida/atrasada: o retry recupera o mesmo pedido.
__kurioMock.failNext('orders.create', 'timeout-after-commit')

// Queda do Socket.IO com pedido pendente: decida no servidor e reconecte.
__kurioMock.realtime.pause()
await __kurioMock.settlePendingOrders('confirm')
__kurioMock.realtime.resume()

// Eventos duplicados ou antigos.
const event = __kurioMock.events().find((e) => e.type === 'nft.updated')
if (event) __kurioMock.realtime.replay(event.id)

// Falha no favorito; recusa e queda da conexão da carteira.
__kurioMock.failNext('favorites.add', 'server-error')
await __kurioMock.setWalletConnection('reject')
await __kurioMock.disconnectWallets()
```

`failNext(rota, tipo, n)` aceita `network`, `timeout`, `server-error`,
`after-commit` (gravou e perdeu a resposta) e `timeout-after-commit` (gravou e
respondeu depois do timeout de 10 s do Axios). `*` vale para qualquer rota. Os
nomes de rota estão em `src/mocks/handlers.ts`. Também há `setLatency(ms | null)`,
`setPaymentDelay(ms)` (padrão 2,5 s), `holdNext(rota)` e `releaseHeld(rota)` para
reter uma resposta já calculada, além de `realtime.drop()` e `realtime.connections()`.
`snapshot()` devolve uma cópia do banco simulado.

## Comandos

```sh
pnpm dev                 # desenvolvimento com mocks
pnpm build && pnpm preview
pnpm typecheck           # app, configuração e E2E
pnpm lint
pnpm test                # Vitest (unitários)
pnpm exec playwright install chromium
pnpm test:e2e            # build + preview na 4173, Chromium desktop e mobile
pnpm test:e2e:report     # abre o último relatório HTML
pnpm audit:lighthouse    # build + preview na 4175, 3 execuções por página/perfil
```

Detalhes, execução isolada em paralelo e checkout limpo: [tests/README.md](tests/README.md).

## Estado da verificação

Gate final no commit `347e855`: typecheck, lint e build aprovados; Vitest 47/47; Playwright completo (chromium-desktop + chromium-mobile, sem atualizar baselines): 141 aprovados, 5 ignorados por projeto, 0 falhas em 6,5 min no commit `347e855`; 8 aprovados como falha esperada (`test.fail`) documentam pendências de acessibilidade W2B-R1/R3/R4/R5/R6.
Os números finais de testes e auditoria só serão registrados depois que o
código for congelado. A matriz em [docs/evidencias.md](docs/evidencias.md)
indica o que cada requisito tem como evidência e o que ainda falta.

Os relatórios em `reports/lighthouse/` são **anteriores** às mudanças desta
integração e não medem a versão final. Neles, a performance mobile ficou abaixo
da meta de 90 (início 55, detalhe 62); desktop 97–98; acessibilidade 100, boas
práticas 96, SEO 92. A auditoria do build final está pendente de validação final.
Medianas de 3 execuções (09/11/2026, commit `347e855`, preview local, Lighthouse via `pnpm audit:lighthouse`): início mobile P55/A100/BP96/SEO92, LCP 5.570 ms, CLS 0, TBT 919 ms; início desktop P97/A100/BP96/SEO92, LCP 1.129 ms, TBT 71 ms; detalhe mobile P61/A100/BP96/SEO92, LCP 4.942 ms, CLS 0, TBT 878 ms; detalhe desktop P98/A100/BP96/SEO92, LCP 1.100 ms, TBT 74 ms. Meta de performance mobile (≥90) **não atingida**. Causas medidas: primeiro render do React (~2,1 s de scripting a 4× CPU, com layouts forçados em `use-sliding-indicator` e `MobilePurchaseBar`), chunk HTTP (~600 ms, construção de schemas zod), chunk do mock (~176 KB gzip no caminho crítico do LCP do detalhe, ~77 KB de tough-cookie/tldts) e um GET extra por query em voo no primeiro CONNECT.

## Publicação

`vercel.json` configura Vite, instalação sem scripts, SPA fallback (exceto
`assets/`, `api/`, `realtime/` e o worker) e `no-cache` no worker. O build
publicado usa `.env.production`, com mocks ativos.

- Repositório: https://github.com/pedrOfsilveira/frontend-challenge. Branch `main` (mesma revisão em `chore/integracao-wave2-09-11-2026`); código validado no commit `347e855`.
- Aplicação: https://racing-sable-eislhs3.vercel.app (produção Vercel, build do código validado).

A correspondência entre o código do repositório e a versão publicada ainda não
foi verificada para esta revisão. (o deploy é feito a partir da revisão enviada ao `main`; commits posteriores, se houver, alteram apenas documentação).

Para publicar no projeto Vercel existente (CLI autenticada na conta proprietária):

```sh
vercel deploy --project racing-sable-eislhs3 --scope pedrofsilveiras-projects
# Após validar o preview:
vercel promote <deployment-url> --scope pedrofsilveiras-projects
```
