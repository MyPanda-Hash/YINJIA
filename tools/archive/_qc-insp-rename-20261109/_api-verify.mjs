/**
 * _api-verify.mjs — 跑一遍 8090 后端的接口级验收(改名 + 检验方案弹窗数据源 + PDF 报表标题)。
 * 只读(登录/取配置/取模板/取计划行/导出 PDF 到 .tmp),不写任何业务数据。
 */
import fs from 'node:fs'

const BASE = 'http://localhost:8090'
const OUT = 'D:/workspace/yinjia/.tmp/insp-rename-20261108'
const H = (tok, extra = {}) => ({ Authorization: 'Bearer ' + tok, 'Accept-Language': 'zh-CN', ...extra })

const results = {}
const log = (k, v) => { results[k] = v; console.log('### ' + k + ' => ' + JSON.stringify(v).slice(0, 800)) }

const loginRes = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const loginJson = await loginRes.json()
const token = loginJson?.data?.token
log('login', { http: loginRes.status, code: loginJson?.code, hasToken: !!token, msg: loginJson?.message })
if (!token) { console.log(JSON.stringify(results, null, 2)); process.exit(1) }

// ① 面板元数据:panelName(页签/左栏/导出名真源)
{
  const r = await fetch(BASE + '/api/px/getPanelConfig?panelCode=QC_PROC_INSP', { headers: H(token) })
  const j = await r.json()
  log('panelConfig', {
    http: r.status,
    panelName: j?.data?.metadata?.panelName,
    hasOld: JSON.stringify(j?.data?.metadata || {}).includes('制程检验单'),
    fieldCount: (j?.data?.fields || []).length,
  })
}

// ② 报表模板名(报表下拉/PDF·XLSX 文件名真源;DB 优先)
{
  const r = await fetch(BASE + '/api/report/templates?panelCode=QC_PROC_INSP', { headers: H(token) })
  const j = await r.json()
  log('reportTemplates', {
    http: r.status,
    templates: (j?.data || []).map((t) => ({ code: t.code, name: t.name })),
  })
}

// ③ 出货检验计划来源:检查频率 = 计划表「检测频率」是否真的下发(用有频率的产品 C-23-11)
{
  const r = await fetch(BASE + '/api/qc/inspPlan/fromShipPlan?productCode=C-23-11', { headers: H(token) })
  const j = await r.json()
  const rows = j?.data?.rows || []
  log('fromShipPlan', {
    http: r.status, planNo: j?.data?.planNo, rows: rows.length,
    rowsWithFreq: rows.filter((x) => String(x['检查频率'] || '').trim() !== '').length,
    freqSamples: rows.slice(0, 5).map((x) => ({ item: x['检验项目'], freq: x['检查频率'], actionLen: String(x['不合格应对措施'] || '').length })),
  })
}

// ④ PDF 报表标题(库内模板优先 → 应为「出货检验记录表」)
{
  const docNo = 'ZC-2026-11-0002'
  const r = await fetch(BASE + '/api/report/export?code=qc_proc_insp&panelCode=QC_PROC_INSP&docNo=' + encodeURIComponent(docNo) + '&format=pdf', { headers: H(token) })
  const buf = Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(OUT + '/report-' + docNo + '.pdf', buf)
  log('reportPdf', { http: r.status, contentType: r.headers.get('content-type'), bytes: buf.length, file: OUT + '/report-' + docNo + '.pdf' })
}

fs.writeFileSync(OUT + '/api-verify-result.json', JSON.stringify(results, null, 2), 'utf8')
console.log('SAVED ' + OUT + '/api-verify-result.json')
