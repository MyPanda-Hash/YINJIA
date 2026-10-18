/** 探针:确认这几个列表接口认哪个日期过滤参数(只读)。用法:node deploy/_probe-kd-datefilter.mjs */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { clientId: k.clientId, clientSecret: k.clientSecret, appKey: k.appKey || '',
  appSecret: k.appSecret || '', domain: k.domain, outerInstanceId: k.outerInstanceId || '' }
const { token, domain } = await fetchAppToken(cfg)
cfg.domain = domain

const total = (r) => (r.ok ? (r.data?.total ?? r.data?.count) : r.error)

for (const [n, p] of [['调拨单', '/jdy/v2/scm/inv_tfmove'], ['盘点单', '/jdy/v2/scm/inv_check_bill']]) {
  const variants = {
    'base(no filter)': {},
    'start_date/end_date': { start_date: '2026-09-01', end_date: '2030-12-31' },
    'begin_time/end_time(yyyy-MM-dd)': { begin_time: '2026-09-01', end_time: '2030-12-31' },
    'start_time/end_time(timestamp)': { start_time: '1788220800', end_time: '1924992000' },
    'bill_date_start/end': { bill_date_start: '2026-09-01', bill_date_end: '2030-12-31' },
    'modify_time_start/end': { modify_time_start: '2026-09-01 00:00:00', modify_time_end: '2030-12-31 23:59:59' },
  }
  console.log('=== ' + n + ' ===')
  for (const [label, extra] of Object.entries(variants)) {
    const r = await kingdeeTryGet(cfg, token, p, { page: 1, pagesize: 1, ...extra })
    console.log(`  ${label.padEnd(34)} -> ${total(r)}`)
  }
}
process.exit(0)
