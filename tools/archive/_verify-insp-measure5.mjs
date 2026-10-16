/*
 * _verify-insp-measure5.mjs — 「每行 5 个测量值」实测(2026-10-16,一次性探针)
 *
 * 验两件事:
 *   ① API:三张工序检验单(组装成品/成型/切炭)的面板明细列里,测量值1..5 **按序**出现;
 *   ② 界面:打开组装成品检验单,明细表头出现 测量值1..5,且测量值格**可编辑**(点开出现输入框、可赋值)。
 *
 * ⚠ 只读:只在页面内存里赋值验证可编辑性,**不点保存**(正式库不落任何测试数据)。
 * 用法: node tools/archive/_verify-insp-measure5.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9463
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const MEASURES = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: 'Bearer ' + login.data.token }

/* ① API:三张单的明细列 */
const detailCols = async (p) => {
  const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${p}`, { headers: H }).then((r) => r.json())).data
  const main = cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]
  return (main?.columns || []).map((f) => (typeof f === 'string' ? f : (f.dataName || f.label)))
}
for (const p of ['QC_ASM_INSP', 'QC_MOLD_INSP', 'QC_CUT_INSP']) {
  const cols = await detailCols(p)
  const idx = MEASURES.map((m) => cols.indexOf(m))
  ok(`${p} 明细列含 测量值1..5`, idx.every((i) => i >= 0), cols.join('|'))
  ok(`${p} 5 格按 1→5 顺序排列`, idx.every((v, i) => i === 0 || v === idx[i - 1] + 1), idx.join(','))
}

/* ② 界面:表头 + 可编辑 */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-m5-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(6500)

  const heads = await ev(`[...document.querySelectorAll('.arch-section .el-table__header th, .el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean)`)
  console.log('   明细表头(分区后): ' + heads.join('|'))
  ok('界面表头出现 测量值1..5(定量区:尺寸/出货重量)', MEASURES.every((m) => heads.includes(m)), heads.join('|'))
  ok('5 格都在(每区各一套,故用"都出现"判定)', MEASURES.every((m) => heads.filter((x) => x === m).length >= 1), heads.join('|'))

  /* 该草稿明细可能为空 ⇒ 先在某区加一行(仅页面内存,不保存),再验测量值格可编辑。
     ⚠ 列表页默认打开的那张可能是「已审核」(只读,格子点不开编辑器)⇒ 先按「下一张」翻页找草稿。 */
  const findDraft = async () => {
    for (let i = 0; i < 8; i++) {
      if (await ev(`!!document.querySelector('.header-fields.is-draft')`)) return true
      const c = await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`)
      if (c !== 'OK') return false
      await sleep(1800)
    }
    return !!(await ev(`!!document.querySelector('.header-fields.is-draft')`))
  }
  const editable = await findDraft()
  if (!editable) {
    console.log('   -- 跳过「可编辑」子项:翻遍单据没找到草稿(只读态);落库由 _verify-insp-measure5-save.mjs 覆盖')
  } else {
  /* 2026-10-16 口径:分区里**没有加行入口** —— 加行只在最下面「明细行」列表里做
     (该列表的空占位行点击即新增行)。这里就用它建一行,再验测量值格可编辑。 */
  const added = await ev(`(()=>{
     const band=document.querySelector('.arch-detail-band');
     const box=band && band.parentElement;
     if(!box) return 'NO_BAND';
     const tr=[...box.querySelectorAll('.el-table__body tbody tr')][0];
     if(!tr) return 'NO_ROW';
     const r=tr.getBoundingClientRect();
     return JSON.stringify({x:Math.round(r.x+40), y:Math.round(r.y+r.height/2)}) })()`)
  const rowPt = (() => { try { return JSON.parse(String(added)) } catch { return null } })()
  if (rowPt && !rowPt.err && typeof rowPt.x === 'number') {
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: rowPt.x, y: rowPt.y, button: 'left', clickCount: 1 })
    }
  }
  await sleep(1200)
  const rowCount = await ev(`(()=>{const band=document.querySelector('.arch-detail-band'); const box=band&&band.parentElement;
     return box? [...box.querySelectorAll('.el-table__body tbody tr')].filter(tr=>!tr.className.includes('ph-row')).length : -1})()`)
  ok('在「明细行」列表点空占位行 ⇒ 新增一行(加行入口在这里)', (rowCount || 0) > 0, 'realRows=' + rowCount)

  /* 点开「明细行」列表里那条真行的「测量值1」格。
     ⚠ 格子是**懒激活**(未激活时只渲染 <span class="cell-lazy">),合成 td.click() 打不开,
       必须用 CDP 真实鼠标;且要点 span 本身(空格子 td 中心可能落空)。 */
  const cellPoint = async (label = '测量值1') => JSON.parse(String(await ev(`(()=>{
     const band=document.querySelector('.arch-detail-band'); const box=band&&band.parentElement;
     if(!box) return JSON.stringify({err:'NO_BAND'});
     const hs=[...box.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=hs.indexOf(${JSON.stringify(label)});
     const tr=[...box.querySelectorAll('.el-table__body tbody tr')].find(x=>!x.className.includes('ph-row'));
     if(!tr||ci<0) return JSON.stringify({err:true,ci:ci});
     const td=tr.querySelectorAll('td')[ci];
     const sp=td.querySelector('.cell-lazy')||td.querySelector('.cell')||td;
     const r=sp.getBoundingClientRect();
     return JSON.stringify({x:Math.round(r.x+4), y:Math.round(r.y+r.height/2)}) })()`)))
  const pt = await cellPoint('测量值1')
  ok('定位到「测量值1」格', !!pt && !pt.err, JSON.stringify(pt))
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
  }
  await sleep(800)
  const typed = await ev(`(()=>{
     const band=document.querySelector('.arch-detail-band'); const box=band&&band.parentElement;
     const inp=box && box.querySelector('.el-table__body input.el-input__inner, .el-table__body input[type=number]');
     if(!inp) return 'NO_INPUT';
     const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
     set.call(inp,''); inp.dispatchEvent(new Event('input',{bubbles:true}));
     inp.focus();
     return 'READY' })()`)
  ok('测量值格是数值编辑器(出现 number 输入框)', typed === 'READY', String(typed))
  /* 用真实键盘输入:CDP 插入文本(比派发合成事件更贴近人工录入) */
  await send('Input.insertText', { text: '12.5' })
  await sleep(300)
  /* ⚠ 格子处于编辑态时 td.innerText 是空的(里面是个 input)—— 必须**再点相邻格**让编辑器收格,
     才能读到模型回显(2026-10-16 实测踩到,第一版断言因此假失败)。 */
  const pt2 = await cellPoint('测量值2')
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: pt2.x, y: pt2.y, button: 'left', clickCount: 1 })
  }
  await sleep(800)
  const shown = await ev(`(()=>{
     const band=document.querySelector('.arch-detail-band'); const box=band&&band.parentElement;
     if(!box) return '';
     const hs=[...box.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=hs.indexOf('测量值1');
     const tr=[...box.querySelectorAll('.el-table__body tbody tr')].find(x=>!x.className.includes('ph-row'));
     return tr ? (tr.querySelectorAll('td')[ci].innerText||'').trim() : '' })()`)
  ok('真实键入 12.5 后回显在「测量值1」格(值进了页面模型)', String(shown).includes('12.5'), '格子显示=' + String(shown))
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_verify-insp-measure5-ui.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('   截图: ' + out)
  }
} finally {
  try { edge.kill() } catch {}
}

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
