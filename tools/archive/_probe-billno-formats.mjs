// 只读:真实账套各类单据的编号格式(订单类 vs 执行类),验证「带 bill_no 直推」适用范围
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync('deploy/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
for (const [tag, path] of [
  ['采购订单', '/jdy/v2/scm/pur_order'],
  ['销售订单', '/jdy/v2/scm/sal_order'],
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
]) {
  try {
    const list = await kingdeeGet(cfg, token, path, { page: '1', page_size: '5' })
    const rows = list.rows || []
    console.log(`${tag}(近${rows.length}): ` + rows.map((r) => r.bill_no).join(', ') || '(空)')
  } catch (e) { console.log(`${tag}: 查询失败 ${e.message.split('\n')[0]}`) }
}
