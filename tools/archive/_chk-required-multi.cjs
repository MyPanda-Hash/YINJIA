/**
 * _chk-required-multi.cjs — 跨面板验证必填分工:草稿放行 / 保存拦截 / 补齐通过
 *
 * 用法:node tools/archive/_chk-required-multi.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

/** 面板 → 头表 / 必填(从 yj_field 读,避免写死)
 *  ⚠ place 是逗号复合值('query,header' 等),后端 inPlace() 用 contains ⇒ 筛选必须 LIKE,
 *    用 = 会漏字段(第一版就因此把 RD_SAMPLE_NO 判成"无必填")。 */
function metaOf(panel) {
  const reqOf = (place) => sql(`SELECT label FROM yj_field WHERE panel_code='${panel}'
    AND place LIKE '%${place}%' AND required=1
    AND col_name NOT IN (N'单据编号',N'单据日期',N'创建时间',N'更新时间',N'编辑人',N'编辑日期') ORDER BY seq`)
    .split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const head = sql(`SELECT head_table FROM yj_panel WHERE panel_code='${panel}'`).split(/\r?\n/)[0].trim()
  const groupCol = sql(`SELECT group_col FROM yj_panel WHERE panel_code='${panel}'`).split(/\r?\n/)[0].trim()
  // 表头优先:表头必填存在时后端先抛表头信息,否则才是明细层(见 ButtonService.saveDoc)
  const h = reqOf('header'), d = reqOf('detail')
  return { req: h.length ? h : d, layer: h.length ? 'header' : 'detail', h, d, head, groupCol }
}

/** 前置条件:「新增」必须发到一个**未被占用**的编号,否则本次断言无效(见 _chk-no-reissue.cjs)。
 *  FormNoService.exists() 只查 s_allno/inh、不查业务表 ⇒ 业务表里存在而台账缺失的编号会被重发,
 *  头表出现同号两行;此时 isStoredBlank 读到的是旧那一行(往往非空)⇒ 必然假放行,与本任务无关。 */
function issuedFreshNumber(head, groupCol, no) {
  if (!head || !groupCol) return true
  const n = sql(`SELECT COUNT(*) FROM ${head} WHERE ${groupCol}='${no}'`)
  return Number(n) === 1
}

;(async () => {
  const lg = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const tk = lg.data ? lg.data.token : lg.data.token
  const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }
  const call = async (panelCode, buttonName, formData) => {
    const r = await fetch(BASE + '/api/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
    })
    const j = await r.json()
    return { status: r.status, code: j.code, msg: j.message, data: j.data }
  }

  const PANELS = ['RD_SOAK', 'RD_MINERAL', 'RD_FILTER_EFF', 'RD_SAMPLE_NO', 'RD_MOLD_PROC', 'RD_INSP_PLAN']
  let bad = 0
  for (const p of PANELS) {
    const { req, layer, h, d, head, groupCol } = metaOf(p)
    const c = await call(p, '新增', {})
    const no = c.data && c.data['编号']
    if (!no) { console.log(`  ⊘ ${p} 建单失败,跳过`); continue }
    if (!issuedFreshNumber(head, groupCol, no)) {
      console.log(`  ⊘ ${p} 跳过:新增发到已占用编号 ${no}(编号重发缺陷,见 _chk-no-reissue.cjs)`)
      sql(`DELETE FROM yj_doc_status WHERE panel_code='${p}' AND doc_no='${no}'`)
      if (groupCol) {
        // 只删本次新增写进去的那一行(旧的同名行保留,不越权清理他人数据)
        sql(`DELETE FROM ${head} WHERE ${groupCol}='${no}' AND id = (SELECT MAX(id) FROM ${head} WHERE ${groupCol}='${no}')`)
      }
      continue
    }

    // 载荷里把两级必填都留成空串:前端 newDetailRow() 会给每个字段物化 '' 键,同口径
    const blank = {
      编号: no, 备注: 'probe',
      ...Object.fromEntries(h.map((k) => [k, ''])),
      ...(d.length ? { detail: { items: [Object.fromEntries(d.map((k) => [k, '']))] } } : {}),
    }
    const draft = await call(p, '保存为草稿', blank)
    const save = await call(p, '保存', blank)

    const draftOk = draft.code === 200
    const saveBlocked = save.code !== 200
    const msgHasLabel = req.length === 0 || req.some((r) => String(save.msg || '').includes(r))
    if (!draftOk || !saveBlocked) bad++
    console.log(`  ${draftOk && saveBlocked ? '✓' : '✗'} ${p.padEnd(16)} ${layer} 必填=${JSON.stringify(req)}`)
    console.log(`        草稿: HTTP ${draft.status} code=${draft.code}  |  保存: HTTP ${save.status} code=${save.code} msg=${JSON.stringify(save.msg)}`)
    if (saveBlocked && !msgHasLabel) { bad++; console.log('        ✗ 拦截信息未包含必填字段名') }

    // 清理
    sql(`DELETE FROM yj_doc_status WHERE panel_code='${p}' AND doc_no='${no}'`)
    if (head) sql(`DELETE FROM ${head} WHERE 单据编号='${no}'`)
    const det = head ? head.replace(/_head$/, '_detail') : ''
    if (det) { try { sql(`DELETE FROM ${det} WHERE 单据编号='${no}'`) } catch { /* 表名不同则跳过 */ } }
  }
  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 跨面板必填分工一致:草稿放行 / 保存拦截')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
