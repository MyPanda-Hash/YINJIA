// 只读:直接打印金蝶沙箱几个基础资料接口的**原始返回**(判断是路径错、参数错还是真没数据)。
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
const signPlain = (method, path, params, nonce, ts) => [
  method.toUpperCase(), enc1(path),
  Object.keys(params).sort().map((k) => `${k}=${enc2(params[k])}`).join('&'),
  `x-api-nonce:${nonce}`, `x-api-timestamp:${ts}`].join('\n') + '\n'
const headersFor = (method, path, params) => {
  const ts = String(Date.now())
  const nonce = String(Math.floor(Math.random() * 2147483646) + 1)
  return {
    'Content-Type': 'application/json',
    'X-Api-ClientID': cfg.clientId,
    'X-Api-Auth-Version': '2.0',
    'X-Api-TimeStamp': ts,
    'X-Api-Nonce': nonce,
    'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
    'X-Api-Signature': b64(hmacHexLower(cfg.clientSecret, signPlain(method, path, params, nonce, ts))),
    'X-GW-Router-Addr': cfg.domain,
    'app-token': token,
  }
}
const urlOf = (path, params) => `${API_BASE}${path}?` + Object.keys(params).sort().map((k) => `${k}=${enc1(params[k])}`).join('&')

// ① 动态授权(用 sandboxInstanceId)
const authParams = { outerInstanceId: cfg.outerInstanceId }
const authRes = await fetch(urlOf(AUTH_PATH, authParams), { method: 'POST', headers: headersFor('POST', AUTH_PATH, authParams), body: '{}' })
const authJson = await authRes.json()
const hit = (Array.isArray(authJson.data) ? authJson.data : []).find((x) => String(x.status) === '1') || (authJson.data || [])[0]
if (!hit?.appKey) { console.log('AUTH_RAW ' + JSON.stringify(authJson).slice(0, 400)); process.exit(1) }
// ② token
const tokenParams = { app_key: hit.appKey, app_signature: b64(hmacHexLower(hit.appSecret, hit.appKey)) }
const tokRes = await fetch(urlOf(TOKEN_PATH, tokenParams), { headers: headersFor('GET', TOKEN_PATH, tokenParams) })
const tokJson = await tokRes.json()
const token = tokJson?.data?.['app-token']
console.log('token=' + (token ? token.slice(0, 12) + '...' : '(空)'))

for (const path of ['/jdy/v2/bd/material', '/jdy/v2/bd/customer', '/jdy/v2/bd/measure_unit', '/jdy/v2/bd/store', '/jdy/v2/bd/emp']) {
  const params = { page: '1', page_size: '3' }
  const res = await fetch(urlOf(path, params), { headers: headersFor('GET', path, params) })
  const text = await res.text()
  let rows = null
  try { rows = JSON.parse(text)?.data?.rows?.length } catch (e) { /* ignore */ }
  console.log('\n== ' + path + ' → HTTP ' + res.status + ' rows=' + rows)
  console.log(text.slice(0, 500))
}

