import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'
const k = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { ...k, outerInstanceId: (k.outerInstanceId || k.sandboxInstanceId || '').trim() }
const { token, domain } = await fetchAppToken(cfg)
const c = { ...cfg, domain }
// 最近 100 张采购入库单里,remark 带 [MES:TCGRK-0049] 的有几张?(重复入库就会 >1)
const r = await kingdeeTryGet(c, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '100' })
if (!r.ok) throw new Error(r.error)
const rows = r.data.rows || []
const hit = rows.filter((x) => String(x.remark || '').includes(process.argv[2] || 'TCGRK-0049'))
console.log(`最近返回 ${rows.length} 张;remark 含 [MES:' + (process.argv[2] || 'TCGRK-0049') + '] 的 = ${hit.length}`)
hit.forEach((x) => console.log(`  · bill_no=${x.bill_no} create_time=${x.create_time} remark=${JSON.stringify(x.remark)}`))
