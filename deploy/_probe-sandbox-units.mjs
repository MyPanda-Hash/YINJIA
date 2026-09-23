// 沙箱账套计量单位档案盘点(只读):确认「张」是否存在 + 单位id 对照
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs'

const cfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
console.log('token 获取 OK(domain=' + cfg.domain + ')')
const data = await kingdeeGet(cfg, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '100' })
const rows = data.rows || []
console.log('沙箱单位档案共', rows.length, '个:')
for (const r of rows) console.log(' ', r.number || r.name, '| name=' + r.name, '| id=' + r.id, '| status=' + (r.status ?? ''))
const hit = rows.find((r) => r.name === '张' || r.number === '张')
console.log(hit ? `「张」存在: id=${hit.id}` : '「张」不存在 ← 这就是报错原因')
