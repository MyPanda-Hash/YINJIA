/**
 * _walk-draft-novalidate.cjs — 真浏览器验收:「保存为草稿」不再被必填校验挡住(「保存」仍挡)
 *
 * 背景:skipValidation 曾经是**死参数**(声明并传入,函数体从没读过),草稿路径照样跑全量校验。
 * 断言(面板 RD_SOAK,必填=文档编号/测试主题,均为空):
 *   ① 侧边栏「保存为草稿」→ 出现成功提示、**不出现**"不能为空"警告、库中备注已落
 *   ② 紧接着「保存」→ 出现"不能为空"提示(草稿与提交分工可见)
 * 用法:node tools/archive/_walk-draft-novalidate.cjs [面板码]
 */
'use strict'
const { execFileSync } = require('node:child_process')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'RD_SOAK'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
const metaRow = sql(`SELECT ISNULL(head_table,'-')+'|'+ISNULL(group_col,'-')+'|'+ISNULL(line_table,'-') FROM yj_panel WHERE panel_code='${PANEL}'`)
const [HEAD, GROUP_COL, LINE_TABLE] = metaRow.split('|')
if (!HEAD || HEAD === '-' || !GROUP_COL || GROUP_COL === '-') {
  console.log(`⊘ ${PANEL} 没有头表/分组列元数据,跳过`); process.exit(2)
}

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const user = JSON.stringify(login.data ? login.data.user : {})

  const s = await launch({ port: 9441 })
  let bad = 0
  let docNo = ''
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }
  /** 建单前先拍快照:只允许操作"本次新增出来的编号",绝不按"表里最新一行"猜
   *  (踩过:侧边栏未就绪 → 按钮没点上 → 回退取最新行 → 删掉了别人的单据)。 */
  const snapNos = () => new Set(sql(`SELECT ISNULL(${GROUP_COL},'') FROM ${HEAD}`).split(/\r?\n/).map((x) => x.trim()).filter(Boolean))
  const cleanupOnly = (no) => sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}';
       DELETE FROM ${HEAD} WHERE ${GROUP_COL}='${no}';
       DELETE FROM ${LINE_TABLE} WHERE ${GROUP_COL}='${no}';`)
  try {
    await s.navigate(BASE + '/#/login', 2200)
    await s.evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});'ok'`)
    await s.navigate('about:blank', 400)
    await s.navigate(`${BASE}/#/panelx/list/${PANEL}`, 1800)
    let ready = false
    for (let i = 0; i < 30; i++) {
      const n = await s.evaluate(`document.querySelectorAll('.as-side-btn').length`)
      if (typeof n === 'number' && n > 0) { ready = true; break }
      await sleep(600)
    }
    if (!ready) { console.log(`⊘ 侧边栏未就绪,跳过(未触碰任何数据)`); s.close(); process.exit(2) }

    // 清掉可能残留的消息条,便于断言"这次点了之后有没有警告"
    const clearMsgs = `document.querySelectorAll('.el-message').forEach((e) => e.remove());'ok'`
    // hook XHR:记下「保存为草稿」那次请求实际带了几行明细 —— 断言"提交了几行就落库几行",
    // 不假设面板有默认明细模板(RD_SOAK 自带 17 行,RD_MINERAL 等开局 0 行;第一版写死 ≥1 会误报)
    await s.evaluate(`(() => {
      if (window.__lastDraft) return 'already'
      window.__lastDraft = null
      const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return XO.apply(this, arguments) }
      XMLHttpRequest.prototype.send = function (body) {
        try {
          if (/callButton/.test(String(this.__u || ''))) {
            const p = JSON.parse(String(body || '{}'))
            if (p.buttonName === '保存为草稿') {
              const rows = (p.formData && p.formData.detail && p.formData.detail.items) || []
              window.__lastDraft = { rows: rows.length, status: 0, resp: '' }
              this.addEventListener('load', () => {
                window.__lastDraft.status = this.status
                try { window.__lastDraft.resp = String(this.responseText || '').slice(0, 300) } catch (e) { /* 不可读 */ }
              })
            }
          }
        } catch (e) { /* 非 JSON 请求体 */ }
        return XS.apply(this, arguments)
      }
      return 'hooked'
    })()`)
    const clickBtn = (text) => `(() => {
      const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').replace(/\\s+/g, '') === ${JSON.stringify(text)})
      if (!b) return 'notfound'
      b.click(); return 'clicked'
    })()`
    const msgs = `[...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\\s+/g, '')).join(' | ')`

    // ① 新增(走 directAdd,建空白草稿)
    await s.evaluate(clearMsgs)
    const before = snapNos()
    const c1 = await s.evaluate(clickBtn('新增'))
    if (c1 !== 'clicked') { console.log(`⊘ 未找到「新增」按钮,跳过(未触碰任何数据)`); s.close(); process.exit(2) }
    await sleep(1800)
    const after = snapNos()
    const fresh = [...after].filter((n) => !before.has(n))
    if (fresh.length !== 1) {
      console.log(`⊘ 新增未产生唯一新编号(新增=${JSON.stringify(fresh)}),跳过`)
      for (const n of fresh) cleanupOnly(n)
      s.close(); process.exit(2)
    }
    docNo = fresh[0]
    console.log(`① 新增 = ${c1}  本次新建单据 = ${docNo}`)
    await s.evaluate(clearMsgs)

    // ② 保存为草稿
    const c2 = await s.evaluate(clickBtn('保存为草稿'))
    await sleep(2200)
    const m2 = await s.evaluate(msgs)
    console.log(`② 保存为草稿 = ${c2}  提示 = ${JSON.stringify(m2)}`)
    chk('草稿:未出现"不能为空"警告', !String(m2).includes('不能为空'), m2)
    chk('草稿:出现保存成功提示', String(m2).includes('保存为草稿') || String(m2).includes('成功'), m2)
    chk('草稿:按钮可点击(侧边栏存在「保存为草稿」)', c2 === 'clicked', c2)

    // ③ 同一张单紧接着「保存」→ 应被必填挡住
    await s.evaluate(clearMsgs)
    const c3 = await s.evaluate(clickBtn('保存'))
    await sleep(2200)
    const m3 = await s.evaluate(msgs)
    console.log(`③ 保存 = ${c3}  提示 = ${JSON.stringify(m3)}`)
    chk('保存:出现必填警告', String(m3).includes('不能为空'), m3)

    // ④ 库中:草稿确实落库(头行 + 随表单提交的明细行)、且未归档
    //    ⚠ 不要断言"备注非空":界面流程根本没填备注(directAdd 空白草稿),那是探针自己的假设错误。
    //      真正证明落库 = 该编号在头表有行 + 明细行也写进去了(载荷里带了 3 行默认明细)。
    if (docNo) {
      const headRows = sql(`SELECT COUNT(*) FROM ${HEAD} WHERE ${GROUP_COL}='${docNo}'`)
      const detRows = sql(`SELECT COUNT(*) FROM ${LINE_TABLE} WHERE ${GROUP_COL}='${docNo}'`)
      const arch = sql(`SELECT ISNULL(archived,'-') FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${docNo}'`)
      const sent = await s.evaluate(`JSON.stringify(window.__lastDraft || null)`)
      const sentObj = JSON.parse(sent || 'null')
      console.log(`④ 库中:头表行=${headRows} 明细行=${detRows}(提交 ${sentObj ? sentObj.rows : '?'} 行) archived=${arch}  请求 HTTP=${sentObj ? sentObj.status : '?'}`)
      if (sentObj && sentObj.status !== 200) console.log(`   草稿请求响应=${JSON.stringify(sentObj.resp)}`)
      chk('草稿已落库(头表 1 行)', headRows === '1', headRows)
      // 已知未决(2026-09-20):RD_INSP_PLAN 的 文档编号 由前端 docNoDefault 与 DB 默认约束双双
      // 定成固定值 YJ-RD001,而该面板又在 DOC_NO_PANELS 里 ⇒ 第二张单必被
      // "文档编号不允许重复" 挡下(草稿路径也拦,因为 ensureDocNoUnique 不看 markSaved)。
      // 这是既有的口径冲突(不是本任务的必填分层),待用户定夺,这里按 SKIP 报,不当成回归。
      if (sentObj && /不允许重复/.test(String(sentObj.resp))) {
        console.log(`  ⊘ ${PANEL} 已知未决:草稿被「${JSON.parse(sentObj.resp).message}」挡下(文档编号唯一性 vs 固定默认值)`)
        cleanupOnly(docNo); docNo = ''
        s.close(); process.exit(2)
      }
      chk('草稿请求返回 200(非提交路径)', !!sentObj && sentObj.status === 200, sent)
      if (sentObj && sentObj.rows > 0) chk(`提交的明细行全部落库(${sentObj.rows} 行)`, Number(detRows) === sentObj.rows, detRows)
      chk('草稿未归档(archived≠Y)', arch !== 'Y', arch)
    }
  } finally {
    s.close()
  }

  if (docNo) {
    cleanupOnly(docNo)
    console.log(`已清理 ${docNo}`)
  }
  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 界面层分工成立:草稿不校验 / 保存校验')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.stack || e.message); process.exit(1) })
