# Lighthouse — medianas de 3 execuções

Build de produção, cenário padrão dos mocks, sem sessão, Chrome novo por execução, throttling padrão mobile ou preset desktop; 3 medições sequenciais por página/perfil.

| Página | Perfil | P | A | BP | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| inicio | mobile | 55 | 100 | 96 | 92 | 5570 | 0.000 | 919 |
| inicio | desktop | 97 | 100 | 96 | 92 | 1129 | 0.000 | 71 |
| detalhe | mobile | 61 | 100 | 96 | 92 | 4942 | 0.000 | 878 |
| detalhe | desktop | 98 | 100 | 96 | 92 | 1100 | 0.000 | 74 |

Ambiente e versões: [summary.json](summary.json). Relatórios individuais HTML/JSON neste diretório. As metas são P ≥90, A ≥95, BP ≥95 e SEO ≥90.
