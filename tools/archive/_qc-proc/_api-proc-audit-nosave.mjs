/**
 * _api-proc-audit-nosave.mjs — 复现「未保存直接审核」:新增即审核(中间不保存),看后端到底报什么。
 * ⚠ 只在**测试账套**(factory=YJ_TEST)上写;跑完清理。
 */
import crypto from 'node:crypto'
const api = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256' })
const b = b64({ sub: 'admin', factory: 'YJ_TEST', iat: now, exp: now + 3600 })
const tk = `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
const post = async (p, body) => (await fetch(api + p, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
const btn = (buttonName, formData) => post('/px/callButton', { panelCode: 'QC_PROC_INSP', buttonName, formData, buttonParam: {} }, tk)

const mk = await btn('新增流程', {})
const no = mk.data?.编号 || mk.data?.单据编号 || ''
console.log('新增:', JSON.stringify(mk))
console.log('新增返回的完整 data 键:', Object.keys(mk.data || {}).join(','))
const aud = await btn('审核', { 编号: no })
console.log('未保存直接审核:', JSON.stringify(aud))
const del = await btn('删除', { 编号: no })
console.log('清理:', JSON.stringify(del).slice(0, 120))
