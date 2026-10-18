/*
 * _probe-first-insp-cols.mjs — 首件检验单「测试项目可新增(=新增列)」界面验收
 *
 * 用户口径(2026-10-15 第二轮):「修改当前页面为如图所示,测试项目需要可新增,也就是新增列即可」。
 *
 * 验什么(全在**正式账套**的页面上真点,只读+临时单据自清):
 *   ① 纸张版式照图片:两级表头(分组 + 测试项目)、左上斜线格、标准行、1#..8# 八个样品行、相关要求、检验结果/检验人;
 *   ② 点表头右上角「＋」⇒ **多出一列**,列名是占位(可改),并且该列同时长出标准行 + 8 个样品格;
 *   ③ 列头改名 ⇒ 列名与列内行的「检验项目」一起变、key 不变(列还在原位置);
 *   ④ 表观/脱粉那两列是勾选式(无粘模/轻微粘模/严重粘模 …),勾一下值落到格子上;
 *   ⑤ 删列(填过内容的)先弹确认;确认后整列 9 行一起消失,别的列一行不动;
 *   ⑥ 全程无未捕获运行时异常。
 *
 * ⚠ 写的是**新建草稿**(点「新增」起一张),只改内存不保存 ⇒ 用完点删除/清场,库里不留单。
 * 用法: node tools/archive/_probe-first-insp-cols.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9493
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ficol-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => {
    const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception?.description || '').slice(0, 200) }
    return r.result?.result?.value
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(2500)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(600)

  // 起一张空草稿(点侧栏「新增」)
  const madeDraft = await ev(`(() => {
    const btns = [...document.querySelectorAll('.approval-side .as-side-btn, .approval-side [class*=as-side]')]
    const b = btns.find(x => (x.innerText||'').trim() === '新增')
    if (b) { b.click(); return 'clicked' }
    const tb = [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.innerText||'').trim() === '新增')
    if (tb) { tb.click(); return 'toolbar' }
    return 'not-found'
  })()`)
  console.log(`  起空草稿=${madeDraft}`)
  await sleep(2200)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(800)

  // ① 版式就位
  const layout = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    if (!s) return { sheet: false }
    return {
      sheet: true,
      title: (s.querySelector('.fi-title')?.innerText || '').trim(),
      groups: [...s.querySelectorAll('.fi-grid thead .group')].map(e => (e.innerText||'').trim()),
      // 读列名:取列头里「改名输入框」的 value(innerText 会把分组下拉的文字与删列「×」一起读进来)
    colHeads: [...s.querySelectorAll('.fi-grid thead .col-head')].map(e => (e.querySelector('.fi-colname input')||{}).value || ''),
      stdRow: !!s.querySelector('.standard-row'),
      sampleLabels: [...s.querySelectorAll('.sample-row .rowlabel')].map(e => (e.innerText||'').trim()),
      corner: !!s.querySelector('.corner'),
      reqs: [...s.querySelectorAll('.fi-requirements li')].length,
      foot: [...s.querySelectorAll('.fi-foot th')].map(e => (e.innerText||'').trim()),
      addBtn: !!s.querySelector('.fi-addcol'),
    }
  })()`)
  console.log(`  标题=${layout.title} 分组=${JSON.stringify(layout.groups)}`)
  console.log(`  列=${JSON.stringify(layout.colHeads)}`)
  console.log(`  相关要求条数=${layout.reqs} 表尾=${JSON.stringify(layout.foot)}`)
  ok('① 首件纸张渲染', layout.sheet === true)
  ok('① 标题=炭棒成型车间首件检验记录表', layout.title === '炭棒成型车间首件检验记录表', layout.title)
  ok('① 两级表头:分组 4 组(有列时)', layout.groups.length === 0 || layout.groups.length === 4, JSON.stringify(layout.groups))
  ok('① 左上角斜线格在', layout.corner === true)
  ok('① 有标准行', layout.stdRow === true)
  ok('① 表头右上角有「＋」新增列', layout.addBtn === true)
  ok('① 底部相关要求 6 条', layout.reqs === 6, String(layout.reqs))
  ok('① 表尾含 检验结果/检验人', layout.foot.includes('检验结果') && layout.foot.includes('检验人'), JSON.stringify(layout.foot))
  // 图片上的 10 个测试项目:新建草稿就应当**已经填好**(用户口径「当前测试项目把这些先填充进去就可以了,
  // 不需要空着什么都没有」)。⚠ 本探针起的是**空草稿**(产品编码都还没填)⇒ 走的是"无工艺清单"兜底路径,
  // 正好钉住"没有工艺清单也要先铺满 10 列"这条。
  const EXPECT10 = ['炭棒表观状态', '炭棒脱粉情况', '炭棒外径', '炭棒内径', '炭棒长度', '炭棒重量',
    '跌落', '挤压强度', '浊度NTU', '压降kPa']
  console.log(`  新建草稿的列=${JSON.stringify(layout.colHeads)}`)
  console.log(`  新建草稿的分组=${JSON.stringify(layout.groups)}`)
  ok('① 新建草稿已铺好图片上的 10 个测试项目(不留空表)',
    EXPECT10.every((n) => layout.colHeads.some((c) => c.includes(n))),
    JSON.stringify(layout.colHeads))
  ok('① 四个分组都出现', layout.groups.length === 4, JSON.stringify(layout.groups))

  const before = layout.colHeads.length
  // ② 点「＋」新增一列 —— 先把新列的列名改成可认的测试项目名(列头输入框),再看列是否长出来
  await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
  await sleep(900)
  // 列名读数:取列头里「改名输入框」(.fi-colname)的 value —— innerText 会把删列「×」也算进来,
  // 而 th.querySelector('input') 现在可能先命中分组下拉里的搜索框,故两者都不能用。
  const readCols = `(() => {
    const s = document.querySelector('.fi-sheet')
    return [...s.querySelectorAll('.fi-grid thead .col-head')].map((th) => {
      const inp = th.querySelector('.fi-colname input') || th.querySelector('input')
      return (inp ? inp.value : (th.innerText || '')).trim()
    })
  })()`
  const afterAdd = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const rows = [...s.querySelectorAll('.sample-row .rowlabel')].map(e => (e.innerText||'').trim())
    const cols = ${readCols}
    return {
      colHeads: cols,
      groupCount: [...s.querySelectorAll('.fi-grid thead .group')].length,
      stdRowCells: s.querySelectorAll('.standard-row td').length,
      sampleRows: rows.length,
      sampleLabels: rows,
      firstSampleCells: s.querySelector('.sample-row')?.querySelectorAll('td').length || 0,
    }
  })()`)
  console.log(`  新增后列=${JSON.stringify(afterAdd.colHeads)} 样品行=${afterAdd.sampleRows}`)
  ok('② 点「＋」多出一列', afterAdd.colHeads.length === before + 1,
    `${before} → ${afterAdd.colHeads.length} ${JSON.stringify(afterAdd.colHeads)}`)
  ok('② 新列名是可改的占位(测试项目n)', /测试项目\d+/.test(afterAdd.colHeads.join(' ')), JSON.stringify(afterAdd.colHeads))
  ok('② 纸张上有 1#..8# 八个样品行', afterAdd.sampleRows === 8, String(afterAdd.sampleRows))
  ok('② 标准行跟着多一格', afterAdd.stdRowCells >= afterAdd.colHeads.length,
    `cells=${afterAdd.stdRowCells} cols=${afterAdd.colHeads.length}`)

  // ③ 列头改名 ⇒ 列内「检验项目」同步、列还在原位
  const renamed = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const inputs = [...s.querySelectorAll('.fi-grid thead .col-head .fi-colname input')]
    const inp = inputs[inputs.length - 1]
    if (!inp) return { ok: false }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '浊度NTU')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true }
  })()`)
  await sleep(900)
  const afterRename = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    return {
      colHeads: ${readCols},
      sampleRows: s.querySelectorAll('.sample-row').length,
    }
  })()`)
  ok('③ 点列头改名入口存在(可编辑输入)', renamed.ok === true)
  ok('③ 改名后列名=浊度NTU 且列数不变(列还在,不是换了列)',
    afterRename.colHeads.includes('浊度NTU') && afterRename.colHeads.length === afterAdd.colHeads.length,
    JSON.stringify(afterRename.colHeads))

  // ④ 表观/脱粉列是勾选式:再新增一列并改名成「炭棒表观状态」,该列应渲染成勾选项
  await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
  await sleep(800)
  await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const inputs = [...s.querySelectorAll('.fi-grid thead .col-head .fi-colname input')]
    const inp = inputs[inputs.length - 1]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '炭棒表观状态')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  await sleep(900)
  const checks = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const boxes = s.querySelectorAll('.sample-row .fi-checks .fi-box')
    const texts = [...s.querySelectorAll('.sample-row .fi-checks .fi-check-txt')].map(e => (e.innerText||'').trim())
    return { boxes: boxes.length, texts: [...new Set(texts)] }
  })()`)
  console.log(`  勾选格=${checks.boxes} 选项=${JSON.stringify(checks.texts)}`)
  ok('④ 表观/脱粉列渲染成勾选式', checks.boxes > 0, `boxes=${checks.boxes}`)
  ok('④ 勾选项含 无粘模/轻微粘模/严重粘模', checks.texts.some(t => t.includes('无粘模')) && checks.texts.some(t => t.includes('严重粘模')),
    JSON.stringify(checks.texts))

  // ④b 勾一下 ⇒ 值落到该格(读内存里的明细行)
  const ticked = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const box = s.querySelector('.sample-row .fi-checks .fi-box')
    if (!box) return { ok: false }
    box.click()
    return { ok: true }
  })()`)
  await sleep(700)
  const tickVal = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const first = s.querySelector('.sample-row td.is-check')
    return (first?.innerText || '').trim()
  })()`)
  ok('④ 勾选后该格显示已勾选项', ticked.ok && /☑/.test(tickVal), tickVal)

  // ④d 勾选式列的可填范围(2026-10-17 现行口径):勾选式那个样式由**列名**认(改名成「炭棒表观状态」
  //     的新列也走勾选式),而它的样品范围恒为 **1#/2#** —— 与列所在的分组**无关**。
  //     ⚠ 这段断言随口径改过两回:最初是"表观/脱粉列永远只在 1#/2#",后来改成"按分组绑对(7#/8#)",
  //       现在回到"勾选式列恒只 1#/2#"(其余列八行全可填 —— 见 firstInspCols.isFillableCell)。
  const perSample = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    return [...s.querySelectorAll('.sample-row')].map((tr) => (tr.querySelectorAll('.fi-checks .fi-box').length))
  })()`)
  console.log(`  各样品行的勾选格数=${JSON.stringify(perSample)}`)
  const misPlaced = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const bad = []
    ;[...s.querySelectorAll('.sample-row')].forEach((tr, ri) => {
      [...tr.querySelectorAll('td:not(.col-op)')].forEach((td, ci) => {
        // 勾选格只允许出现在 1#/2#(0-based 0/1)
        if (td.querySelector('.fi-checks') && ri > 1) bad.push((ri + 1) + '#@列' + ci)
      })
    })
    return bad
  })()`)
  ok('④ 勾选格只出现在 1#/2#(勾选式列的样品范围恒为 1#/2#,与所在分组无关)',
    Array.isArray(misPlaced) && misPlaced.length === 0, JSON.stringify(misPlaced))
  ok('④ 表观及脱粉那两列(1#/2#)仍是勾选式、其余样品行没有勾选格',
    perSample.length === 8 && perSample[0] > 0 && perSample[1] > 0 && perSample.slice(2).every((n) => n === 0),
    JSON.stringify(perSample))

  // ④c 分组可选:把「炭棒表观状态」那列挪到「表观及脱粉」组,表头第一级应出现该分组
  const groupBefore = await ev(`[...document.querySelectorAll('.fi-sheet .fi-grid thead .group')].map(e => (e.innerText||'').trim())`)
  const moved = await ev(`(() => {
    const ths = [...document.querySelectorAll('.fi-sheet .fi-grid thead .col-head')]
    // 找到列名是「炭棒表观状态」的那一列,点它的分组下拉
    const th = ths.find(t => (t.querySelector('.fi-colname input')?.value || '').trim() === '炭棒表观状态')
    if (!th) return 'no-col'
    const wrap = th.querySelector('.fi-colgroup .el-select__wrapper')
    if (!wrap) return 'no-select'
    wrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    wrap.click()
    return 'opened'
  })()`)
  await sleep(800)
  const picked = await ev(`(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter(e => e.offsetParent)
    const hit = opts.find(e => (e.innerText||'').trim() === '表观及脱粉')
    if (!hit) return { ok: false, n: opts.length, seen: opts.slice(0,6).map(e => (e.innerText||'').trim()) }
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true }
  })()`)
  await sleep(900)
  const groupAfter = await ev(`[...document.querySelectorAll('.fi-sheet .fi-grid thead .group')].map(e => (e.innerText||'').trim())`)
  console.log(`  分组 改前=${JSON.stringify(groupBefore)} 改后=${JSON.stringify(groupAfter)} (下拉=${moved}, 选中=${JSON.stringify(picked)})`)
  ok('④ 列头有分组选择入口', moved === 'opened', `${moved} ${JSON.stringify(picked)}`)
  ok('④ 挪列后表头多出「表观及脱粉」分组', groupAfter.includes('表观及脱粉'),
    `${JSON.stringify(groupBefore)} → ${JSON.stringify(groupAfter)}`)

  // ⚙ 截图留档(人眼比对图片版式;PROBE_SHOT 环境变量给输出路径)
  if (process.env.PROBE_SHOT) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(process.env.PROBE_SHOT, Buffer.from(shot.result.data, 'base64'))
    console.log(`  [shot] ${process.env.PROBE_SHOT}`)
  }

  // ⑤ 删列(填过内容的先确认)
  const beforeDel = await ev(readCols)
  const delRes = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const ths = [...s.querySelectorAll('.fi-grid thead .col-head')]
    // 删**勾过内容**的那一列:上面 ☑ 打在第 1 个 is-check 格(td,在表体里),
    // 故按"表体里哪个 is-check 格被勾了"反查它属于第几列,再去表头点该列的 ×。
    const checkTds = [...s.querySelectorAll('.sample-row td.is-check')]
    const idx = checkTds.findIndex(td => /☑/.test(td.innerText || ''))
    const th = ths[idx >= 0 ? idx : ths.length - 1]
    const del = th?.querySelector('.fi-coldel')
    if (!del) return { ok: false, reason: 'no-delete-btn' }
    del.click()
    return { ok: true }
  })()`)
  await sleep(900)
  const confirmShown = await ev(`!!document.querySelector('.el-message-box')`)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')].find(x=>(x.innerText||'').trim()==='确定'); if(b) b.click(); return 'ok' })()`)
  await sleep(900)
  const afterDel = await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    return { colHeads: ${readCols}, sampleRows: s.querySelectorAll('.sample-row').length }
  })()`)
  console.log(`  删列入口=${delRes.ok} 确认弹窗=${confirmShown} 删前=${JSON.stringify(beforeDel)} 删后=${JSON.stringify(afterDel.colHeads)}`)
  ok('⑤ 列头有删列「×」入口', delRes.ok === true, JSON.stringify(delRes))
  ok('⑤ 勾过内容的列删除前弹确认', confirmShown === true, `confirm=${confirmShown}`)
  ok('⑤ 删列后该列消失(其余列一行不动)', afterDel.colHeads.length === beforeDel.length - 1,
    `${JSON.stringify(beforeDel)} → ${JSON.stringify(afterDel.colHeads)}`)
  ok('⑤ 八个样品行原样保留', afterDel.sampleRows === 8, String(afterDel.sampleRows))

  ok('⑥ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 首件检验「测试项目可新增」界面:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)





