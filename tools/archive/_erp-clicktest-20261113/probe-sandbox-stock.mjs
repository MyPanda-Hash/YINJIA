// 只读:盘点**金蝶沙箱**里"有库存"的 (商品编码, 仓库编码, 批号, 数量) —— 用来造能过金蝶库存校验的出库类单据。
// 用法(node 仓库根):node tools/archive/_erp-clicktest-20261113/probe-sandbox-stock.mjs [topN]
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from 'file:///D:/YINJIA-main/deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const topN = Number(process.argv[2] || 25)
const { token } = await fetchAppToken(cfg)
console.log('token OK; domain=' + cfg.domain + ' sandbox=' + (cfg.sandboxInstanceId || '(空)'))

const rows = []
for (let page = 1; page <= 20; page++) {
  const data = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  const list = data.rows || []
  if (!list.length) break
  rows.push(...list)
  if (list.length < 500) break
}
console.log('现存量行数 = ' + rows.length)
const pos = rows
  .map((r) => ({
    material: String(r.material_number || '').trim(),
    materialName: String(r.material_name || '').trim(),
    stock: String(r.stock_number || '').trim(),
    lot: String(r.batch_no || '').trim(),
    qty: Number(r.qty || 0),
  }))
  .filter((r) => r.material && r.stock && r.qty > 0)
  .sort((a, b) => b.qty - a.qty)
console.log('有库存组合 = ' + pos.length + ', TOP ' + topN + ':')
for (const r of pos.slice(0, topN)) console.log('  ' + r.material + ' | ' + r.materialName + ' | ' + r.stock + ' | lot=' + (r.lot || '(空)') + ' | qty=' + r.qty)
// 按仓库汇总,便于挑"某仓里有货"
const byStock = new Map()
for (const r of pos) byStock.set(r.stock, (byStock.get(r.stock) || 0) + 1)
console.log('按仓库(组合数): ' + JSON.stringify([...byStock.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)))

