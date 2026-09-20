/**
 * _chk-required-detail.cjs — 明细级必填:草稿放行 / 保存拦截 / 键缺失不误报
 *
 * ⚠ 筛选口径必须是 place LIKE '%header%'(不是 =):yj_field.place 是逗号复合值
 *   ('query,header'/'header,detail'/'query,header,detail'),后端 inPlace(p)=place.contains(p);
 *   用等号会漏掉这些字段,筛出"表头无必填"的假目标,断言必然误报。
 *
 * Phase A(纯明细必填面板:表头无用户必填 + 明细有必填)
 *   ① 保存为草稿 + 必填明细键全空 → 放行 200
 *   ② 保存    + 必填明细键全空 → 拦截 400,信息含"明细第 1 行"+字段名
 *   ③ 保存    + 明细行不带必填键(局部提交口径)→ 放行 200(不误报)
 * Phase B(表头+明细都有必填:填满表头必填后,拦截必须来自明细层)
 *   ④ 保存 + 表头必填填齐 + 明细必填留空 → 拦截 400 且信息来自明细层
 * 用法:node tools/archive/_chk-required-detail.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
const lines = (q) => sql(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

const SYS = `N'单据编号',N'单据日期',N'创建时间',N'更新时间',N'编辑人',N'编辑日期'`
/** 必填字段行:label | data_type */
const reqRows = (panel, place) => lines(`SELECT label+'|'+ISNULL(data_type,'') FROM yj_field
  WHERE panel_code='${panel}' AND place LIKE '%${place}%' AND required=1 AND col_name NOT IN (${SYS}) ORDER BY seq`)
  .map((l) => { const [label, type] = l.split('|'); return { label, type } })

function phaseATargets() {
  return lines(`SELECT panel_code FROM yj_panel p WHERE mode='doc'
      AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=p.panel_code AND f.place LIKE '%header%'
                      AND f.required=1 AND f.col_name NOT IN (${SYS}))
      AND EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=p.panel_code AND f.place LIKE '%detail%' AND f.required=1)
    ORDER BY panel_code`)
}
/** 表头必填全是可填文本/下拉/参照(不含日期/数字)的面板,便于"填齐表头"后验证明细层 */
function phaseBTargets(limit) {
  return lines(`SELECT panel_code FROM yj_panel p WHERE mode='doc'
      AND EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=p.panel_code AND f.place LIKE '%detail%' AND f.required=1)
      AND EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=p.panel_code AND f.place LIKE '%header%'
                  AND f.required=1 AND f.col_name NOT IN (${SYS}))
      AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=p.panel_code AND f.place LIKE '%header%'
                      AND f.required=1 AND f.col_name NOT IN (${SYS})
                      AND ISNULL(data_type,'') NOT IN (N'文本',N'下拉框',N'参照'))
    ORDER BY panel_code`).slice(0, limit)
}
const headOf = (panel) => lines(`SELECT head_table FROM yj_panel WHERE panel_code='${panel}'`)[0] || ''
const groupColOf = (panel) => lines(`SELECT group_col FROM yj_panel WHERE panel_code='${panel}'`)[0] || ''

/** 前置条件:「新增」必须发到未被占用的编号,否则本次断言无效(编号重发缺陷,见 _chk-no-reissue.cjs):
 *  FormNoService.exists() 只查 s_allno/inh、不查业务表 ⇒ 业务表有、台账无的编号会被重发,
 *  头表同号两行,isStoredBlank 读到旧行(往往非空)⇒ 假放行,与本任务的校验逻辑无关。 */
function issuedFreshNumber(panel, no) {
  const head = headOf(panel), gc = groupColOf(panel)
  if (!head || !gc) return true
  return lines(`SELECT COUNT(*) FROM ${head} WHERE ${gc}='${no}'`)[0] === '1'
}
/** 碰撞时只回收本次新增写进去的那一行(MAX id),不动旧数据 */
function reclaimCollidedRow(panel, no) {
  const head = headOf(panel), gc = groupColOf(panel)
  sql(`DELETE FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${no}'`)
  if (head && gc) sql(`DELETE FROM ${head} WHERE ${gc}='${no}' AND id = (SELECT MAX(id) FROM ${head} WHERE ${gc}='${no}')`)
}

;(async () => {
  const lg = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const H = { Authorization: 'Bearer ' + lg.data.token, 'Content-Type': 'application/json' }
  const call = async (panelCode, buttonName, formData) => {
    const r = await fetch(BASE + '/api/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
    })
    const j = await r.json().catch(() => ({}))
    return { http: r.status, code: j.code, msg: j.message, data: j.data }
  }
  const cleanup = (p, no) => {
    const head = headOf(p)
    sql(`DELETE FROM yj_doc_status WHERE panel_code='${p}' AND doc_no='${no}'`)
    if (!head) return
    sql(`DELETE FROM ${head} WHERE 单据编号='${no}'`)
    try { sql(`DELETE FROM ${head.replace(/_head$/, '_detail')} WHERE 单据编号='${no}'`) } catch { /* 表名不同 */ }
  }

  let bad = 0, probed = 0
  const A = phaseATargets()
  console.log(`Phase A 目标(${A.length}):${A.join(', ') || '(无)'}`)
  for (const p of A) {
    const req = reqRows(p, 'detail')
    const c = await call(p, '新增', {})
    const no = c.data && c.data['编号']
    if (!no) { console.log(`  ⊘ ${p} 建单失败,跳过`); continue }
    if (!issuedFreshNumber(p, no)) {
      console.log(`  ⊘ ${p} 跳过:新增发到已占用编号 ${no}(编号重发缺陷,见 _chk-no-reissue.cjs)`)
      reclaimCollidedRow(p, no); continue
    }
    probed++
    const blankRow = Object.fromEntries(req.map((r) => [r.label, '']))
    const draft = await call(p, '保存为草稿', { 编号: no, detail: { items: [blankRow] } })
    const save = await call(p, '保存', { 编号: no, detail: { items: [blankRow] } })
    const absent = await call(p, '保存', { 编号: no, detail: { items: [{}] } })
    const ok1 = draft.http === 200
    const ok2 = save.http !== 200 && String(save.msg || '').includes('明细第 1 行') && String(save.msg || '').includes(req[0].label)
    const ok3 = absent.http === 200
    if (!ok1 || !ok2 || !ok3) bad++
    console.log(`  ${ok1 && ok2 && ok3 ? '✓' : '✗'} ${p}  明细必填=${JSON.stringify(req.map((r) => r.label))}`)
    console.log(`        ① 草稿+空必填: HTTP ${draft.http}   ② 保存+空必填: HTTP ${save.http} msg=${JSON.stringify(save.msg)}   ③ 保存+键缺失: HTTP ${absent.http}`)
    cleanup(p, no)
  }

  const B = phaseBTargets(3)
  console.log('')
  console.log(`Phase B 目标(${B.length}):${B.join(', ') || '(无)'}`)
  for (const p of B) {
    const hreq = reqRows(p, 'header')
    const dreq = reqRows(p, 'detail')
    const c = await call(p, '新增', {})
    const no = c.data && c.data['编号']
    if (!no) { console.log(`  ⊘ ${p} 建单失败,跳过`); continue }
    if (!issuedFreshNumber(p, no)) {
      console.log(`  ⊘ ${p} 跳过:新增发到已占用编号 ${no}(编号重发缺陷,见 _chk-no-reissue.cjs)`)
      reclaimCollidedRow(p, no); continue
    }
    probed++
    const head = Object.fromEntries(hreq.map((r) => [r.label, 'probe']))
    const blankRow = Object.fromEntries(dreq.map((r) => [r.label, '']))
    const r4 = await call(p, '保存', { 编号: no, ...head, detail: { items: [blankRow] } })
    const ok4 = r4.http !== 200 && String(r4.msg || '').includes('明细第 1 行')
    if (!ok4) bad++
    console.log(`  ${ok4 ? '✓' : '✗'} ${p}  表头必填=${JSON.stringify(hreq.map((r) => r.label))} 明细必填=${JSON.stringify(dreq.map((r) => r.label))}`)
    console.log(`        ④ 表头填齐+明细留空: HTTP ${r4.http} msg=${JSON.stringify(r4.msg)}`)
    cleanup(p, no)
  }

  console.log('')
  console.log(bad ? `✗ ${bad}/${probed} 面板不符` : `✓ ${probed} 个面板明细必填分工一致(草稿放行 / 保存拦截 / 键缺失不误报 / 表头优先)`)
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.stack); process.exit(1) })
