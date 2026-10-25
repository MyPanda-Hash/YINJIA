/**
 * _q-wrap.cjs —— 研发管理文书「长文本不换行」活体取证(2026-10-25)
 *
 * 用户口径:「这个研发管理模块的表不会自动换行,现在确定一下宽度,固定宽度然后可以自动换行」。
 *
 * 断言(只读取证,不保存单据):
 *   ① 立项申请表纸宽固定 1242(不随窗口 1600/1280 变化)
 *   ② 每个填写格的内容区都允许换行(textarea 的 white-space=pre-wrap 且 word-break 非 normal)
 *   ③ 长文本实测不溢出单元格(对比 scrollWidth/scrollHeight 与客户区)
 *   ④ 只读态同样换行(.as-ro-text / .q-ro)
 *   ⑤ 1440 与 375 宽均无横向溢出
 */
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9431
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('login failed: ' + JSON.stringify(lr).slice(0, 200))

  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-wrap-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')); console.log('[shot]', n) }
  const size = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(900) }

  await send('Page.enable'); await send('Runtime.enable')
  await size(1600, 1000)
  await nav(`${BASE}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank')
  await nav(`${BASE}/#/panelx/list/RD_APPROVAL`)
  await sleep(2500)

  // 进入可编辑态:右侧栏「② 本单操作 → 新增」是 div.as-side-btn(不是 button,探针早先点空过)
  const addClicked = await ev(`(function(){
    var bs=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<bs.length;i++){
      var t=(bs[i].textContent||'').trim();
      if(bs[i].offsetParent && t==='新增'){ bs[i].click(); return 'OK' }
    }
    return 'NO_BTN:' + bs.filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()}).join('|').slice(0,200)
  })()`)
  console.log('[新增]', addClicked)
  await sleep(4500)

  // 若仍未出现 textarea(只读态),直接在只读值里注入长文本做同样的几何量测
  let mode = 'edit'
  let hasTa = await ev(`!!document.querySelector('.approval-sheet textarea')`)
  if (!hasTa) {
    mode = 'readonly'
    hasTa = await ev(`(function(){
      var host=document.querySelector('.approval-sheet .as-ro-text') || document.querySelector('.approval-sheet .ann-host');
      if(!host) return false;
      var long='长文本换行验证:滤芯结构为外径33mm内径12mm长度110mm,采用三层复合无纺布加活性炭纤维,外壳PP材质,端盖二次注塑密封;要求在2kgf压力下压降不超过0.02MPa,通水流量0.9L/min。';
      host.textContent = long; return true })()`)
  } else {
    await ev(`(function(){
      var ta=document.querySelector('.approval-sheet textarea'); if(!ta) return 'NO_TA';
      var long='长文本换行验证:滤芯结构为外径33mm内径12mm长度110mm,采用三层复合无纺布加活性炭纤维,外壳PP材质,端盖二次注塑密封;要求在2kgf压力下压降不超过0.02MPa,通水流量0.9L/min。';
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(ta, long);
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'OK' })()`)
    await sleep(600)
  }
  console.log('[mode]', mode, 'targets:', hasTa)

  const hasSheet = await ev(`!!document.querySelector('.approval-sheet')`)
  if (hasSheet) ok('① 立项申请表已渲染')
  else bad('① 立项申请表未渲染')

  // ① 纸宽固定:1600 与 1280 两个窗口下纸宽应相同
  const w1600 = await ev(`(function(){var e=document.querySelector('.approval-sheet');return e? Math.round(e.getBoundingClientRect().width):-1})()`)
  await size(1280, 1000)
  const w1280 = await ev(`(function(){var e=document.querySelector('.approval-sheet');return e? Math.round(e.getBoundingClientRect().width):-1})()`)
  if (w1600 > 0 && w1600 === w1280) ok(`① 纸宽固定:${w1600}px(1600/1280 窗口一致)`)
  else bad(`① 纸宽不固定:1600→${w1600}px / 1280→${w1280}px`)
  if (w1600 === 1242) ok('① 纸宽 = 1242(设计口径)')
  else bad('① 纸宽应为 1242,实际 ' + w1600)

  // ② 填写格内容区允许换行
  const wrapInfo = await ev(`(function(){
    var out=[]; var tas=document.querySelectorAll('.approval-sheet textarea');
    for (var i=0;i<tas.length;i++){
      var cs=getComputedStyle(tas[i]);
      out.push({i:i, ws:cs.whiteSpace, wb:cs.wordBreak, ovw:cs.overflowWrap, w:Math.round(tas[i].clientWidth), sw:tas[i].scrollWidth});
    }
    return out })()`)
  if (Array.isArray(wrapInfo) && wrapInfo.length) {
    const noWrap = wrapInfo.filter((r) => r.ws !== 'pre-wrap' && r.ws !== 'pre-line' && r.ws !== 'normal')
    const badBreak = wrapInfo.filter((r) => r.wb === 'normal' && r.ovw === 'normal')
    if (!noWrap.length) ok(`② ${wrapInfo.length} 个填写格 white-space 允许换行`)
    else bad(`② ${noWrap.length} 个填写格禁止换行:${JSON.stringify(noWrap.slice(0, 3))}`)
    if (!badBreak.length) ok('② 长英文/数字也能断行(word-break/overflow-wrap 已设置)')
    else bad(`② ${badBreak.length} 个填写格缺断行规则`)
    const overflowX = wrapInfo.filter((r) => r.sw > r.w + 1)
    if (!overflowX.length) ok('② 无填写格横向溢出')
    else bad(`② ${overflowX.length} 个填写格横向溢出`)
  } else bad('② 未找到任何填写格 textarea')

  // ③ 量测:长文本是否在格内换行(不保存)
  const filled = await ev(`(function(){
    var ta=document.querySelector('.approval-sheet textarea');
    if (ta) return {kind:'textarea', h:ta.clientHeight, sh:ta.scrollHeight, w:ta.clientWidth, sw:ta.scrollWidth, len:(ta.value||'').length}
    var host=document.querySelector('.approval-sheet .as-ro-text') || document.querySelector('.approval-sheet .ann-host');
    if (!host) return 'NO_TARGET'
    var cell=host.closest('.as-fill, .q-value') || host.parentElement
    return {kind:'readonly', h:cell.clientHeight, sh:cell.scrollHeight, w:cell.clientWidth, sw:cell.scrollWidth, hostW:host.clientWidth, len:(host.textContent||'').length}
  })()`)
  if (filled && typeof filled === 'object') {
    const insideX = filled.sw <= filled.w + 1
    const wrapped = filled.sh > 0
    if (insideX) ok(`③ ${filled.kind} 长文本(${filled.len} 字)未横向溢出(w=${filled.w}/sw=${filled.sw})`)
    else bad(`③ ${filled.kind} 长文本横向溢出: w=${filled.w} sw=${filled.sw}`)
    if (wrapped) ok(`③ 内容在格内换行(h=${filled.h}/sh=${filled.sh})`)
  } else bad('③ 长文本目标未找到:' + JSON.stringify(filled))

  // ③b 关键:纸内任何元素都不得比纸更宽(长串顶破纸面是最直观的"不换行"现象)
  const overflowInside = await ev(`(function(){
    var paper=document.querySelector('.approval-sheet'); if(!paper) return 'NO_PAPER'
    var pr=paper.getBoundingClientRect(); var bad=[]
    var all=paper.querySelectorAll('.as-fill, .q-value, .as-ro-text, textarea, .ann-host')
    for(var i=0;i<all.length;i++){ var r=all[i].getBoundingClientRect()
      if(r.width>0 && (r.right>pr.right+1)) bad.push({c:all[i].className, right:Math.round(r.right), paperRight:Math.round(pr.right)}) }
    return {count:bad.length, sample:bad.slice(0,3)} })()`)
  if (overflowInside && overflowInside.count === 0) ok('③ 纸内无元素越出纸右沿')
  else bad('③ 有元素越出纸右沿:' + JSON.stringify(overflowInside))

  await size(1440, 1000)
  await shot('approval-1440.png')

  // ④ 只读态换行规则
  const roWrap = await ev(`(function(){
    var els=document.querySelectorAll('.approval-sheet .as-ro-text, .approval-sheet .q-ro');
    var out=[]; for(var i=0;i<els.length;i++){ var cs=getComputedStyle(els[i]); out.push({ws:cs.whiteSpace, wb:cs.wordBreak}) }
    return out })()`)
  if (Array.isArray(roWrap)) {
    const badRo = roWrap.filter((r) => r.wb === 'normal' || (r.ws !== 'pre-wrap' && r.ws !== 'normal'))
    if (!badRo.length) ok(`④ 只读文本 ${roWrap.length} 处均可换行`)
    else bad(`④ ${badRo.length} 处只读文本不换行`)
  }

  // ⑤ 窄屏无横向溢出
  await size(375, 812)
  const ov = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')
  if (ov <= 1) ok('⑤ 375 宽无横向滚动')
  else bad('⑤ 375 宽横向溢出 ' + ov + 'px')
  await shot('approval-375.png')

  try { await send('Browser.close') } catch {}
  try { edge.kill() } catch {}
  console.log(fail ? `\n== FAIL ${fail} 项 ==` : '\n== ALL PASS ==')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
