// 沙箱补建计量单位「张」(POST /jdy/v2/bd/measure_unit;幂等:已存在则跳过)
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet, kingdeePost } from './kingdee-client.mjs'

const cfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)

const PATH = '/jdy/v2/bd/measure_unit'
const data = await kingdeeGet(cfg, token, PATH, { page: '1', page_size: '100' })
const hit = (data.rows || []).find((r) => r.name === '张' || r.number === '张')
if (hit) { console.log('已存在:name=' + hit.name + ' id=' + hit.id + ',无需创建'); process.exit(0) }

const r = await kingdeePost(cfg, token, PATH, {}, { number: '张', name: '张' })
console.log(JSON.stringify(r))
if (!r.ok) process.exit(1)
// 回读确认
const after = await kingdeeGet(cfg, token, PATH, { page: '1', page_size: '100' })
const z = (after.rows || []).find((x) => x.name === '张')
console.log(z ? `建成:name=${z.name} id=${z.id}` : '回读未见(可能需账套后台刷新)')
