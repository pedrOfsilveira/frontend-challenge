# Requisitos e evidências

Matriz entre o [enunciado](challenge.md) e esta entrega. Cada linha separa o que
foi **implementado** (código), a **evidência** que comprova (teste ou relatório),
o **status** e a **lacuna** que resta.

Ainda falta a execução final da suíte e da auditoria sobre o código congelado.
Por isso, nesta tabela, "coberto" significa que existe um teste que observa o
comportamento pela interface/REST/Socket.IO. **Não** significa que o teste já
passou na revisão entregue. Os resultados finais estão em
[Resultado da validação final](#resultado-da-validação-final).

Legenda de status:

- **Coberto** — implementado e exercitado por teste automatizado.
- **Parcial** — implementado, mas a evidência automatizada cobre só parte do requisito.
- **Aberto** — requisito não atendido ou não demonstrado.
- **Pendente** — depende da validação final (auditoria, deploy, paridade).

Os caminhos de teste são relativos a `tests/e2e/` (E2E Playwright, desktop
1440×1000 e mobile 390×844) ou a `src/` (unitários Vitest).

## Stack e arquitetura (§2, §4, §6)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Uso efetivo da stack obrigatória | React 19, TanStack Router/Query, Axios (`src/api/http.ts`), Tailwind 4, shadcn/Radix (`src/components/ui`), MSW 2, `socket.io-client` + `@mswjs/socket.io-binding`, Playwright, Lighthouse (`scripts/lighthouse.mjs`) | `package.json`; todos os E2E usam o build de produção com MSW | Coberto | — |
| Contratos tipados entre transporte, estado e UI | Schemas Zod em `src/api/contracts`; endpoints validam respostas | `pnpm typecheck` (inclui E2E) | Coberto | — |
| Mocks na camada de rede, sem atalhos nos componentes | Handlers em `src/mocks/handlers.ts`; controles só alteram o servidor simulado (`src/mocks/controls.ts`) | Revisão de código; nenhum E2E intercepta respostas com `page.route` | Coberto | — |
| Estado consistente e reset integral | Banco único em `localStorage` (`src/mocks/db/store.ts`); `?mock-reset` reconstrói seed, cenário, falhas, retenções e eventos | `helpers.ts › reset` em todos os E2E | Coberto | Reset sem recarga não limpa o cache da UI (ver ARCHITECTURE) |
| Cenários de rede configuráveis e reproduzíveis | `?scenario=` (9 cenários com semente fixa), `failNext`, `setLatency`, `holdNext` | `catalog.spec` (lento/falha), `requirements-gaps.spec` (fora de ordem), `realtime.spec` (timeout após gravação) | Coberto | `jitter`/`flaky` não têm E2E próprio |
| Respostas de erro: validação, sessão, permissão, inexistente, conflito, transitória | `ApiError` + códigos em `src/api/contracts/errors.ts` | `session.spec`, `account.spec`, `catalog.spec`, `checkout-failures.spec` | Parcial | O contrato define `FORBIDDEN` (403), mas nenhum handler o emite: recurso de outra conta responde 404 |

## Telas e fluxos (§3)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Início: destaques, catálogo, busca, filtros, ordenação | `src/routes/index.tsx`, `src/features/catalog` | `catalog.spec`, `requirements-gaps.spec`, `home-polish.spec`, `header.spec` | Coberto | Slider de preço entra pela URL (`max=`) nos testes |
| Detalhe: galeria, edição, quantidade, favoritos, compra | `src/routes/nft/$nftId.tsx`, `src/features/nft` | `requirements-gaps.spec` (esgotado, limite), `catalog.spec` (404), `nft-mobile-layout.spec` | Coberto | — |
| Carrinho: quantidades, remoção, cupom, resumo | `src/routes/carrinho.tsx`, `src/features/cart` | `cart.spec`, `checkout-failures.spec` | Coberto | — |
| Pagamento: dados, carteira e rede, revisão, envio | `src/routes/_privado/pagamento.tsx`, `src/features/checkout` | `purchase.spec`, `checkout-failures.spec`, `checkout.test.ts` | Coberto | — |
| Confirmação: resultado, transação, itens, taxas, total | `src/routes/_privado/pedido` | `purchase.spec` (recibo após refresh, preço alterado depois) | Coberto | — |
| Login com retorno ao fluxo; cadastro com conflito | `src/routes/entrar.tsx`, `src/features/session` | `session.spec`, `account-failures.spec` | Coberto | — |
| Perfil (dados, avatar, senha) e carteiras | `src/routes/_privado/perfil.tsx`, `carteiras.tsx`, `src/features/account` | `account.spec`, `account-failures.spec` | Coberto | — |
| Perfil, carteiras e confirmação no mobile | Layouts responsivos sem frame dedicado | Projeto `chromium-mobile` de `account.spec` e `purchase.spec` | Parcial | Recibos confirmado/pendente/recusado verificados utilizáveis em 390 px (capturas manuais); sem asserção E2E dedicada |
| Ações fora de escopo sem sucesso aparente | Avisos de indisponibilidade (login social, scan, Criadores, newsletter) | `header.spec`, `nft-mobile-layout.spec` | Coberto | — |

## Catálogo e detalhe (§3)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| URL guarda busca/filtros/ordem/página; refresh e histórico | `src/lib/search-params.ts`, `validateSearch` da rota | `catalog.spec:6`, `search-params.test.ts` | Coberto | — |
| Filtros combináveis; filtro reinicia paginação | `src/features/catalog/search.ts` | `requirements-gaps.spec:48` (parâmetros enviados, ordem exibida, página 1) | Coberto | — |
| Vazio, falha e respostas fora de ordem | Query keys por parâmetro + `AbortSignal` no Axios | `catalog.spec:30/72`, `requirements-gaps.spec:13` | Coberto | A resposta antiga é cancelada; o caminho de descarte por chave só é exercitado indiretamente |
| Acesso direto, NFT inexistente, edição indisponível, limite de quantidade | Detalhe por id; 404; edições `aria-disabled`; stepper limitado ao estoque | `catalog.spec:41/46`, `requirements-gaps.spec:90/111` | Coberto | — |
| Favoritos persistem para o usuário autenticado | `PUT/DELETE /favorites/:id` | `favorites.spec`, `catalog.spec:53` | Coberto | — |

## Carrinho (§3)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Adicionar/alterar/remover respeitando estoque por edição | Domínio `src/mocks/domain/cart.ts` | `cart.spec`, `requirements-gaps.spec:111` | Coberto | — |
| Persistência após refresh | Carrinho no servidor simulado (persistido) | `cart.spec` | Coberto | — |
| Itens do visitante preservados ao autenticar | `mergeGuestCart`; aviso `cartMerge` em `auth-form.tsx` | `purchase.spec:6` (visitante adiciona, entra no checkout e compra) | Parcial | Sem E2E do aviso de redução por estoque na mescla |
| Cupom válido, inválido e expirado | `PUT/DELETE /cart/coupon` | `cart.spec`, `checkout-failures.spec:69` | Coberto | — |
| Resumo coerente com a API | Valores da cotação REST, sem recálculo local do total | `checkout-failures.spec:303` (taxa/total por rede) | Coberto | — |
| Mudança de preço/estoque com o carrinho aberto | `nft.updated` → patch + refetch do carrinho + nova cotação + aviso | `realtime.test.ts`, `realtime.spec:6` (no checkout) | Parcial | Sem E2E específico com a página `/carrinho` aberta |
| ETH como string decimal, cálculo exato | `src/lib/eth.ts` (wei em `bigint`, 18 casas) | `eth.test.ts`, `search-params.test.ts` | Coberto | — |

## Pagamento e confirmação (§3)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Validação dos campos e revisão antes do envio | `src/features/checkout/form.ts`, `review-dialog.tsx` | `checkout.test.ts`, `checkout-failures.spec:347` | Coberto | — |
| Carteiras, rede, conexão/recusa/desconexão | `POST /wallets/:id/connect|disconnect`; `setWalletConnection` | `checkout-failures.spec:107/303` | Coberto | — |
| Revalidar preço/estoque/cupom/taxa; nova confirmação | Revisão compara o id da cotação; servidor responde `QUOTE_OUTDATED` | `realtime.spec:6`, `checkout-failures.spec:14/49/69/148/328`, `orders.test.ts` | Coberto | — |
| Sem pedido duplicado (clique repetido, timeout) | `Idempotency-Key` derivada do corpo; retry com a mesma chave | `realtime.spec:47/79`, `checkout-failures.spec:241`, `orders.test.ts`, `checkout.test.ts` | Coberto | — |
| Pendente/confirmado/recusado; recuperação após refresh/reconexão | `order.updated` + consulta REST a cada 4 s enquanto pendente | `purchase.spec:6/57`, `realtime.spec:26`, `realtime-consistency.spec:129` | Coberto | — |
| Confirmação só para pedido confirmado | Tela do pedido decide pelo status do servidor | `purchase.spec:57` | Coberto | — |
| Falha preserva itens; confirmação remove só o comprado | `settleOrder` no domínio | `checkout-failures.spec:14/173`, `orders.test.ts` | Coberto | — |
| Recibo é snapshot do pedido | Linhas, taxas e totais gravados no pedido | `purchase.spec:6` (preço muda depois, recibo igual após refresh) | Coberto | — |

## Conta e sessão (§3)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Cadastro, login, logout, sessão após refresh | `src/features/session`, token em `localStorage` | `session.spec` | Coberto | — |
| Rotas privadas exigem autenticação | Layout `_privado` | `favorites.spec:6`, `account-failures.spec:9` | Coberto | — |
| Expiração durante navegação e checkout, com retomada | 401 do token ativo → login com retorno validado; rascunho por usuário | `session.spec:48`, `checkout-failures.spec:197`, `account-failures.spec:9`, `auth.test.ts` | Coberto | — |
| Logout/troca limpa cache privado e subscriptions | Escopo privado por usuário; ledger zerado; socket reconecta com o novo token | `purchase.spec:33`, `account-failures.spec:23`, `realtime.test.ts` | Coberto | — |
| Validação de formulários e erros da API | Erros por campo vindos da API | `session.spec`, `account.spec`, `account-failures.spec:53` | Coberto | — |
| Senhas fora do texto claro | PBKDF2-SHA256 com salt (`src/mocks/passwords.ts`) | Revisão de código | Coberto | Simulação local, não uma estratégia de produção |

## Integração e estado (§4)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Estados de carregamento, vazio, erro, sucesso e atualização em segundo plano | Skeletons, `ApiError`, avisos ao vivo | `catalog.spec:30/72` | Parcial | Skeleton de detalhe e do resumo do carrinho em rede lenta sem E2E |
| Invalidação após mutations e eventos | Mutations gravam resposta ou invalidam; `refresh.ts` para eventos | `refresh.test.ts`, `realtime-consistency.spec` | Coberto | — |
| Isolamento por usuário e parâmetros | Chaves `['private', scope, …]` e `['nfts', 'list', params]` | `purchase.spec:33`, `account-failures.spec:23` | Coberto | — |
| Atualização otimista com rollback | Favoritos (`use-favorites.ts`) | `catalog.spec:53`, `favorites.spec:16` | Coberto | — |
| Rotas inexistentes e acesso direto | `notFoundComponent`; rewrites do `vercel.json` | `catalog.spec:46`; deploy | Coberto (local); deploy com rewrites SPA do `vercel.json` | — |

## Tempo real (§6, §7)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Socket.IO via `socket.io-client` + binding MSW | `src/realtime/client.ts`, `src/mocks/realtime.ts` | Todos os E2E de tempo real conectam um cliente real | Coberto | Limitações do binding (ver ARCHITECTURE) |
| `nft.updated` atualiza catálogo, detalhe e carrinho | `src/realtime/apply.ts`; listas ativas voltam ao REST | `realtime-consistency.spec:58/72/84`, `realtime.test.ts`, `refresh.test.ts` | Coberto | — |
| `order.updated` atualiza o pedido | Aplicado ao cache do pedido; terminal não regride | `realtime-consistency.spec:129`, `purchase.spec:6` | Coberto | — |
| Identidade, recurso e versão; duplicatas e eventos antigos | Envelope validado; ledger LRU + versão por recurso | `realtime-consistency.spec:98`, `realtime.spec:6`, `realtime.test.ts` | Coberto | — |
| Reconciliação após reconexão, sem confiar em resposta em voo | `reconcileAfterConnect` + `createRefresher` | `realtime-consistency.spec:186/203`, `realtime.spec:26`, `refresh.test.ts` | Coberto | — |
| Eventos de outra sessão não afetam o usuário | Filtro no servidor por token e no cliente por `userId` | `realtime.test.ts` (evento de outro usuário e de visitante) | Parcial | Sem E2E que reenvie `order.updated` de outra conta (`replay(id, { unfiltered: true })` existe para isso) |
| Liberação de listeners | Cleanup em `startRealtime`; `refresher.dispose()` | `refresh.test.ts` | Parcial | Sem teste do ciclo de vida completo do socket |
| Cenário do enunciado: carrinho → mudança → aviso → bloqueio da cotação velha | Ver linhas acima | `realtime.spec:6`, `checkout-failures.spec:14/49` | Coberto | — |
| Queda com pedido pendente e retomada sem nova compra | Reconciliação REST e pedido por id | `realtime.spec:26` | Coberto | — |

## Interface e acessibilidade (§8)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Fidelidade ao Figma | Tokens, fonte e assets do Figma | `visual.spec` (8 baselines desktop/mobile) | Parcial | Comparação direta com os frames não foi refeita nesta integração; desvios listados em ARCHITECTURE |
| 390/768/1440 sem overflow | Layout responsivo | `responsive.spec` (320–1440), `home-polish.spec`, `nft-mobile-layout.spec` | Coberto | Verificação em 390/414/768/1440 de início, detalhe, login, cadastro, carrinho, pagamento, perfil, carteiras e recibos: sem overflow; único corte interno real é W2B-R5 (aberto) |
| Skeletons com shimmer, sem deslocamento, movimento reduzido | `src/components/ui/skeleton.tsx` | `catalog.spec:72`; CLS dos relatórios Lighthouse | Parcial | Detalhe e resumo do carrinho sem E2E de skeleton |
| Teclado, foco em diálogos, labels e erros associados | Radix + formulários | `session.spec:69`, `home-polish.spec:5`, `header.spec` | Coberto | — |
| Feedback acessível de mutations e tempo real | Toasts + `aria-live` | `realtime.spec:6`, `account.spec` | Coberto | — |
| Zoom/texto a 200% | — | `nft-mobile-layout.spec` | Parcial | Coberto só no detalhe mobile |
| Regras automatizáveis | axe 4.14 | `accessibility.spec` | Coberto | axe não substitui leitor de tela nem certificação WCAG |

## Testes (§9)

| Requisito | Evidência | Status | Lacuna |
|---|---|---|---|
| Itens 1–12 do enunciado | Mapeamento detalhado em [tests/README.md](../tests/README.md#mapa-dos-cenários) | Coberto | Ver linhas parciais acima |
| Chromium desktop e mobile | `playwright.config.ts`: `chromium-desktop`, `chromium-mobile` | Coberto | — |
| Regressão visual com baselines versionadas | `tests/e2e/visual.spec.ts-snapshots/` (8 PNG) | Coberto | — |
| Estado isolado, relógio/latência/eventos controlados | Contexto novo + `?mock-reset`; `page.clock`; `setLatency`/`holdNext`/`settlePendingOrders` | Coberto | — |
| Relatório HTML e traces de falhas | `reporter: html`, `trace: retain-on-failure` | Coberto | — |
| Suíte completa aprovada | Playwright completo (chromium-desktop + chromium-mobile, sem atualizar baselines): 141 aprovados, 5 ignorados por projeto, 0 falhas em 6,5 min no commit `347e855`; 8 aprovados como falha esperada (`test.fail`) documentam pendências de acessibilidade W2B-R1/R3/R4/R5/R6 | Coberto | — |

## Performance e Lighthouse (§10)

| Requisito | Implementação | Evidência | Status | Lacuna |
|---|---|---|---|---|
| Início e detalhe, mobile e desktop, 3 execuções, medianas | `scripts/lighthouse.mjs` | `reports/lighthouse/` (relatórios **anteriores** a esta integração) | Pendente | Auditoria final executada no commit `347e855` |
| Metas P≥90, A≥95, BP≥95, SEO≥90 | Script termina com exit 1 se alguma meta falhar | Auditoria final: performance mobile 55 (início) e 61 (detalhe); desktop 97/98; A100, BP96, SEO92 | Aberto | Performance mobile abaixo de 90 nos relatórios anteriores; confirmado na auditoria final; causas em ARCHITECTURE.md |
| LCP, CLS, TBT e causas | `summary.md`/`summary.json` | Relatórios anteriores: LCP 5,6 s / 4,8 s; TBT 952 / 909 ms; CLS 0 | Pendente | Causas atualizadas dependem da auditoria final |
| Sem simplificação exclusiva da auditoria | Mesmo build da demo, com MSW, fontes, imagens e Socket.IO | `scripts/lighthouse.mjs` | Coberto | — |

## Entrega (§12)

| Requisito | Evidência | Status | Lacuna |
|---|---|---|---|
| Execução a partir de checkout limpo | Procedimento em [tests/README.md](../tests/README.md#checkout-limpo) | Coberto | Checkout limpo (clone novo do commit `347e855`, 09/11/2026): `pnpm install --frozen-lockfile --ignore-scripts`, typecheck, lint, Vitest 47/47 e build aprovados; `NOTES/` ausente. |
| Repositório público com o código entregue | — | https://github.com/pedrOfsilveira/frontend-challenge, branch `main`, código validado `347e855` | — |
| Deploy público correspondente ao código | `vercel.json` (SPA fallback, worker sem cache) | https://racing-sable-eislhs3.vercel.app (produção Vercel construída a partir do `main`) | Commits posteriores ao código validado alteram apenas documentação |
| README, ARCHITECTURE e contratos documentados | [README](../README.md), [ARCHITECTURE](../ARCHITECTURE.md) | Coberto | — |

## Resultado da validação final

Gate final executado em 09/11/2026 no commit `347e855`.

| Verificação | Resultado |
|---|---|
| `pnpm install --frozen-lockfile --ignore-scripts` (checkout limpo) | Aprovado (clone novo de `347e855`) |
| `pnpm typecheck` · `pnpm lint` · `pnpm build` | Aprovados |
| `pnpm test` (Vitest) | 47/47 aprovados (7 arquivos) |
| `pnpm test:e2e` (desktop + mobile, sem atualizar baselines) | 141 aprovados, 5 ignorados por projeto, 0 falhas (8 falhas esperadas documentadas) |
| `pnpm audit:lighthouse` | Executado; performance mobile 55/61 abaixo de 90 (aberto); demais metas atingidas |
| E2E contra o deploy público | SMOKE_PLACEHOLDER |
| Commit validado | `347e855` |
