# Verificação

Instalação: `pnpm install --frozen-lockfile --ignore-scripts`, depois
`pnpm exec playwright install chromium`. O worker MSW já está em `public/`.

- `pnpm typecheck`: inclui a aplicação, a configuração e os testes E2E.
- `pnpm lint`, `pnpm build`, `pnpm test`: lint, build e testes unitários.
- `pnpm test:e2e`: build de produção + preview, Chromium em 1440×1000 e 390×844.
- `pnpm test:e2e:report`: relatório HTML da última execução.
- `pnpm test:e2e --update-snapshots`: atualizar baselines após revisão visual.
- `E2E_BASE_URL=https://... pnpm test:e2e`: executar contra um deploy com mocks.
- `E2E_BROWSER_CHANNEL=chrome pnpm test:e2e`: alternativa usando Chrome instalado.
- `pnpm audit:lighthouse`: início e detalhe, três execuções por perfil mobile/desktop.

Cada E2E recebe um contexto de navegador novo e restaura o servidor simulado com
`?mock-reset`. A autenticação e as operações passam pela interface e por
Axios/MSW. Controles `window.__kurioMock` só configuram o servidor simulado
(latência, falha, resultado de pagamento, mudança de preço e queda do socket).
Não há interceptação de respostas pelo Playwright nem injeção no cache da UI.

O cenário `hold` permite verificar o estado pendente antes de disparar a decisão
do pagamento; a interface recebe o resultado pelo cliente Socket.IO real.
O teste de reconexão muda o pedido enquanto o servidor socket está pausado e
verifica sua recuperação por REST. Leituras de `snapshot()` são evidência
adicional de que o retry não criou um segundo pedido.

As baselines cobrem início, detalhe, carrinho e pagamento. Dados vêm do seed,
locale/timezone são fixos, movimento é reduzido e fontes/imagens visíveis
terminam de carregar antes da captura. Report HTML e traces de falha são gerados
em `playwright-report/` e `test-results/` (não versionados).

`responsive.spec.ts` verifica 320/390/414/768/1024/1440 px nos dois perfis de
navegador. Confere a largura real do documento contra o viewport solicitado,
conteúdo e botões inteiros nas promoções, altura do hero em 414 px, revisão de
compra sem overflow interno (inclusive o botão de fechar) e rótulos longos de
carteiras. Capturas das promoções e da revisão ficam nos artefatos de cada teste;
esses checks complementam as baselines do primeiro viewport.

A análise axe verifica regras WCAG automatizáveis; não substitui teste manual
de leitor de tela, teclado, zoom e comparação com o Figma.

O script Lighthouse usa o build completo e o cenário padrão: não desativa
imagens, fontes, MSW ou Socket.IO. Pode usar `CHROME_PATH=/caminho/do/chrome` e
`LIGHTHOUSE_BASE_URL=https://...` para auditar um servidor já publicado.
Relatórios HTML/JSON e medianas ficam em `reports/lighthouse/`. Resultados abaixo
das metas fazem o comando terminar com exit 1 e devem ter suas causas registradas.
