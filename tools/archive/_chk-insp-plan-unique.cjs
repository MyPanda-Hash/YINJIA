/**
 * _chk-insp-plan-unique.cjs — 复现 RD_INSP_PLAN 的固定默认文档编号撞唯一性(建两张单对比)
 *
 * 背景:前端 recordSheetConfigs.js 的 docNoDefault='YJ-RD001' + DB 默认约束
 *       DF_insp_docno DEFAULT N'YJ-RD001'(tools/migrate-rd-prod-sheets.sql:404)
 *       ⇒ 每张检验计划表的 文档编号 都是 YJ-RD001;而 RD_INSP_PLAN 又在 DOC_NO_PANELS 里
 *       ⇒ 第二张单必被 ensureDocNoUnique 挡下("文档编号不允许重复")。
 * 断言:① 第一张「保存」成功;② 第二张「保存」被拒且信息含"不允许重复"(证明这是既有口径冲突);
 *       ③ 清理两张探针单。
 * 用法:node tools/archive/_chk-insp-plan-unique.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

;(async () => {
  const lg = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const H = { Authorization: 'Bearer ' + lg.data.token, 'Content-Type': 'application/json' }
  const call = async (buttonName, formData) => {
    const r = await fetch(BASE + '/api/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName, formData, buttonParam: {} }),
    })
    const j = await r.json().catch(() => ({}))
    return { http: r.status, code: j.code, msg: j.message, data: j.data }
  }

  // 前置:表里不能已有别的检验计划(否则第一张就会被挡,断言含义变了)
  const existing = Number(sql(`SELECT COUNT(*) FROM rd_insp_plan_head`))
  if (existing > 0) {
    console.log(`⊘ 表里已有 ${existing} 张检验计划,先清空才能验证"第一张通过/第二张被挡",跳过`)
    process.exit(2)
  }

  const nos = []
  // ⚠ 必须**带上 文档编号**(前端 docNoDefault 就是 'YJ-RD001',界面提交时一定带):
  //   ensureDocNoUnique 只看载荷里的 文档编号,载荷不带就"空值跳过" —— 第一版探针漏了这个,
  //   两张都 200,看起来"没问题",实际上界面路径第二张必被挡。
  const a = await call('新增', {})
  const no1 = a.data && a.data['编号']; nos.push(no1)
  const s1 = await call('保存', { 编号: no1, 文档编号: 'YJ-RD001', 标题: 'probe-1' })
  console.log(`① 第 1 张 ${no1} 保存(带 文档编号=YJ-RD001) → HTTP ${s1.http} msg=${JSON.stringify(s1.msg)}`)

  const b = await call('新增', {})
  const no2 = b.data && b.data['编号']; nos.push(no2)
  const s2 = await call('保存', { 编号: no2, 文档编号: 'YJ-RD001', 标题: 'probe-2' })
  console.log(`② 第 2 张 ${no2} 保存(同样带 YJ-RD001) → HTTP ${s2.http} msg=${JSON.stringify(s2.msg)}`)

  const d1 = sql(`SELECT ISNULL(文档编号,'-') FROM rd_insp_plan_head WHERE 单据编号='${no1}'`)
  const d2n = sql(`SELECT COUNT(*) FROM rd_insp_plan_head WHERE 单据编号='${no2}'`)
  console.log(`   第 1 张库中文档编号=${d1};第 2 张头表行数=${d2n}`)

  let bad = 0
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }
  chk('第 1 张保存成功', s1.http === 200, 'HTTP ' + s1.http)
  chk('第 2 张被文档编号唯一性挡下', s2.http !== 200 && /不允许重复/.test(String(s2.msg)), JSON.stringify(s2.msg))

  for (const no of nos) {
    if (!no) continue
    sql(`DELETE FROM yj_doc_status WHERE panel_code='RD_INSP_PLAN' AND doc_no='${no}';
         DELETE FROM rd_insp_plan_detail WHERE 单据编号='${no}';
         DELETE FROM rd_insp_plan_head WHERE 单据编号='${no}';`)
  }
  console.log(`已清理 ${nos.filter(Boolean).join(', ')}`)
  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 复现成立:该面板只能存在一张单(固定 文档编号 + 唯一性规则冲突)')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.stack); process.exit(1) })
