/**
 * _chk-docno-unique.cjs — 文档编号唯一性的两条口径(2026-09-20 用户决定后)
 *
 * 决定:①「保存为草稿」不校验唯一性(草稿=允许存一半;谁先提交谁占住编号);
 *       ② RD_INSP_PLAN 移出 DOC_NO_PANELS —— 它的文档编号是**表单固定值**
 *          (前端 docNoDefault='YJ-RD001' + DB 默认约束 DF_insp_docno),留着唯一性
 *          ⇒ 面板只能有一张单(此前实测:第二张保存必被"文档编号不允许重复"挡下)。
 *
 * 断言:
 *  A. RD_INSP_PLAN:两张单都能保存(各自 文档编号=YJ-RD001)
 *  B. RD_SOAK(仍在 DOC_NO_PANELS):两张草稿可同号;把第二张提交 → 被唯一性挡下
 * 用法:node tools/archive/_chk-docno-unique.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

const META = {
  RD_INSP_PLAN: { head: 'rd_insp_plan_head', line: 'rd_insp_plan_detail', gc: '单据编号' },
  RD_SOAK: { head: 'rd_soak_head', line: 'rd_soak_detail', gc: '单据编号' },
}
const DUP = 'PROBE-DUP-DOCNO'

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
  const cleanup = (panel, no) => {
    const m = META[panel]
    if (!m) return
    sql(`DELETE FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${no}';
         DELETE FROM ${m.line} WHERE ${m.gc}='${no}';
         DELETE FROM ${m.head} WHERE ${m.gc}='${no}';`)
  }

  let bad = 0
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }

  // ── A. RD_INSP_PLAN 多张共存(固定 文档编号 YJ-RD001)──
  console.log('A. RD_INSP_PLAN:同一固定文档编号的两张单都应能保存')
  const preCount = Number(sql(`SELECT COUNT(*) FROM rd_insp_plan_head WHERE 文档编号=N'YJ-RD001'`))
  console.log(`   前置:表内已有 YJ-RD001 单据 ${preCount} 张`)
  const aNos = []
  for (let i = 1; i <= 2; i++) {
    const c = await call('RD_INSP_PLAN', '新增', {})
    const no = c.data && c.data['编号']
    if (!no) { console.log(`  ⊘ 第 ${i} 张建单失败,跳过 A`); aNos.push(null); continue }
    aNos.push(no)
    const s = await call('RD_INSP_PLAN', '保存', { 编号: no, 文档编号: 'YJ-RD001', 标题: `probe-${i}` })
    console.log(`   第 ${i} 张 ${no} 保存 → HTTP ${s.http} msg=${JSON.stringify(s.msg)}`)
    chk(`第 ${i} 张保存成功(多张共存)`, s.http === 200, 'HTTP ' + s.http)
  }
  const liveCount = Number(sql(`SELECT COUNT(*) FROM rd_insp_plan_head WHERE 文档编号=N'YJ-RD001'`))
  chk('库中同号单据并存(≥ 前置+2)', liveCount >= preCount + 2, String(liveCount))

  // ── B. 仍在 DOC_NO_PANELS 的面板:草稿免唯一性,提交才校验 ──
  console.log('')
  console.log('B. RD_SOAK:两张草稿可用同一文档编号,提交时才被唯一性挡下')
  const bNos = []
  for (let i = 1; i <= 2; i++) {
    const c = await call('RD_SOAK', '新增', {})
    const no = c.data && c.data['编号']
    bNos.push(no)
    if (!no) continue
    const d = await call('RD_SOAK', '保存为草稿', { 编号: no, 文档编号: DUP, 测试主题: 'probe' })
    console.log(`   草稿 ${i} ${no} → HTTP ${d.http} msg=${JSON.stringify(d.msg)}`)
    chk(`草稿 ${i} 不校验唯一性(200)`, d.http === 200, 'HTTP ' + d.http)
  }
  const submit2 = bNos[1]
    ? await call('RD_SOAK', '保存', { 编号: bNos[1], 文档编号: DUP, 测试主题: 'probe' })
    : { http: 0, msg: '建单失败' }
  console.log(`   第 2 张提交(${bNos[1]}) → HTTP ${submit2.http} msg=${JSON.stringify(submit2.msg)}`)
  chk('提交仍被文档编号唯一性挡下(含"不允许重复")', submit2.http !== 200 && /不允许重复/.test(String(submit2.msg)), JSON.stringify(submit2.msg))

  for (const no of aNos) if (no) cleanup('RD_INSP_PLAN', no)
  for (const no of bNos) if (no) cleanup('RD_SOAK', no)
  console.log('')
  console.log(`已清理 ${[...aNos, ...bNos].filter(Boolean).join(', ')}`)
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 唯一性口径成立:草稿不校验 / 提交校验 / 检验计划表可多张')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.stack); process.exit(1) })
