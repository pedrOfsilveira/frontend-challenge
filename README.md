# Kurio — NFT Marketplace

Desafio frontend da Jungle Gaming: descoberta, compra e conta de colecionador em
React/TypeScript, com APIs e pagamentos simulados. O [enunciado original](docs/challenge.md)
foi preservado. Decisões, contratos e limitações: [ARCHITECTURE.md](ARCHITECTURE.md).

## Execução local

Ambiente usado: Node 26.13 e pnpm 12.18 (fixado em `packageManager`).

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

O worker MSW está versionado em `public/mockServiceWorker.js`; não é necessário
executar scripts de instalação das dependências. Abra a URL indicada pelo Vite.

```sh
pnpm build
pnpm preview
```

O build de demonstração também usa MSW. Não há backend privado, extensão de
carteira ou pagamento real. Sirva em localhost ou HTTPS para usar o service worker.

## Configuração

| Variável | Padrão | Função |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` em `.env.development` e `.env.production` | Habilita MSW REST e Socket.IO. |
| `VITE_API_URL` | `/api` | Base dos endpoints Axios e handlers MSW. |
| `E2E_BASE_URL` | preview local, porta 4173 | Testa um servidor existente. |
| `E2E_BROWSER_CHANNEL` | Chromium do Playwright | Use `chrome` para Chrome instalado. |
| `CHROME_PATH` | Chromium instalado ou Chrome Linux | Executável usado pelo Lighthouse. |
| `LIGHTHOUSE_BASE_URL` | preview local, porta 4175 | Audita servidor existente. |

Variáveis `VITE_*` são públicas e aplicadas no build; não coloque segredos nelas.

## Credenciais fictícias

| Usuário | E-mail | Senha |
|---|---|---|
| Nova Sato | `nova@kurio.dev` | `kurio123` |
| Leo Martins | `leo@kurio.dev` | `kurio123` |

Há 48 NFTs, edições com estoques distintos, Ethereum/Polygon/Solana no catálogo,
dois usuários com favoritos/carrinhos/carteiras diferentes e uma edição esgotada.
Pagamento suporta Ethereum e Polygon. Leo começa com um NFT no carrinho; Nova
começa sem itens. Cadastro cria outra conta no mesmo servidor simulado.

Cupons: `KURIO10` (10%, subtotal mínimo 1 ETH), `LANCAMENTO` (0,05 ETH) e
`EXPIRADO25` (expirado). ETH trafega como string; cálculos usam wei com bigint.

## Cenários e reset

Abra `/?scenario=slow` para rede lenta. Outras opções: `default`, `fast`, `jitter`,
`out-of-order`, `offline`, `server-error`, `flaky`, `empty`. A opção persiste;
volte com `/?scenario=default`.

Para reset integral com recarga, abra `/?mock-reset`. Restaura banco, cenários,
falhas e eventos. Tokens antigos deixam de ser válidos; a próxima chamada
autenticada solicita login. Para uma sessão totalmente nova, use contexto de
navegador novo, como os E2E fazem.

Após carregar a página, use `window.__kurioMock` no console para reproduzir casos
específicos. Os controles alteram o servidor simulado; a UI recebe REST e Socket.IO.

```js
// Adicione Emerald Ape #042 e abra o pagamento/revisão antes de mudar preço/estoque.
await __kurioMock.updateNft('emerald-ape-042', { priceEth: '2.5' })
await __kurioMock.updateNft('emerald-ape-042', { available: 0 })

// A próxima chamada autenticada exige login, preservando o retorno.
await __kurioMock.expireSessions()

// Configure antes de enviar: o pedido fica pendente até decisão explícita.
await __kurioMock.setPaymentOutcome('hold')
await __kurioMock.settlePendingOrders('confirm') // ou 'decline'

// Antes de confirmar: grava o pedido, expira a resposta e recupera por idempotência.
__kurioMock.failNext('orders.create', 'timeout-after-commit')

// Queda com pedido pendente: decida no servidor e reconecte.
__kurioMock.realtime.pause()
await __kurioMock.settlePendingOrders('confirm')
__kurioMock.realtime.resume()

// Reenvie eventos duplicados ou antigos.
const event = __kurioMock.events().find(e => e.type === 'nft.updated')
if (event) __kurioMock.realtime.replay(event.id)

// Falha no favorito ou recusa de conexão da carteira.
__kurioMock.failNext('favorites.add', 'server-error')
await __kurioMock.setWalletConnection('reject')
```

Falhas por rota: `network`, `timeout`, `server-error`, `after-commit` (resposta
perdida) e `timeout-after-commit` (resposta atrasada após gravação). `setLatency(ms)`
e `setPaymentDelay(ms)` controlam o tempo sem mudar regras do domínio.

## Verificações

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:report
pnpm audit:lighthouse
```

[Guia de testes](tests/README.md): isolamento, baselines e uso contra deploy.
Os E2E cobrem cadastro, sessão, compra, idempotência, eventos, reconexão, conta e
regressão visual em desktop/mobile. HTML e traces de falha ficam em
`playwright-report/` e `test-results/`.

Lighthouse gera HTML/JSON de início e detalhe, três execuções por perfil e página,
com medianas em `reports/lighthouse/summary.md`. Não há versão simplificada para
auditoria. Resultados finais: 33 unitários e 54 E2E passaram; typecheck, lint e build
passaram também em cópia limpa. Lighthouse: desempenho desktop 97–98,
mobile 55–62; acessibilidade 100, boas práticas 96, SEO 92. **Performance mobile
abaixo da meta de 90**, com causas e próximos passos em ARCHITECTURE.md.
[Relatórios e medianas](reports/lighthouse/summary.md).

## Publicação

Repositório: https://github.com/pedrOfsilveira/frontend-challenge

`vercel.json` configura Vite, instalação sem scripts, SPA fallback e headers do
worker. O deploy inclui `.env.production` com mocks ativos. Acesso direto e
refresh de detalhe, pagamento, perfil, carteiras e pedido devem funcionar na URL pública.

Site publicado: **https://racing-sable-eislhs3.tmp.now**

O projeto foi assumido na conta Vercel do candidato. Esse endereço serve a
aplicação sem autenticação da plataforma. Acesso HTTP direto às rotas de detalhe,
perfil, carteiras, pagamento e pedido foi confirmado; o worker é entregue como
JavaScript com `no-cache, no-store, must-revalidate`.

O endereço técnico `temporary-racing-sable-eislhs3-anon-omega-green.vercel.app`
ainda exige login da Vercel; use o endereço público acima para avaliação.

Validação no site publicado: 35/36 E2E passaram. Há uma correção local para perda
intermitente do aviso de expiração durante refresh; ela ainda precisa ser
publicada com a CLI autenticada na conta proprietária. Veja ARCHITECTURE.md.
