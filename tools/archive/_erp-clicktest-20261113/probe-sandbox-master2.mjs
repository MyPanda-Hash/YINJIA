// 只读:盘点**金蝶沙箱**基础资料(客户/商品/单位/仓库/职员) —— 带 app-token 头(金蝶网关要它,否则 404)。
// 用法(仓库根):node tools/archive/_erp-clicktest-20261113/probe-sandbox-raw.mjs
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
const signPlain = (method, path, params, nonce, ts) => [
  method.toUpperCase(), enc1(path),
  Object.keys(params).sort().map((k) => `${k}=${enc2(params[k])}`).join('&'),
  `x-api-nonce:${nonce}`, `x-api-timestamp:${ts}`].join('\n') + '\n'
const headersFor = (method, path, params) => {
  const ts = String(Date.now())
  const nonce = String(Math.floor(Math.random() * 2147483646) + 1)
  const h = {
    'Content-Type': 'application/json',
    'X-Api-ClientID': cfg.clientId,
    'X-Api-Auth-Version': '2.0',
    'X-Api-TimeStamp': ts,
    'X-Api-Nonce': nonce,
    'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
    'X-Api-Signature': b64(hmacHexLower(cfg.clientSecret, signPlain(method, path, params, nonce, ts))),
    'X-GW-Router-Addr': cfg.domain,
  }
  if (TOKEN) h['app-token'] = TOKEN
  return h
}
const urlOf = (path, params) => `${API_BASE}${path}?` + Object.keys(params).sort().map((k) => `${k}=${enc1(params[k])}`).join('&')

// ① 动态授权(sandboxInstanceId 当 outerInstanceId,与后端 dynamicInstanceId() 同口径)
const authParams = { outerInstanceId: cfg.outerInstanceId }
const authJson = await (await fetch(urlOf(AUTH_PATH, authParams), { method: 'POST', headers: headersFor('POST', AUTH_PATH, authParams), body: '{}' })).json()
const hit = (Array.isArray(authJson.data) ? authJson.data : []).find((x) => String(x.status) === '1') || (authJson.data || [])[0]
if (!hit?.appKey) { console.log('AUTH_RAW ' + JSON.stringify(authJson).slice(0, 300)); process.exit(1) }
// ② token
const tokenParams = { app_key: hit.appKey, app_signature: b64(hmacHexLower(hit.appSecret, hit.appKey)) }
const tokJson = await (await fetch(urlOf(TOKEN_PATH, tokenParams), { headers: headersFor('GET', TOKEN_PATH, tokenParams) })).json()
TOKEN = tokJson?.data?.['app-token'] || ''
console.log('token=' + (TOKEN ? TOKEN.slice(0, 10) + '...' : '(空)') + ' domain=' + cfg.domain)

const get = async (path, params) => {
  const res = await fetch(urlOf(path, params), { headers: headersFor('GET', path, params) })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch (e) { return { status: res.status, json: null, text } }
}

const rowsOf = async (path, label, pageSize = '20') => {
  const r = await get(path, { page: '1', page_size: pageSize })
  const data = r.json?.data
  const rows = (data && (data.rows || data)) || []
  const list = Array.isArray(rows) ? rows : []
  console.log('\n== ' + label + ' (' + path + ') → HTTP ' + r.status + ' errcode=' + (r.json?.errcode ?? '?') + ' 行数=' + list.length)
  if (!list.length) console.log('   ' + (r.json ? JSON.stringify(r.json).slice(0, 300) : (r.text || '').slice(0, 300)))
  return list
}

const units = await rowsOf('/jdy/v2/bd/measure_unit', '计量单位', '50')
for (const u of units.slice(0, 10)) console.log('   ' + (u.number || '') + ' | ' + (u.name || '') + ' | id=' + (u.id || ''))
const stores = await rowsOf('/jdy/v2/bd/store', '仓库', '50')
for (const s of stores.slice(0, 10)) console.log('   ' + (s.number || '') + ' | ' + (s.name || '') + ' | id=' + (s.id || ''))
const custs = await rowsOf('/jdy/v2/bd/customer', '客户', '50')
for (const c of custs.slice(0, 10)) console.log('   ' + (c.number || '') + ' | ' + (c.name || '') + ' | id=' + (c.id || ''))
const mats = await rowsOf('/jdy/v2/bd/material', '商品', '30')
for (const m of mats.slice(0, 12)) {
  console.log('   ' + (m.number || '') + ' | ' + (m.name || '') + ' | base_unit=' + (m.base_unit_id || m.base_unit_number || m.base_unit_name || '(空)')
    + ' | unit=' + (m.unit_id || m.unit_number || m.unit_name || '') + ' | 单位档案=' + JSON.stringify(m.base_unit || m.unit || ''))
}
if (mats.length) console.log('\n商品首行字段键: ' + Object.keys(mats[0]).join(', '))
