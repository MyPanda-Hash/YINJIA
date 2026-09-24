// 沙箱采购订单 YJ-20260909-01 实况:列表定位 + 详情行(看它是否带分录、能否被入库单挂联)
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '50' })
console.log('沙箱采购订单共', (list.rows || []).length, '张(近50):')
for (const r of (list.rows || [])) console.log(' ', r.bill_no, '| date=' + r.bill_date, '| supplier=' + (r.supplier_name || '-'), '| remark=' + String(r.remark || '').slice(0, 30))
const hit = (list.rows || []).find((r) => r.bill_no === 'YJ-20260909-01')
if (hit) {
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: hit.id })
  console.log('\n→ YJ-20260909-01 详情:id=' + hit.id + ',明细 ' + (d.material_entity || []).length + ' 行:')
  for (const e of (d.material_entity || [])) {
    console.log(`   seq=${e.seq} id=${e.id} material=${e.material_number ?? e.material_name ?? '-'} qty=${e.qty} price=${e.price} unit_id=${e.unit_id}`)
  }
} else {
  console.log('\n→ 列表未见 YJ-20260909-01?!')
}
