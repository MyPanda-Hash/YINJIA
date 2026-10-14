/**
 * A4 数据准备 · 只读取证(不改库)
 *   1) 登录(factory=YJ_TEST ⇒ HSDZ_MES_TEST)
 *   2) 三个面板的字段元数据(label/col/place/seq/required/editable) —— 决定载荷键与明细列
 *   3) 现役单据抽样(确认 detail 键与已有写法)
 * 用法: node tools/archive/_a4-inspect.cjs
 * 输出: UTF-8 文件 tools/archive/_a4-inspect.out.txt
 */
const fs = require('fs')
const path = require('path')

const BASE = process.env.A4_BASE || 'http://127.0.0.1:8090'
const OUT = path.join(__dirname, '_a4-inspect.out.txt')
const lines = []
const p = (s) => { lines.push(String(s)) }

let TOKEN = ''

async function api(method, url, body) {
  const r = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const txt = await r.text()
  let j = null
  try { j = JSON.parse(txt) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: txt }
}

async function login(userName, password, factory) {
  const r = await api('POST', '/api/auth/login', { userName, password, factory })
  if (!r.json || r.json.code !== 200) throw new Error('登录失败 ' + r.status + ' ' + r.text.slice(0, 300))
  return r.json.data.token
}

function dumpPanel(cfg) {
  const f = cfg.fields || cfg.fieldList || []
  p(`  面板 ${cfg.panelCode || cfg.code}  名称=${cfg.name || ''}  groupCol=${cfg.groupCol || ''}  headTable=${cfg.headTable || ''}  lineTable=${cfg.lineTable || ''}  tabKey=${cfg.tabKey || ''}`)
  const rows = f.map((x) => ({
    label: x.label, col: x.colName, place: x.place, seq: x.seq,
    required: x.required, editable: x.editable, visible: x.visible, hidden: x.hidden,
    type: x.type, ref: x.refPanel || x.refField || '',
  }))
  rows.sort((a, b) => (a.place || '').localeCompare(b.place || '') || (a.seq || 0) - (b.seq || 0))
  for (const r of rows) {
    p(`    ${String(r.place).padEnd(14)} seq=${String(r.seq).padStart(4)} ${String(r.label).padEnd(16)} col=${String(r.col).padEnd(22)} req=${r.required ? 1 : 0} ed=${r.editable} vis=${r.visible} hid=${r.hidden} type=${r.type || ''} ${r.ref ? 'ref=' + r.ref : ''}`)
  }
}

;(async () => {
  TOKEN = await login('admin', '123456', 'YJ_TEST')
  p('=== 登录 admin@YJ_TEST 成功 ===')

  for (const pc of ['RD_PROD_INFO', 'RD_SPEC_DOC', 'RD_MOLD_PROC']) {
    const r = await api('GET', '/api/px/getPanelConfig?panelCode=' + pc)
    p('')
    p('=== getPanelConfig ' + pc + ' → HTTP ' + r.status + ' code=' + (r.json && r.json.code) + ' ===')
    if (r.json && r.json.data) dumpPanel(r.json.data)
    else p('  ' + r.text.slice(0, 500))
  }

  p('')
  p('=== getFormDescriptor(RD_SPEC_DOC 随便取一张看 detail 键) ===')
  const r1 = await api('POST', '/api/px/queryFormDataList', { panelCode: 'RD_SPEC_DOC', pageNo: 1, pageSize: 5, condition: {} })
  p('HTTP ' + r1.status + ' code=' + (r1.json && r1.json.code))
  p(JSON.stringify(r1.json && r1.json.data, null, 1).slice(0, 6000))

  p('')
  p('=== queryFormDataList RD_PROD_INFO ===')
  const r2 = await api('POST', '/api/px/queryFormDataList', { panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 5, condition: {} })
  p('HTTP ' + r2.status + ' code=' + (r2.json && r2.json.code))
  p(JSON.stringify(r2.json && r2.json.data, null, 1).slice(0, 6000))

  p('')
  p('=== specByProduct(CSCS) 现状基线 ===')
  const r3 = await api('GET', '/api/px/specByProduct?code=CSCS')
  p('HTTP ' + r3.status + ' ' + JSON.stringify(r3.json && r3.json.data))

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
  console.log('written ' + OUT + '  (' + lines.length + ' lines)')
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
