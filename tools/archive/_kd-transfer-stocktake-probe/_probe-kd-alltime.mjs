import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'
const k = JSON.parse(readFileSync('./deploy/push/config.json','utf8')).kingdee
const cfg = { clientId:k.clientId, clientSecret:k.clientSecret, appKey:k.appKey||'', appSecret:k.appSecret||'',
  domain:k.domain, outerInstanceId:k.sandboxInstanceId||k.outerInstanceId||'' }
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain
const T = [['调拨单','/jdy/v2/scm/inv_tfmove'],['调拨出库','/jdy/v2/scm/inv_tfout'],['调拨入库','/jdy/v2/scm/inv_tfin'],
           ['盘点单','/jdy/v2/scm/inv_check_bill'],['盘盈单','/jdy/v2/scm/inv_check_gail_bill'],['盘亏单','/jdy/v2/scm/inv_check_loss_bill'],
           ['其他出库(对照)','/jdy/v2/scm/inv_other_out'],['采购入库(对照)','/jdy/v2/scm/pur_inbound']]
for (const [n,p] of T) {
  const all = await kingdeeTryGet(cfg, token, p, { page:1, pagesize:5 })
  const win = await kingdeeTryGet(cfg, token, p, { page:1, pagesize:5, begin_time:'2000-01-01', end_time:'2030-12-31' })
  console.log(`${n.padEnd(16)} 全量=${all.ok?(all.data?.total??all.data?.count??'?'):all.error}  超宽时间窗=${win.ok?(win.data?.total??win.data?.count??'?'):win.error}`)
}
process.exit(0)

