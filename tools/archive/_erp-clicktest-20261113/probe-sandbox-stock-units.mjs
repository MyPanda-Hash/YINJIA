// 只读:沙箱「有库存的商品×仓库」+ 指定商品的基本单位 + 可用客户,为补齐 3 张单据选档案。
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const raw = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee
const cfg = { ...raw, outerInstanceId: raw.outerInstanceId || raw.sandboxInstanceId }
const API_BASE = 'https://api.kingdee.com'
const AUTH_PATH = '/jdyconnector/app_management/push_app_authorize'
const TOKEN_PATH = '/jdyconnector/app_management/kingdee_auth_token'
const hmacHexLower = (key, msg) => createHmac('sha256', key).update(msg, 'utf8').digest('hex')
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const enc1 = (s) => encodeURIComponent(String(s))
const enc2 = (s) => encodeURIComponent(enc1(s))
let TOKEN = ''
const signPlain = (m, p, params, n, t) => [m.toUpperCase(), enc1(p),
  Object.keys(params).sort().map((k) => `${k}=${enc2(params[k])}`).join('&'),
  `x-api-nonce:${n}`, `x-api-timestamp:${t}`].join('\n') + '\n'
const headersFor = (m, p, params) => {
  const ts = String(Date.now())
  const nonce = String(Math.floor(Math.random() * 2147483646) + 1)
  const h = {
    'Content-Type': 'application/json', 'X-Api-ClientID': cfg.clientId, 'X-Api-Auth-Version': '2.0',
    'X-Api-TimeStamp': ts, 'X-Api-Nonce': nonce, 'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
    'X-Api-Signature': b64(hmacHexLower(cfg.clientSecret, signPlain(m, p, params, nonce, ts))),
    'X-GW-Router-Addr': cfg.domain,
  }
  if (TOKEN) h['app-token'] = TOKEN
  return h
}
const urlOf = (p, params) => `${API_BASE}${p}?` + Object.keys(params).sort().map((k) => `${k}=${enc1(params[k])}`).join('&')
const authJson = await (await fetch(urlOf(AUTH_PATH, { outerInstanceId: cfg.outerInstanceId }), { method: 'POST', headers: headersFor('POST', AUTH_PATH, { outerInstanceId: cfg.outerInstanceId }), body: '{}' })).json()
const hit = (Array.isArray(authJson.data) ? authJson.data : []).find((x) => String(x.status) === '1') || (authJson.data || [])[0]
const tokenParams = { app_key: hit.appKey, app_signature: b64(hmacHexLower(hit.appSecret, hit.appKey)) }
const tokJson = await (await fetch(urlOf(TOKEN_PATH, tokenParams), { headers: headersFor('GET', TOKEN_PATH, tokenParams) })).json()
TOKEN = tokJson.data['app-token']
const get = async (p, params) => (await (await fetch(urlOf(p, params), { headers: headersFor('GET', p, params) })).json())

// ① 现存量(有库存的组合)
const inv = []
for (let page = 1; page <= 8; page++) {
  const j = await get('/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  const rows = j?.data?.rows || []
  if (!rows.length) break
  inv.push(...rows)
  if (rows.length < 500) break
}
const pos = inv.map((r) => ({
  material: String(r.material_number || '').trim(), name: String(r.material_name || '').trim(),
  stock: String(r.stock_number || '').trim(), lot: String(r.batch_no || '').trim(), qty: Number(r.qty || 0),
})).filter((r) => r.material && r.stock && r.qty > 0).sort((a, b) => b.qty - a.qty)
console.log('现存量行=' + inv.length + ' 有货组合=' + pos.length)
for (const r of pos.slice(0, 15)) console.log('  ' + r.material + ' | ' + r.name + ' | ' + r.stock + ' | lot=' + (r.lot || '(空)') + ' | qty=' + r.qty)
const byStock = new Map()
for (const r of pos) byStock.set(r.stock, (byStock.get(r.stock) || 0) + 1)
console.log('按仓库(组合数): ' + JSON.stringify([...byStock.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)))

// ② 指定商品的基本单位
const mats = []
for (let page = 1; page <= 6; page++) {
  const j = await get('/jdy/v2/bd/material', { page: String(page), page_size: '200' })
  const rows = j?.data?.rows || []
  if (!rows.length) break
  mats.push(...rows)
  if (rows.length < 200) break
}
console.log('\n商品总数=' + mats.length)
const want = ['A-48-01', 'A-48-12', 'A-48-17', 'YJ-TS-004', 'C-95-39', 'CL004']
for (const w of want) {
  const m = mats.find((x) => x.number === w)
  console.log('  ' + w + ' → ' + (m ? `存在, base_unit_id=${m.base_unit_id} base_unit_number=${m.base_unit_number} base_unit_name=${m.base_unit_name} 批次管理=${m.is_batch}` : '不存在'))
}
// 前 8 个有库存的商品 + 它们的 base_unit
console.log('\n有库存商品的基本单位(前 10):')
for (const p of pos.slice(0, 10)) {
  const m = mats.find((x) => x.number === p.material)
  console.log('  ' + p.material + ' → ' + (m ? `base_unit_id=${m.base_unit_id} name=${m.base_unit_name} 批次=${m.is_batch}` : '(商品档案里没找到)'))
}

