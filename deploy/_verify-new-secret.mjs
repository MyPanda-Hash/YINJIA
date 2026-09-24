// 新 appSecret 即时验证:取 token + 一次只读 GET(单位档案 1 条)
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../deploy/kingdee-client.mjs'
const cfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
console.log('token OK(domain=' + cfg.domain + ')')
const d = await kingdeeGet(cfg, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '1' })
console.log('只读 GET OK,单位档案可访问(rows=' + (d.rows || []).length + ')')
