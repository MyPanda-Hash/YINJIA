/*
 * _ui-1019.cjs —— 《10.19 问题》界面级验收(Edge headless + CDP,只读)
 *
 * 前置:前端 :5173(vite,源码即时生效)+ 后端 :8090 在跑。
 * 用法: node tools/archive/_1019-verify/_ui-1019.cjs
 *
 * 覆盖(对应《10.19问题.docx》):
 *   ③ 菜单:特采单挂 智能供应链 > 采购管理 > 单据(不在 品质管理 下)
 *   ④ 特采单纸面出现「附件」上传入口
 *   ⑤ 特采单「品质部意见」区出现可点的检验数据记录单号
 *   ⑥ 检验报告标题右侧出现来料检验单号链接
 *   ⑦ 特采单 / 质量单据 左侧出现「XX单选择」栏(含审核状态列)
 *   ② 检验数据记录新单:检验结论是下拉(可输入自定义值),不是纯文本域
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, label, extra = '') => {
  if (c) { pass++; console.log(`  PASS  ${label}${extra ? ' · ' + extra : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${extra ? ' · ' + extra : ''}`) }
}

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-1019-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url, wait = 3600) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') break }
      await sleep(wait)
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${FE}/#/login`, 800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
                    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank', 300)

    // ───────── ③ 菜单位置 ─────────
    console.log('\n③ 菜单:特采单在 智能供应链 > 采购管理 下')
    await navigate(`${FE}/#/panelx/list/QC_TC_IN`, 4200)
    // 导航默认是折叠的(子项不进 DOM)⇒ 先依次展开「智能供应链」→「采购管理」,再看特采单落在谁下面
    // 导航默认是折叠的,而「当前面板的祖先组」会自动展开 ⇒ 直接等它展开(点标题反而会收起)
    await sleep(1800)
    const menuInfo = await evaluate(`(() => {
      const aside = document.querySelector('aside, .portal-nav, .nav-wrap, .sidebar') || document.body
      const spans = [...aside.querySelectorAll('span,a,div,li')].filter(e => !e.children.length && (e.textContent||'').trim())
      const idx = (t) => spans.findIndex(e => (e.textContent||'').replace(/\\s+/g,'') === t)
      const pSup = idx('智能供应链'), pBuy = idx('采购管理'), pQc = idx('品质管理'), pTc = idx('特采单')
      return { pSup, pBuy, pQc, pTc, labels: [...new Set(spans.map(e => (e.textContent||'').trim()).filter(s => s.length <= 8))].slice(0, 24) }
    })()`)
    // DOM 顺序口径只能证明"渲染了这些组",**证明不了父子关系**(折叠时子项根本不在 DOM;
    // 展开状态依赖点击/自动展开时序,不可靠)⇒ 父子关系以 menus.js(导航唯一真源)为准,
    // 那条断言在 _verify-1019.mjs ③(直接 import menus.js 走树);这里只核"导航里两个组都在 + 本面板能打开"。
    ok(menuInfo.pSup >= 0, '左侧导航渲染了「智能供应链」组', `位置 ${menuInfo.pSup}`)
    ok(menuInfo.pBuy >= 0, '左侧导航渲染了「采购管理」组(本面板所在组已展开)', `位置 ${menuInfo.pBuy}`)
    ok(menuInfo.pQc >= 0, '左侧导航仍有「品质管理」组(特采单已不在其中,见 API 探针 ③)')

    // ───────── ⑦ + ④ + ⑤ 特采单纸面 ─────────
    console.log('\n⑦④⑤ 特采单:左栏单据选择 / 附件入口 / 品质部意见的检验数据记录单号')
    await navigate(`${FE}/#/panelx/list/QC_TC_IN?docNo=TCI-2026-09-0024`, 4200)
    // ?docNo= 只在首次挂载时生效,同文档内跳 hash 时可能不重定位 ⇒ 兜底:在左栏里点那张单
    const picked = await evaluate(`(() => {
      const row = [...document.querySelectorAll('.doc-select-rail tbody tr')].find(tr => (tr.innerText||'').includes('TCI-2026-09-0024'))
      if (!row) return 'NOT-IN-RAIL'
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'CLICKED'
    })()`)
    await sleep(2500)
    const tcin = await evaluate(`(() => {
      const rail = document.querySelector('.doc-select-rail')
      const railText = rail ? (rail.innerText || '').replace(/\\n+/g,' | ') : ''
      const attachBtn = [...document.querySelectorAll('*')].filter(e => !e.children.length && /上传附件/.test(e.textContent||'')).length
      const links = [...document.querySelectorAll('.q-doclink')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim())
      const sheet = document.querySelector('.approval-sheet')
      return {
        hash: location.hash,
        cur: (document.querySelector('.as-docno')?.innerText || '').trim().slice(0, 40),
        hasRail: !!rail,
        railText: railText.slice(0, 220),
        railHasStatus: railText.includes('审核状态') || railText.includes('已审核') || railText.includes('草稿'),
        attachBtn, links,
        sheetText: sheet ? (sheet.innerText || '').replace(/\\s+/g,' ').slice(0, 300) : '',
      }
    })()`)
    ok(tcin.hasRail, '左侧出现「特采单选择」栏', tcin.railText.slice(0, 120))
    ok(/特采单.*选择/.test(tcin.railText), '栏标题 = 特采单选择')
    ok(tcin.railHasStatus, '栏里有审核状态(草稿/已审核 标签)')
    ok(tcin.attachBtn >= 1, '纸面出现「上传附件」入口', `${tcin.attachBtn} 个`)
    ok(tcin.links.some((l) => /检验数据记录/.test(l)), '品质部意见区有检验数据记录单号链接',
      `${picked} · ${tcin.links.join(' | ') || '(无)'}`)

    // 点一下链接看是否能跳转
    const jumped = await evaluate(`(() => {
      const a = [...document.querySelectorAll('.q-doclink')].find(e => /检验数据记录/.test(e.innerText||''))
      if (!a) return 'NO-LINK'
      a.click(); return 'CLICKED'
    })()`)
    await sleep(3200)
    const afterJump = await evaluate(`location.hash`)
    ok(jumped === 'CLICKED' && /QC_INSP_REC/.test(String(afterJump)), '点链接跳到检验数据记录并带 docNo',
      `${jumped} → ${String(afterJump).slice(0, 90)}`)

    // ───────── ⑥ 检验报告标题右侧链接 ─────────
    console.log('\n⑥ 检验报告:标题右侧来料检验单号链接')
    await navigate(`${FE}/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0086`, 4200)
    const rec = await evaluate(`(() => {
      const t = document.querySelector('.qr-titlerow')
      const link = t ? t.querySelector('.qr-doclink') : null
      return { title: t ? (t.innerText||'').replace(/\\s+/g,' ').trim().slice(0,80) : '', link: link ? (link.innerText||'').replace(/\\s+/g,' ').trim() : '' }
    })()`)
    ok(/来料检验单/.test(rec.link) && /IJ-/.test(rec.link), '标题行右侧是来料检验单号链接', rec.link || rec.title)

    // ───────── ② 检验结论下拉(新单) ─────────
    console.log('\n② 检验数据记录新单:检验结论是下拉(可自定义)')
    await navigate(`${FE}/#/panelx/list/QC_INSP_REC`, 3800)
    const clicked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, .as-side-btn')].find(e => (e.innerText||'').replace(/\\s/g,'').includes('新增'))
      if (!b) return 'NO-BUTTON'; if ((b.className||'').includes('disabled')) return 'DISABLED'
      b.click(); return 'CLICKED'
    })()`)
    await sleep(3800)
    const verdict = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.qr-foot-table tr')]
      const row = rows.find(r => (r.innerText||'').includes('检验结论'))
      if (!row) return { found: false }
      const sel = row.querySelector('.el-select')
      const ta = row.querySelector('textarea')
      return { found: true, hasSelect: !!sel, hasTextarea: !!ta, selText: sel ? (sel.innerText||'').replace(/\\s+/g,' ').trim().slice(0,60) : '', cls: sel ? sel.className : '' }
    })()`)
    ok(clicked === 'CLICKED' || clicked === 'DISABLED', '「新增」可点(或已禁用)', clicked)
    ok(verdict.found, '表尾找到「检验结论」行')
    ok(verdict.hasSelect, '检验结论渲染成下拉框(不再是文本域)', verdict.selText || verdict.cls)
    ok(!verdict.hasTextarea, '同一格没有残留文本域')
    // 下拉里能不能自定义:检查 el-select 的 filterable/allow-create 属性(Element Plus 会把它们渲染成 select 的 input)
    const allowCreate = await evaluate(`(() => {
      const row = [...document.querySelectorAll('.qr-foot-table tr')].find(r => (r.innerText||'').includes('检验结论'))
      const sel = row && row.querySelector('.el-select')
      if (!sel) return { ok: false }
      // 点开看候选(三项字典)且输入框可编辑
      const input = sel.querySelector('input')
      const editable = !!input && !input.disabled && !input.readOnly
      sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return { editable, inputClass: input ? input.className : '' }
    })()`)
    await sleep(1200)
    const dropdown = await evaluate(`(() => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')].map(e => (e.innerText||'').replace(/\\s+/g,'').trim())
      const box = document.querySelector('.el-select-dropdown')
      return { items: [...new Set(items)].filter(Boolean).slice(0, 10), visible: !!box && box.offsetParent !== null }
    })()`)
    ok(allowCreate.editable, '下拉输入框可编辑(allow-create ⇒ 可自定义补充)')
    ok(['特采', '合格', '不合格'].every((x) => dropdown.items.includes(x)), '候选含 特采/合格/不合格', dropdown.items.join('/'))

    // ───────── ⑦ 质量单据左栏 ─────────
    console.log('\n⑦ 质量单据一族:左栏「XX单选择」栏')
    for (const [panel, title] of [['QC_BHC', '不合格品处理单'], ['QC_BHJ', ''], ['QC_LYB', '来料异常分析报告']]) {
      if (!title) continue
      await navigate(`${FE}/#/panelx/list/${panel}`, 3200)
      const r = await evaluate(`(() => {
        const rail = document.querySelector('.doc-select-rail')
        return { has: !!rail, text: rail ? (rail.innerText||'').replace(/\\s+/g,' ').slice(0, 90) : '' }
      })()`)
      ok(r.has, `${panel} 有左栏单据选择`, r.text)
    }

    console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  } finally {
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
