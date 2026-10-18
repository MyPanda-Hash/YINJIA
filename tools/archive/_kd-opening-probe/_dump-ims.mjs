/**
 * 抓取金蝶当前现存量存成文件(供 _final-closure.mjs 用)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const rows = []
for (let page = 1; page <= 30; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  if (!r.ok) { console.log('失败:', r.error.slice(0, 100)); break }
  const rs = r.data.rows || []
  rows.push(...rs)
  if (rs.length < 500) break
  await new Promise((res) => setTimeout(res, 80))
}
const out = rows.map((r) => ({ wzdm: r.material_number, name: r.material_name, ckdm: r.stock_number,
  ckName: r.stockid_name, lot: r.batch_no || null, qty: Number(r.qty || 0) }))
mkdirSync(new URL('./_out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_out/ims-current.json', import.meta.url), JSON.stringify(out), 'utf8')
console.log(`现存量 ${rows.length} 行 → _out/ims-current.json,合计 ${out.reduce((s, r) => s + r.qty, 0).toFixed(2)}`)
