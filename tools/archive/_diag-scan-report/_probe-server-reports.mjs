#!/usr/bin/env node
/**
 * 只读探针:服务器「报工记录」(WO_REPORT_LIST)最近 N 行,看手机端/小程序直写的行形状
 * (报工单号是否为空、工单行号/批次/产线是否被吸收补齐、工单状态是否 Y)。
 * 用法: node ... [baseUrl] [pageSize] [keyword]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const SIZE = process.argv[3] || '30'
const KW = process.argv[4] || ''
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }
const r = await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'WO_REPORT_LIST', keyword: KW, pageNo: 1, pageSize: Number(SIZE) }),
  signal: AbortSignal.timeout(60000),
})
const j = await r.json().catch(() => null)
console.log(`HTTP ${r.status}`, j?.message ?? '', 'total=', j?.data?.total)
const rows = j?.data?.rows ?? j?.data?.list ?? []
if (rows[0]) console.log('cols=', Object.keys(rows[0]).join('|'))
for (const x of rows) console.log(JSON.stringify(x))
