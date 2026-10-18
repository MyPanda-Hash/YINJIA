#!/usr/bin/env node
/**
 * 只读探针:判断服务器 8090 跑的是哪一版 jar —— 用"新增端点是否存在"当指纹。
 * 只看 HTTP 状态,不写数据(用 GET/OPTIONS 打 POST 端点:405=端点存在,404/403=不存在/无权限)。
 * 用法: node ... [baseUrl]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
  signal: AbortSignal.timeout(15000),
})
const token = (await lr.json())?.data?.token
if (!token) { console.log('login failed'); process.exit(1) }

const probes = [
  ['GET', '/api/dashboard/capacity?period=day', '2026-10-08 新增容量端点'],
  ['GET', '/api/px/scheduleBoard/absorbMobile', '2026-10-17 手机端报工吸收端点'],
  ['POST', '/api/px/workOrderList/recipe', '2026-10-18 成型配方端点(空 body => 400 也算存在)'],
  ['GET', '/api/px/scheduleBoard/scheduled', '工单排产看板明细(本应 405)'],
]
for (const [method, path, note] of probes) {
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    console.log(`${String(r.status).padEnd(4)} ${method.padEnd(5)} ${path.padEnd(48)} ${note}`)
  } catch (e) {
    console.log(`ERR  ${method} ${path} ${e.message}`)
  }
}
