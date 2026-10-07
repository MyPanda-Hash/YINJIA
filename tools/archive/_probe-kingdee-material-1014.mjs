/**
 * 只读探针(2026-10-14):核对「材料出库单转ERP 报 第1行基础资料[物料编码]字段不能为空」的成因。
 *
 * 做法(全程只读,不推送、不写库):
 *   ① 按 deploy/push/config.json(当前=测试沙箱,动态授权)取 app-token;
 *   ② 拉目标账套 商品档案 /jdy/v2/bd/material 建 编码→id 索引(与后端 materialMap 同口径,分页 page_size=200);
 *   ③ 查该账套里有没有 MES 单据上的 材料编码(默认 B-47-29),并列几条样本编码对照;
 *   ④ 顺带核对 单位档案(支)/ 仓库档案,确认同一张单其它 *_id 能不能解析。
 *
 * 用法: node tools/archive/_probe-kingdee-material-1014.mjs [材料编码...]
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs'

const cfgPath = path.resolve(process.argv.includes('--cfg')
  ? process.argv[process.argv.indexOf('--cfg') + 1]
  : 'deploy/push/config.json')
const cfgRaw = JSON.parse(readFileSync(cfgPath, 'utf8'))
const cfg = { ...cfgRaw.kingdee }
console.log('[配置] 目标 =', cfg.outerInstanceId ? '真实账套' : '测试沙箱',
  '| clientId =', cfg.clientId, '| outerInstanceId =', cfg.outerInstanceId || '(空)',
  '| sandboxInstanceId =', cfg.sandboxInstanceId ? '(已配)' : '(空)', '| domain =', cfg.domain)

// ⚠ deploy/kingdee-client.mjs 的 fetchAppToken 只在 outerInstanceId 非空时走动态授权;
//   沙箱配置(outerInstanceId 空、appKey/appSecret 空、sandboxInstanceId 有值)会拿空密钥去换 token。
//   后端 KingdeePushService 支持 sandboxInstanceId 动态授权(2026-10-04 修),这里用同口径复刻:
//   把 sandboxInstanceId 当 outerInstanceId 传进去 → 取最新 appKey/appSecret/domain。
const authCfg = { ...cfg, outerInstanceId: cfg.outerInstanceId || cfg.sandboxInstanceId }
if (!cfg.outerInstanceId && !cfg.sandboxInstanceId) throw new Error('配置里既无 outerInstanceId 也无 sandboxInstanceId,无法取授权')
const { token, domain } = await fetchAppToken(authCfg)
if (!token) throw new Error('未取到 app-token')
console.log('[token] 已获取,长度 =', String(token).length, '| domain =', domain)
const call = (path0, params) => kingdeeGet({ ...cfg, domain }, token, path0, params)

// ① 商品档案(number → id)
const byNumber = new Map()
let page = 0
for (; page < 30; page++) {
  const res = await call('/jdy/v2/bd/material', { page: String(page + 1), page_size: '200' })
  const rows = res?.data?.rows || res?.rows || []
  for (const r of rows) if (r.number) byNumber.set(String(r.number).trim(), String(r.id || ''))
  if (rows.length < 200) break
}
console.log(`[商品档案] 目标账套共 ${byNumber.size} 个商品(拉了 ${page + 1} 页)`)
const sample = [...byNumber.keys()].slice(0, 12)
console.log('[商品档案] 前 12 个编码 =', JSON.stringify(sample))

// ② 待查编码(默认取 MES 那张单上的材料编码);--cfg <路径> 是选项,不算编码
const codes = []
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--cfg') { i++; continue }
  codes.push(process.argv[i])
}
if (!codes.length) codes.push('B-47-29')
for (const c of codes) {
  const hit = byNumber.get(c)
  console.log(`[核对] 材料编码 ${c} → ${hit ? '存在,material_id=' + hit : '❌ 目标账套商品档案里没有 ⇒ 推 material_number 无意义(material_id 解析不到)'}`)
}

// ③ 同一张单其它 *_id 族能不能解析(单位「支」/ 仓库)
const units = await call('/jdy/v2/bd/measure_unit', { page: '1', page_size: '200' })
const unitRows = units?.data?.rows || units?.rows || []
const u = unitRows.find((r) => String(r.name || '').trim() === '支')
console.log(`[单位档案] 共 ${unitRows.length} 条;「支」→ ${u ? 'unit_id=' + u.id : '❌ 没有'}`)
const stores = await call('/jdy/v2/bd/store', { page: '1', page_size: '200' })
const storeRows = stores?.data?.rows || stores?.rows || []
console.log(`[仓库档案] 共 ${storeRows.length} 条;全部编码 =`, JSON.stringify(storeRows.map((r) => r.number)))
// 该单行上 仓库编码 为空 ⇒ 后端会兜底推默认正品仓 CK00001(见 KingdeePushService L374):核对它是否真存在
const ck = storeRows.find((r) => String(r.number || '').trim() === 'CK00001')
console.log(`[仓库档案] 默认兜底仓 CK00001 → ${ck ? 'stock_id=' + ck.id : '❌ 目标账套没有(兜底会推一个不存在的仓,金蝶会报"请填写材料分录第N行仓库")'}`)
// 目标账套商品档案里有没有 B- 族(该单的材料编码族),看是不是整族缺失
const bFam = [...byNumber.keys()].filter((k) => k.startsWith('B-'))
console.log(`[商品档案] B- 族编码 ${bFam.length} 个`, bFam.length ? JSON.stringify(bFam.slice(0, 10)) : '(整族缺失)')
