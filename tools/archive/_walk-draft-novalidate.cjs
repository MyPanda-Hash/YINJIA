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
const HEAD = 'rd_soak_head'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

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
  const snapNos = () => new Set(sql(`SELECT ISNULL(单据编号,'') FROM ${HEAD}`).split(/\r?\n/).map((x) => x.trim()).filter(Boolean))
  const cleanupOnly = (no) => sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}';
       DELETE FROM ${HEAD} WHERE 单据编号='${no}';
       DELETE FROM ${HEAD.replace(/_head$/, '_detail')} WHERE 单据编号='${no}';`)
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
      const headRows = sql(`SELECT COUNT(*) FROM ${HEAD} WHERE 单据编号='${docNo}'`)
      const detRows = sql(`SELECT COUNT(*) FROM ${HEAD.replace(/_head$/, '_detail')} WHERE 单据编号='${docNo}'`)
      const arch = sql(`SELECT ISNULL(archived,'-') FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${docNo}'`)
      console.log(`④ 库中:头表行=${headRows} 明细行=${detRows} archived=${arch}`)
      chk('草稿已落库(头表 1 行)', headRows === '1', headRows)
      chk('草稿明细随保存落库(明细行≥1)', Number(detRows) >= 1, detRows)
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
