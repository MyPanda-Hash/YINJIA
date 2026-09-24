// 只读:真实账套采购订单 YJ-20260915-10 明细的规格型号(Y-GL-300400 行金蝶侧有没有)
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs'
const cfg = JSON.parse(readFileSync('deploy/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: 'YJ-20260915-10' })
const bill = (list.rows || []).find((r) => r.bill_no === 'YJ-20260915-10')
if (!bill) { console.log('真实账套未找到该订单'); process.exit(0) }
const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: bill.id })
for (const e of (d.material_entity || [])) {
  console.log(`seq=${e.seq} material=${e.material_number ?? e.material_name} model=${JSON.stringify(e.material_model ?? e.model ?? null)}`)
}
