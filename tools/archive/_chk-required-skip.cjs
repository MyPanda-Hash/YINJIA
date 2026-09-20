/**
 * _chk-required-skip.cjs — 必填校验的"跳过名单"必须在真机上成立(不许出现填不了的必填)
 *
 * 后端 ensureRequiredFilled 跳过四类表头字段,每类都有真实数据命中:
 *   ① 系统字段(单据编号/单据日期/创建时间/编辑人/编辑日期)
 *   ② hidden=1 —— 前端 headerFields = dataSchema.fields.filter(!hidden),界面不渲染
 *      命中:RD_DOM_TEST.文档编号、RD_PROD_INFO.产品类型
 *   ③ 规格书种类 —— 页签分类,前端显式跳过(PanelxList.vue:4055);命中:RD_SPEC_DOC
 *   ④ 编号 —— save() 把载荷「编号」当单据标识取走,该列永远落不了库
 *      命中:RD_SPEC_DOC(rd_spec_doc_head.编号 3 张单全 NULL)
 * 断言:把这些字段留空去「保存」,拦截信息**不得**提到它们(提到 = 用户无路可走)。
 * 用法:node tools/archive/_chk-required-skip.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
const lines = (q) => sql(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

const SYS = `N'单据编号',N'单据日期',N'创建时间',N'更新时间',N'编辑人',N'编辑日期',N'规格书种类',N'编号'`
const SKIPPED = ['文档编号', '产品类型', '规格书种类', '编号']

/** 面板 → { skips: 命中跳过名单的必填字段, visible: 需要用户填的可见必填字段 } */
function metaOf(panel) {
  const rows = lines(`SELECT label+'|'+CAST(hidden AS varchar)+'|'+ISNULL(data_type,'') FROM yj_field
    WHERE panel_code='${panel}' AND place LIKE '%header%' AND required=1 ORDER BY seq`)
    .map((l) => { const [label, hidden, type] = l.split('|'); return { label, hidden: hidden === '1', type } })
  const visible = rows.filter((r) => !r.hidden && !SKIPPED.includes(r.label))
  const skipped = rows.filter((r) => r.hidden || SKIPPED.includes(r.label))
  return { visible, skipped, head: lines(`SELECT head_table FROM yj_panel WHERE panel_code='${panel}'`)[0] || '' }
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

  // 面板来自库:凡是"必填字段命中跳过名单"的都验一遍,避免写死漏面
  const panels = lines(`SELECT DISTINCT panel_code FROM yj_field WHERE place LIKE '%header%' AND required=1
    AND (hidden=1 OR label IN (N'规格书种类',N'编号')) ORDER BY panel_code`)
  console.log(`目标面板(${panels.length}):${panels.join(', ')}`)

  let bad = 0, probed = 0
  for (const p of panels) {
    const { visible, skipped, head } = metaOf(p)
    const c = await call(p, '新增', {})
    const no = c.data && c.data['编号']
    if (!no) { console.log(`  ⊘ ${p} 建单失败,跳过`); continue }
    probed++

    // 可见必填都填上(日期/数字类跳过:探针不造非法值,只关心"不许提跳过名单里的字段")
    const filled = {}
    for (const f of visible) {
      if (['文本', '下拉框', '参照'].includes(f.type)) filled[f.label] = 'probe'
      else filled[f.label] = f.type === '日期' ? '2026-09-20' : 1
    }
    const res = await call(p, '保存', { 编号: no, ...filled })
    const msg = String(res.msg || '')
    const mentionsSkipped = skipped.filter((s) => msg.includes(s.label))
    const ok = mentionsSkipped.length === 0
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} ${p}  HTTP ${res.http} msg=${JSON.stringify(msg)}`)
    console.log(`        跳过名单必填=${JSON.stringify(skipped.map((s) => s.label + (s.hidden ? '(hidden)' : '')))}  可见必填=${JSON.stringify(visible.map((v) => v.label))}`)
    if (!ok) console.log(`        ✗ 拦截信息提到了界面上填不了/落不了库的字段:${mentionsSkipped.map((s) => s.label).join('、')}`)

    sql(`DELETE FROM yj_doc_status WHERE panel_code='${p}' AND doc_no='${no}'`)
    if (head) {
      sql(`DELETE FROM ${head} WHERE 单据编号='${no}'`)
      try { sql(`DELETE FROM ${head.replace(/_head$/, '_detail')} WHERE 单据编号='${no}'`) } catch { /* 表名不同 */ }
    }
  }
  console.log('')
  console.log(bad ? `✗ ${bad}/${probed} 面板出现"填不了的必填"` : `✓ ${probed} 个面板的必填跳过名单成立(不要求界面填不了/落不了库的字段)`)
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.stack); process.exit(1) })
