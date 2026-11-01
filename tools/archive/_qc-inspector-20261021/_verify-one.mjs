/**
 * 临时验证脚本(任务产物):在测试账套(YJ_TEST)上对指定制程检验单保存一次,
 * 然后回读表头「检验员」,验证后端 defaultQcInspector 的三种口径。
 * 用法:node _verify-one.mjs http://127.0.0.1:8091 ZC-2026-10-0030 "system(手机端报工吸收)"
 */
const [, , base = 'http://127.0.0.1:8091', code, inspector] = process.argv

const lr = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const token = (await lr.json())?.data?.token
if (!token) throw new Error('登录失败')

async function api(path, body) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json()
  if (j?.code && j.code !== 200) throw new Error(j.message)
  return j?.data ?? j
}

const desc = await api(`/api/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${encodeURIComponent(code)}`)
const form = { ...(desc.data || {}), detail: desc.detailData || {} }
form['检验员'] = inspector
await api('/api/px/callButton', { panelCode: 'QC_PROC_INSP', buttonName: '保存为草稿', formData: form })
const after = await api(`/api/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${encodeURIComponent(code)}`)
console.log(`提交「${inspector}」→ 保存后回读「${after.data?.['检验员'] ?? ''}」`)
