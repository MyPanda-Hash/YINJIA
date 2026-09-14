/**
 * _walk-i18n.cjs — 抽取 recordSheetConfigs 各面板显示串,与 en.js biz 词条做差异
 * 用法: node tools/_walk-i18n.cjs [panelCode...]
 */
const fs = require('fs')
const path = require('path')

const cfgSrc = fs.readFileSync(path.join(__dirname, '../frontend/src/core/views/recordSheetConfigs.js'), 'utf8')
const tmp = path.join(__dirname, '_walk', '_rsc.cjs')
fs.mkdirSync(path.join(__dirname, '_walk'), { recursive: true })
fs.writeFileSync(tmp, cfgSrc.replace(/export const recordSheetConfigs\s*=/, 'const recordSheetConfigs =') + '\nmodule.exports = { recordSheetConfigs }\n', 'utf8')
const { recordSheetConfigs } = require(tmp)

// en.js biz 键
const enSrc = fs.readFileSync(path.join(__dirname, '../frontend/src/i18n/locales/en.js'), 'utf8')
const bizBlock = (enSrc.match(/biz:\s*\{([\s\S]*?)\n\s*\}/) || [])[1] || ''
const enKeys = new Set([...bizBlock.matchAll(/'([^']+)'\s*:/g)].map((m) => m[1]))

function collectFrom(cfg, acc) {
  const push = (s) => { if (typeof s === 'string' && s.trim()) acc.add(s) }
  for (const k of ['staticTitle', 'plainTitle', 'titlePlaceholder']) push(cfg[k])
  for (const it of cfg.info || []) push(it.label)
  for (const it of cfg.cover?.fields || []) push(it.label)
  for (const it of cfg.cover?.sign || []) push(it.label)
  for (const t of cfg.specTypes || []) push(t)
  for (const p of cfg.pages || []) push(p.title)
  for (const sec of cfg.sections || []) {
    push(sec.bar)
    for (const row of sec.rows || []) {
      push(row.label)
      if (row.grid) for (const c of row.grid) { push(c.label); push(c.fixed) }
      if (row.pairs) for (const p of row.pairs) { push(p.label); for (const c of p.cells || []) push(c.label) }
      if (row.stage) push(row.stage)
      if (row.label2) push(row.label2)
    }
  }
  for (const dt of cfg.dataTables || []) {
    push(dt.bar)
    for (const c of dt.cols || []) push(c.label)
  }
  for (const sec of cfg.tailSections || []) {
    push(sec.bar)
    for (const row of sec.rows || []) push(row.label)
  }
}

const panels = process.argv.slice(2)
const target = panels.length ? panels : Object.keys(recordSheetConfigs)
for (const pc of target) {
  const cfg = recordSheetConfigs[pc]
  if (!cfg) { console.log(pc + ': NO CONFIG'); continue }
  const acc = new Set()
  collectFrom(cfg, acc)
  const missing = [...acc].filter((s) => !enKeys.has(s)).sort()
  console.log('════════ ' + pc + ' ════════')
  console.log('total=' + acc.size + ' missing=' + missing.length)
  missing.forEach((s) => console.log('  MISS: ' + JSON.stringify(s)))
}
