// 手工新增检验单不受「是否过程检验」开关影响的 E2E 取证(2026-11-14)
// 用法:node tools/archive/_inv-proc-insp-20261114/verify-manual.mjs
// 说明:在测试账套(YJ_TEST)上跑;会真的建一张首件检验单草稿,跑完用 cleanup-manual.sql 清掉。
const BASE = 'http://127.0.0.1:8090'
async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 400) } }
  return { status: res.status, json }
}
const login = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ_TEST' } })
const token = login.json?.data?.token
console.log('login YJ_TEST:', login.status, 'factory=', login.json?.data?.user?.factory, 'token?', !!token)
if (!token) process.exit(1)

const lines = await api('/api/qc/firstInsp/woLines?pageNo=1&pageSize=20', { token })
const list = lines.json?.data?.list || []
console.log('首件检验「选生产工单」候选:', lines.status, 'totalSize=', lines.json?.data?.totalSize)
console.log(JSON.stringify(list.slice(0, 5).map((r) => ({ 工单号: r['工单号'], 工单行号: r['工单行号'], 产品编码: r['产品编码'], 生产状态: r['生产状态'], 可开单: r['可开单'] })), null, 2))

const asm = await api('/api/qc/asmInsp/woLines?pageNo=1&pageSize=5', { token })
console.log('出货检验表观「选生产工单」候选:', asm.status, 'totalSize=', asm.json?.data?.totalSize)

if (list.length > 0) {
  const pick = list[0]
  const create = await api('/api/qc/firstInsp/fromWoLine', {
    method: 'POST', token,
    body: { 工单号: pick['工单号'], 工单行号: pick['工单行号'] }
  })
  console.log('手工建首件检验单(商品开关=否):', create.status, JSON.stringify(create.json?.data || create.json).slice(0, 600))
} else {
  console.log('测试账套没有可选工单行,手工建单只做候选接口取证')
}
