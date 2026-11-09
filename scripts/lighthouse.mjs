import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const baseURL = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4175'
// Overrides para medições exploratórias (não sobrescrevem os relatórios versionados).
const output = path.resolve(process.env.LIGHTHOUSE_OUTPUT_DIR ?? 'reports/lighthouse')
const runsPerTarget = Number(process.env.LIGHTHOUSE_RUNS ?? 3)
const pick = (value, all) => value ? value.split(',').map((item) => item.trim()).filter((item) => all.includes(item)) : all
const cli = fileURLToPath(import.meta.resolve('lighthouse/cli/index.js'))
const chromePath = process.env.CHROME_PATH ?? (existsSync(chromium.executablePath()) ? chromium.executablePath() : '/opt/google/chrome/chrome')
const categories = ['performance', 'accessibility', 'best-practices', 'seo']
const targets = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const allPages = { inicio: '/', detalhe: '/nft/emerald-ape-042' }
const pages = Object.fromEntries(pick(process.env.LIGHTHOUSE_PAGES, Object.keys(allPages)).map((page) => [page, allPages[page]]))
const profiles = pick(process.env.LIGHTHOUSE_PROFILES, ['mobile', 'desktop'])
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
let server

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} terminou com código ${code}.`)))
  })
}

try {
  if (!existsSync(chromePath)) throw new Error('Instale Chromium com pnpm exec playwright install chromium ou defina CHROME_PATH.')
  await mkdir(output, { recursive: true })
  if (!process.env.LIGHTHOUSE_BASE_URL) {
    await run('pnpm', ['build'])
    server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'inherit', detached: process.platform !== 'win32' })
    server.on('error', (error) => console.error(error.message))
    let listening = false
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error('O preview terminou antes de iniciar.')
      try { listening = (await fetch(baseURL)).ok } catch { /* servidor iniciando */ }
      if (listening) break
      await setTimeout(250)
    }
    if (!listening) throw new Error('O preview não iniciou em 30 segundos.')
  }

  const measurements = []
  // Sequential runs: never compete with another audit from this script.
  for (const [page, route] of Object.entries(pages)) {
    for (const profile of profiles) {
      const runs = []
      for (let index = 1; index <= runsPerTarget; index++) {
        const prefix = path.join(output, `${page}-${profile}-${index}`)
        console.log(`Lighthouse: ${page}, ${profile}, execução ${index}/${runsPerTarget}`)
        await run(process.execPath, [cli, new URL(route, baseURL).href,
          '--output=html', '--output=json', `--output-path=${prefix}`,
          '--only-categories=performance,accessibility,best-practices,seo',
          '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage', '--quiet',
          ...(profile === 'desktop' ? ['--preset=desktop'] : []),
          ...(process.env.LIGHTHOUSE_SAVE_ASSETS ? ['--save-assets'] : []),
        ], { env: { ...process.env, CHROME_PATH: chromePath } })
        const report = JSON.parse(await readFile(`${prefix}.report.json`, 'utf8'))
        if (report.runtimeError) throw new Error(report.runtimeError.message)
        if (categories.some((category) => report.categories[category].score === null)) throw new Error('Auditoria sem pontuação válida.')
        runs.push({
          scores: Object.fromEntries(categories.map((category) => [category, Math.round(report.categories[category].score * 100)])),
          lcpMs: report.audits['largest-contentful-paint'].numericValue,
          cls: report.audits['cumulative-layout-shift'].numericValue,
          tbtMs: report.audits['total-blocking-time'].numericValue,
          lighthouseVersion: report.lighthouseVersion,
          userAgent: report.userAgent,
          settings: report.configSettings,
        })
      }
      measurements.push({ page, route, profile, runs,
        median: {
          ...Object.fromEntries(categories.map((category) => [category, median(runs.map((run) => run.scores[category]))])),
          lcpMs: median(runs.map((run) => run.lcpMs)),
          cls: median(runs.map((run) => run.cls)),
          tbtMs: median(runs.map((run) => run.tbtMs)),
        },
      })
    }
  }
  const summary = { measuredAt: new Date().toISOString(), baseURL, environment: {
    node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(),
    cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryBytes: os.totalmem(), chromePath,
    conditions: `Build de produção, cenário padrão dos mocks, sem sessão, Chrome novo por execução, throttling padrão mobile ou preset desktop; ${runsPerTarget} medições sequenciais por página/perfil.`,
  }, targets, measurements }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  const rows = measurements.map(({ page, profile, median: m }) => `| ${page} | ${profile} | ${m.performance} | ${m.accessibility} | ${m['best-practices']} | ${m.seo} | ${Math.round(m.lcpMs)} | ${m.cls.toFixed(3)} | ${Math.round(m.tbtMs)} |`)
  await writeFile(path.join(output, 'summary.md'), `# Lighthouse — medianas de ${runsPerTarget} execuções\n\n${summary.environment.conditions}\n\n| Página | Perfil | P | A | BP | SEO | LCP (ms) | CLS | TBT (ms) |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nAmbiente e versões: [summary.json](summary.json). Relatórios individuais HTML/JSON neste diretório. As metas são P ≥90, A ≥95, BP ≥95 e SEO ≥90.\n`)
  console.log(rows.join('\n'))
  const below = measurements.filter(({ median: m }) => categories.some((category) => m[category] < targets[category]))
  if (below.length) { console.error('Há resultados abaixo das metas. Consulte os relatórios e documente as causas em ARCHITECTURE.md.'); process.exitCode = 1 }
} finally {
  if (server?.pid) {
    try { process.platform === 'win32' ? server.kill() : process.kill(-server.pid, 'SIGTERM') } catch { /* já encerrado */ }
  }
}
