/**
 * _q-docno.mjs —— 2026-10-28「编号」格活体验证(8090)
 *
 * 用户口径(选 A):
 *   「把这个默认的编号去掉，只保留背景提示词：请填写编号」
 *   + 「为什么其他的没有系统自动发的单据号，把其他的两个也改为在新增的时候，系统自动发单据号」
 *
 * 实测事实:四张受控文件**本来都已自动发单号**,问题只在出货检验计划表的纸面那一格
 * 绑了 文档编号(库里有 DEFAULT N'YJ-RD001')而不是真实单号。
 *
 * 验证:
 *   ① RD_INSP_PLAN 面板配置里**不再下发**「文档编号」header 字段 ⇒ 前端 docNoKeyOf 落到「单据编号」
 *   ② 新建一张单:单据编号 = IP-… 自动发号;文档编号 不再被默认成 YJ-RD001
 *   ③ 四张受控文件的自动号格式都正常(对照:成型 MP- / 组装 AP- / 规格书 SD- / 检验 IP-)
 *   ④ 前端产物:DocSheet/RecordSheetPanels 的提示词已改成「请输入编号」,且不再有 YJ-PD-01/YJ-XS002 兜底
 *
 * 用法: node _q-docno.mjs [base] [user] [pass] [factory]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const USER = process.argv[3] || 'admin'
const PASS = process.argv[4] || '123456'
const FACTORY = process.argv[5] || 'YJ'

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

async function main() {
  const lr = await api('/auth/login', { method: 'POST', body: { userName: USER, password: PASS, factory: FACTORY } })
  token = lr.json?.data?.token || ''
  if (!token) throw new Error('登录失败: ' + lr.text.slice(0, 200))
  log('login', FACTORY)

  // ── ① 面板配置:文档编号 是否还**可见**(hidden=1 ⇒ 不上纸/不进 head) ──
  const cfg = (await api('/px/getPanelConfig?panelCode=RD_INSP_PLAN')).json?.data || {}
  const fields = cfg.dataSchema?.fields || []
  const docNoF = fields.find((f) => (f.dataName || f.label || f.code) === '文档编号')
  const billNoF = fields.find((f) => (f.dataName || f.label || f.code) === '单据编号')
  log('① 「文档编号」字段', docNoF ? { hidden: docNoF.hidden === true } : '(未下发)')
  log('① 「单据编号」字段', billNoF ? { hidden: billNoF.hidden === true } : '(未下发)')
  // 关键:文档编号必须 hidden=true（不再进 headerFields ⇒ head 里无该键 ⇒ docNoKeyOf 落到单据编号）
  const docHidden = !docNoF || docNoF.hidden === true
  const billVisible = !!billNoF && billNoF.hidden !== true
  log('① 断言 = 文档编号已隐藏、单据编号可见',
    (docHidden && billVisible) ? 'PASS' : 'FAIL')

  // ── ② 新建一张单:自动发号 + 文档编号 不再被默认 ──
  const mark = 'PROBE-DOCNO-' + Date.now()
  const s1 = await callButton('RD_INSP_PLAN', '保存', {
    标题: '出货检验项目控制计划', 编写人: '系统管理员', 产品编号: mark,
  })
  const no = String(s1.json?.data?.['编号'] || '')
  log('② 新建返回 code / 单号', `${s1.json?.code} / ${no || '(无)'}`)
  log('② 断言 = 单号是 IP- 自动号', /^IP-\d{4}-\d{2}-\d{4}$/.test(no) ? 'PASS' : 'FAIL')

  if (no) {
    const rows = (await api('/px/queryFormDataList', {
      method: 'POST', body: { panelCode: 'RD_INSP_PLAN', keyword: no, pageNo: 1, pageSize: 200, condition: {} },
    })).json?.data?.list || []
    const row = rows.find((x) => String(x['单据编号'] || '') === no) || {}
    log('② 行上的「文档编号」', String(row['文档编号'] ?? '(无该键)'))
    const docNo = String(row['文档编号'] ?? '')
    log('② 断言 = 不再是 YJ-RD001', docNo !== 'YJ-RD001' ? 'PASS' : 'FAIL')
  }

  // ── ③ 四张受控文件的自动号格式(证明"其他三个也有自动号") ──
  const expect = { RD_INSP_PLAN: 'IP', RD_MOLD_PROC: 'MP', RD_ASM_PROC: 'AP', RD_SPEC_DOC: 'SD' }
  for (const [panel, pfx] of Object.entries(expect)) {
    const rows = (await api('/px/queryFormDataList', {
      method: 'POST', body: { panelCode: panel, pageNo: 1, pageSize: 5, condition: {} },
    })).json?.data?.list || []
    const nos = rows.map((r) => String(r['单据编号'] || '')).filter(Boolean)
    const ok = nos.length > 0 && nos.every((n) => n.startsWith(pfx + '-'))
    log(`③ ${panel} 自动号样例 / 前缀 ${pfx}`, `${nos.slice(0, 3).join(',') || '(无)'} → ${ok ? 'PASS' : 'FAIL'}`)
  }

  // ── ④ 前端产物 ──
  const fs = await import('node:fs')
  const dir = 'C:/INCER/YINJIA-MES/backend/src/main/resources/static/assets'
  let rsp = null, ds = null
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('RecordSheetPanels-') && f.endsWith('.js') && !rsp) {
      const s = fs.readFileSync(dir + '/' + f, 'utf8')
      rsp = { file: f, hasEnter: s.includes('请输入编号'), hasFake1: s.includes('YJ-PD-01') }
    }
    if (f.startsWith('PanelxList-') && f.endsWith('.js') && !ds) {
      const s = fs.readFileSync(dir + '/' + f, 'utf8')
      ds = { file: f, hasEnter: s.includes('请输入编号'), hasFakeXs: s.includes('YJ-XS002') }
    }
  }
  log('④ RecordSheetPanels 产物', rsp)
  log('④ PanelxList(DocSheet) 产物', ds)
  log('④ 断言 = 提示词已换、假号兜底已清',
    rsp && ds && rsp.hasEnter && ds.hasEnter && !rsp.hasFake1 && !ds.hasFakeXs ? 'PASS' : 'FAIL')

  log('探针单据号(待清理)', no)
  finish()
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-docno.json')
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
