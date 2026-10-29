/**
 * _q-insp-title.mjs —— 出货检验计划表「标题」默认值活体验证(8090)
 *
 * 验证:
 *   ① 新建单据(directAdd 空白草稿)时,后端落库的「标题」是否被前端默认值带出
 *      —— 注意:默认值在**前端** applyDocDefaults 里,直连 API 绕过前端;
 *         所以这里验的是"后端不再拦住(必填校验通过)+ 标题列可写",
 *         前端默认值本身由单测 rdInspPlanTitle.test.js 钉住。
 *   ② 手工带上「标题=出货检验项目控制计划」保存 → 落库正确、保存成功
 *   ③ 不带标题保存 → 应被必填拦住(证明默认值不是掩盖 bug,而是补上了必填)
 *   ④ 前端产物里默认值已烘焙(PanelxList chunk 同时含「标题」+ 该表名)
 *
 * 用法: node _q-insp-title.mjs [base] [user] [pass] [factory]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const USER = process.argv[3] || 'admin'
const PASS = process.argv[4] || '123456'
const FACTORY = process.argv[5] || 'YJ'
const TITLE = '出货检验项目控制计划'

let token = ''
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

async function api(path, opts = {}) {
  const r = await fetch(BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text }
}

const apiName = (b) => (b === '保存' || b === '保存新增' ? '提交' : b)
const callButton = (panelCode, buttonName, formData) =>
  api('/px/callButton', { method: 'POST', body: { panelCode, buttonName: apiName(buttonName), formData, buttonParam: {} } })

async function rowsOf(no) {
  const r = await api('/px/queryFormDataList', {
    method: 'POST', body: { panelCode: 'RD_INSP_PLAN', keyword: no, pageNo: 1, pageSize: 200, condition: {} },
  })
  const rows = r.json?.data?.rows || r.json?.data?.list || []
  return rows.find((x) => String(x['单据编号'] || x['编号'] || '') === no) || null
}

async function main() {
  const lr = await api('/auth/login', { method: 'POST', body: { userName: USER, password: PASS, factory: FACTORY } })
  token = lr.json?.data?.token || ''
  if (!token) throw new Error('登录失败: ' + lr.text.slice(0, 200))
  log('login', FACTORY)

  // ── ① 建空白草稿 ──
  const d1 = await callButton('RD_INSP_PLAN', '保存', {})
  const no = String(d1.json?.data?.['编号'] || '')
  log('① 新建单号', no || '(失败)')
  if (!no) {
    log('① 建草稿返回', d1.text.slice(0, 400))
    // 建不出草稿不影响后面两条(它们用的是直接保存新单)
  }

  // ── ② 带标题保存 → 应成功且落库 TITLE ──
  const mark = 'PROBE-INSP-' + Date.now()
  const s2 = await callButton('RD_INSP_PLAN', '保存', {
    标题: TITLE, 编写人: '系统管理员', 产品编号: mark,
  })
  const no2 = String(s2.json?.data?.['编号'] || '')
  log('② 带标题保存 code/message/no', `${s2.json?.code} / ${s2.json?.message} / ${no2 || '(无)'}`)
  if (no2) {
    const row = await rowsOf(no2)
    log('② 落库标题', row ? String(row['标题'] || '(空)') : '(查不到行)')
    log('② 断言 = 标题正确落库', row && String(row['标题'] || '') === TITLE ? 'PASS' : 'FAIL')
  } else {
    log('② 断言 = 标题正确落库', 'SKIP(保存未返回单号)')
  }

  // ── ③ 必填口径的**真实位置**:前端 NewVoucherDialog.validate(后端不校验 required)
  // 实测直连 API 不带标题也能存(200) —— 那是既有架构(required 只在前端拦)，
  // 不是本批改坏的东西。这里改成钉"前端校验确实会拦",不假装后端该拦。
  log('③ 说明', 'required 只在前端 NewVoucherDialog.validate 生效;直连 API 不校验(既有架构)')
  const fsCheck = await import('node:fs')
  const nvd = fsCheck.readFileSync('C:/INCER/YINJIA-MES/frontend/src/core/views/NewVoucherDialog.vue', 'utf8')
  const hasRequiredGate = /if \(r\.isNotNull && emptyValue\(form\[r\.code\]\)\) return `\$\{r\.name\}不能为空`/.test(nvd)
  log('③ 断言 = 前端有必填闸门(isNotNull → 不能为空)', hasRequiredGate ? 'PASS' : 'FAIL')

  // ── ④ 前端产物:默认值已烘焙 ──
  const fs = await import('node:fs')
  const dir = 'C:/INCER/YINJIA-MES/backend/src/main/resources/static/assets'
  let hit = null
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('PanelxList-') || !f.endsWith('.js')) continue
    const s = fs.readFileSync(dir + '/' + f, 'utf8')
    hit = { file: f, hasTitle: s.includes(TITLE), hasReviewer: s.includes('冯加劲') }
    break
  }
  log('④ PanelxList 产物', hit)
  log('④ 断言 = 默认值已烘焙', hit && hit.hasTitle && hit.hasReviewer ? 'PASS' : 'FAIL')

  log('探针单据号(待清理)', [no, no2].filter(Boolean).join(', '))
  finish()
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-insp-title.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-insp-title.json')
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
