/**
 * _dump-cfg.mjs — 抓 STOCK_LEDGER / STOCK_SUMMARY 的面板配置(真接口),落盘供口径比对。
 * 用法: node tools/archive/_stockreport-dialog-1020/_dump-cfg.mjs [http://127.0.0.1:8090]
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

for (const code of ['STOCK_LEDGER', 'STOCK_SUMMARY']) {
  const cfg = await (await fetch(`${host}/api/px/getPanelConfig?panelCode=${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  writeFileSync(join(OUT, `cfg-${code}.json`), JSON.stringify(cfg.data, null, 2))
  const md = cfg.data?.metadata || {}
  const tp = md.panelPageDto?.tablePages?.[0] || {}
  const grid = (tp.gridTabs || [])[0] || {}
  console.log(`=== ${code} ===`)
  console.log(`  reportQueryDialog=${md.reportQueryDialog} panelCategory=${md.panelCategory}`)
  console.log(`  queryFields: ${(tp.queryFields || []).map((f) => `${f.dataName}[${f.dataType}${f.refPanel ? '→' + f.refPanel : ''}]`).join(' , ')}`)
  console.log(`  gridTabs.columns: ${(grid.columns || []).join(' | ')}`)
  console.log(`  dataSchema.fields: ${(cfg.data?.dataSchema?.fields || []).filter((f) => !f.hidden).map((f) => `${f.dataName}[${f.dataType}]`).join(' , ')}`)
  console.log(`  formPages: ${JSON.stringify((md.formPages || []).map((p) => p.fieldNames))}`)
}
