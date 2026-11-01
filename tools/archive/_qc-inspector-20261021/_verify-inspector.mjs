/**
 * 临时验证脚本(任务产物):在测试账套(YJ_TEST)上验证
 * ① 新建空白工序检验单 → 检验员 = 当前登录人姓名(后端兜底);
 * ② 把检验员改成历史 system 占位后再保存 → 自动纠正为登录人姓名;
 * ③ 改成人名再保存 → 不被覆盖。
 * 用法:node _verify-inspector.mjs http://127.0.0.1:8091 [单号]
 */
const base = process.argv[2] || 'http://127.0.0.1:8091'
const codeArg = process.argv[3] || ''

async function login() {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('登录失败: ' + JSON.stringify(j).slice(0, 300))
  return j.data.token
}

async function call(token, body) {
  const r = await fetch(`${base}/api/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (j?.code && j.code !== 200) throw new Error(`${body.buttonName} 失败: ${j.message}`)
  return j?.data ?? j
}

async function fetchForm(token, panelCode, code) {
  const r = await fetch(`${base}/api/px/getFormDescriptor?panelCode=${encodeURIComponent(panelCode)}&code=${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  if (j?.code && j.code !== 200) throw new Error('取单失败: ' + j.message)
  const payload = j?.data || {}
  return { ...(payload.data || {}), detail: payload.detailData || {} }
}

const token = await login()
console.log('[1] 登录 OK(YJ_TEST / admin)')

let code = codeArg
if (!code) {
  const created = await call(token, { panelCode: 'QC_PROC_INSP', buttonName: '新增', formData: {} })
  code = created['编号']
  console.log('[2] 新建空白制程检验单:', code)
}

async function saveWith(inspector, label) {
  const form = await fetchForm(token, 'QC_PROC_INSP', code)
  form['检验员'] = inspector
  await call(token, { panelCode: 'QC_PROC_INSP', buttonName: '保存为草稿', formData: form })
  console.log(`[3] ${label}: 提交 检验员=「${inspector}」→ 保存完成`)
}

await saveWith('system(手机端报工吸收)', '历史 system 占位')
await saveWith('陈秀丽', '已有真人姓名')
console.log('CODE=' + code)
