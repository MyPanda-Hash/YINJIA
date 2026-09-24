// 沙箱补建计量单位(参数化,幂等:已存在则跳过):node _add-sandbox-unit.mjs 套
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet, kingdeePost } from './kingdee-client.mjs'

const name = process.argv[2]
if (!name) { console.error('用法: node _add-sandbox-unit.mjs <单位名>'); process.exit(2) }
const cfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const PATH = '/jdy/v2/bd/measure_unit'
const data = await kingdeeGet(cfg, token, PATH, { page: '1', page_size: '100' })
const hit = (data.rows || []).find((r) => r.name === name || r.number === name)
if (hit) { console.log(`已存在:${name} id=${hit.id}`); process.exit(0) }
const r = await kingdeePost(cfg, token, PATH, {}, { number: name, name })
if (!r.ok) { console.error(JSON.stringify(r)); process.exit(1) }
const after = await kingdeeGet(cfg, token, PATH, { page: '1', page_size: '100' })
const u = (after.rows || []).find((x) => x.name === name)
console.log(u ? `建成:${name} id=${u.id}` : '回读未见')
console.log('沙箱单位档案现共', (after.rows || []).length, '个:', (after.rows || []).map((x) => x.name).join('、'))
