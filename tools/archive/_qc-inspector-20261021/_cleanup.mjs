/**
 * 临时清理脚本(任务产物):删掉本次验证在测试账套新建的制程检验单草稿。
 * 用法:node _cleanup.mjs http://127.0.0.1:8091 ZC-2026-10-0030
 */
const [, , base = 'http://127.0.0.1:8091', code] = process.argv
const lr = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const token = (await lr.json())?.data?.token
const r = await fetch(`${base}/api/px/deleteForms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: 'QC_PROC_INSP', rowCodes: [code] }),
})
console.log(r.status, JSON.stringify(await r.json()).slice(0, 300))
