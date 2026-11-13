// 只读:盘点**金蝶沙箱**的客户 / 商品(含基本单位) —— 补齐「销售出库缺客户、产品入库/材料出库缺基本单位」用。
// 用法(仓库根):node tools/archive/_erp-clicktest-20261113/probe-sandbox-master.mjs
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from 'file:///D:/YINJIA-main/deploy/kingdee-client.mjs'

const raw = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
// 沙箱没有 appKey/appSecret,只有 sandboxInstanceId ⇒ 与后端 dynamicInstanceId() 同口径:
// 把 sandboxInstanceId 当成 outerInstanceId 去取动态授权,否则 requestToken 用空 key 必失败。
const cfg = { ...raw, outerInstanceId: raw.outerInstanceId || raw.sandboxInstanceId }
const { token } = await fetchAppToken(cfg)
console.log('token OK; domain=' + cfg.domain + ' instance=' + cfg.outerInstanceId)

const dump = async (path, params, label, mapper, limit = 15) => {
  try {
    const data = await kingdeeTryGet(cfg, token, path, params)
    const rows = data.rows || []
    console.log(`\n== ${label} ==  共 ${rows.length} 行`)
    for (const r of rows.slice(0, limit)) console.log('  ' + mapper(r))
    return rows
  } catch (e) {
    console.log(`\n== ${label} ==  [失败] ${e.message}`)
    return []
  }
}

const cust = await dump('/jdy/v2/bd/customer', { page: '1', page_size: '50' }, '客户档案', (r) => `${r.number} | ${r.name} | id=${r.id}`)
await dump('/jdy/v2/bd/supplier', { page: '1', page_size: '20' }, '供应商档案', (r) => `${r.number} | ${r.name}`)
const mats = await dump('/jdy/v2/bd/material', { page: '1', page_size: '50' }, '商品档案',
  (r) => `${r.number} | ${r.name} | base_unit=${r.base_unit_id || r.base_unit_number || r.base_unit_name || '(空)'} | unit=${r.unit_id || r.unit_number || r.unit_name || ''} | id=${r.id}`)

// 商品的单位字段全貌(取一条看字段名)
if (mats.length) {
  console.log('\n== 商品首行全字段键 ==')
  console.log(Object.keys(mats[0]).join(', '))
  console.log(JSON.stringify(mats[0]).slice(0, 900))
}
console.log('\n客户数=' + cust.length + ' 商品数=' + mats.length)
