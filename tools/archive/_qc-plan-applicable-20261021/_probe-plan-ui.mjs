/*
 * 一次性 UI 探针:5174(临时 Vite)→ 8091(新后端)→ HSDZ_MES_TEST。
 * 验证检验标准库弹窗:按当前单据过滤、适用单据列、组装置顶 QP-ASM-00、项目 外观/尺寸/重量。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = 'http://localhost:5174'
const PORT = 9496
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败', JSON.stringify(login)); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-plan-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1800,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
if (!tab) { console.error('Edge 启动失败'); process.exit(1) }

const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map(); const errs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 300))
}
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1100, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
  localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
  localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_ASM_INSP` })
for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-page, .px-panel, .toolbar, .px-toolbar')`)) break }
await sleep(3000)
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/下次再说/.test(x.innerText||'')); if(b) b.click();
  const x=document.querySelector('.el-dialog__headerbtn'); if(x) x.click(); return 'ok' })()`)
await sleep(800)

// 找入口:在「更多」下拉里(检验项目/检验方案)。用真实鼠标事件打开下拉。
let clicked = false
for (let attempt = 0; attempt < 4 && !clicked; attempt++) {
  const r = await ev(`(() => {
    const g = [...document.querySelectorAll('.tb-group')].find(x => /更多/.test(x.innerText||''));
    if (!g) return null;
    const b = (g.querySelector('.tb-caret') || g).getBoundingClientRect();
    return { x: b.x + b.width/2, y: b.y + b.height/2 };
  })()`)
  console.log('moreRect', JSON.stringify(r), 'atPoint', JSON.stringify(await ev(`(() => { const e=document.elementFromPoint(${r?.x||0}, ${r?.y||0}); return e ? {tag:e.tagName, cls:e.className, txt:(e.innerText||'').slice(0,40)} : null })()`)))
  if (r) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, button: 'none' })
    await sleep(300)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
    await sleep(1000)
  }
  clicked = await ev(`(() => {
    const norm = (s) => (s||'').replace(/\s+/g,'');
    const g = [...document.querySelectorAll('.tb-group')].find(x => /更多/.test(norm(x.innerText||'')));
    if (!g) return false;
    const item = [...g.querySelectorAll('*')]
      .find(x => x.children.length === 0 && /检验项目/.test(norm(x.innerText||'')));
    if (!item) return false;
    item.click(); return true;
  })()`)
  await sleep(1000)
  console.log('afterClickCands', JSON.stringify(await ev(`[...document.querySelectorAll('*')].filter(x=>/检验项目/.test(x.innerText||'') && (x.children.length===0 || ['LI','DIV','SPAN','A'].includes(x.tagName))).slice(0,10).map(x=>({tag:x.tagName,cls:String(x.className).slice(0,50),txt:(x.innerText||'').trim().slice(0,60)}))`)))
}
await sleep(2500)
const dialog = await ev(`(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find(x => /检验标准库|检验项目\\/检验方案|检验方案/.test(x.innerText||''));
  return d ? { text: (d.innerText||'').slice(0, 300) } : null
})()`)
console.log('入口 clicked=', clicked, 'dialog=', JSON.stringify(dialog)?.slice(0, 400))
if (!dialog) {
  console.log('=== buttons ===')
  console.log(await ev(`[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,80).join(' | ')`))
  console.log('=== errs ===', errs)
  process.exit(2)
}

// 等方案表
await sleep(1500)
const planRows = await ev(`[...[...document.querySelectorAll('.qcplan-sec')][0].querySelectorAll('.el-table__body tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()))`)
console.log('planRows=', JSON.stringify(planRows).slice(0, 1200))
ok('方案表按当前单据过滤,只剩 2 套组装方案', Array.isArray(planRows) && planRows.length === 2, String(planRows?.length))
ok('第一行(置顶)= QP-ASM-00', String(planRows?.[0]?.[0] || '').includes('QP-ASM-00'), String(planRows?.[0]?.[0]))
const firstText = (planRows?.[0] || []).join('|')
ok('置顶方案含 外观、尺寸、重量', /外观、尺寸、重量/.test(firstText), firstText.slice(0, 160))
ok('置顶方案「适用单据」= 组装成品检验单', /组装成品检验单/.test(firstText), firstText.slice(0, 160))
ok('方案表出现「适用单据」列头', await ev(`[...document.querySelectorAll('.qcplan-sec .el-table__header th')].some(th=>/适用单据/.test(th.innerText||''))`))

// 项目表:置顶方案下 3 条,项目名称 外观/尺寸/重量
const itemRows = await ev(`[...document.querySelectorAll('.qcplan-sec')][1] ? [...[...document.querySelectorAll('.qcplan-sec')][1].querySelectorAll('.el-table__body tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())) : []`)
console.log('itemRows=', JSON.stringify(itemRows).slice(0, 1200))
const itemNames = (itemRows || []).map(r => r[3])
ok('置顶方案下有 3 条检验项目', itemRows?.length === 3, String(itemRows?.length))
ok('项目名称 = 外观 / 尺寸 / 重量', JSON.stringify(itemNames) === JSON.stringify(['外观', '尺寸', '重量']), JSON.stringify(itemNames))

// 显示全部单据:旧 Y料方案(未填适用单据)只在勾选后出现
const allCount = await (async () => {
  await ev(`(() => { const l=[...document.querySelectorAll('.qcplan-bar .el-checkbox')].find(x=>/显示全部单据的方案/.test(x.innerText||'')); if(l) l.click(); return 'ok' })()`)
  await sleep(1500)
  return await ev(`[...[...document.querySelectorAll('.qcplan-sec')][0].querySelectorAll('.el-table__body tr')].length`)
})()
console.log('allCount=', allCount)
ok('勾「显示全部单据」后旧 Y料方案也出现', Number(allCount) > 2, String(allCount))
// 恢复只看本单
await ev(`(() => { const l=[...document.querySelectorAll('.qcplan-bar .el-checkbox')].find(x=>/显示全部单据的方案/.test(x.innerText||'')); if(l) l.click(); return 'ok' })()`)
await sleep(1200)

// 带入明细:三条项目各自的类别必须落成 外观 / 尺寸 / 出货重量(不能全归成外观)
await ev(`(() => {
  const secs = [...document.querySelectorAll('.qcplan-sec')];
  const itemSec = secs[1];
  if (!itemSec) return 'no-item-sec';
  for (const tr of itemSec.querySelectorAll('tbody tr')) { const cb = tr.querySelector('td .el-checkbox, .el-checkbox'); if (cb) cb.click(); }
  return 'checked';
})()`)
await sleep(500)
await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button, .el-dialog .el-button')].find(x=>/带入明细/.test(x.innerText||'')); if(b) b.click(); return 'ok' })()`)
await sleep(500)
console.log('pickedTip=', await ev(`[...document.querySelectorAll('.qcplan-count')].map(x=>x.innerText.trim()).join(' | ')`))
await sleep(1200)
const added = await ev(`[...document.querySelectorAll('tr')].filter(tr=>/ASM-APPEARANCE|ASM-DIMENSION|ASM-WEIGHT/.test(tr.innerText||'')).map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()).slice(0,4))`)
console.log('addedRows=', JSON.stringify(added))
if (Array.isArray(added) && added.length >= 3) {
  const types = Object.fromEntries(added.map(r => [r.join('|'), r]))
  const findType = (code) => (added.find(r => r.some(c => c === code)) || [])[0]
  ok('带入后 ASM-APPEARANCE 类别=外观', /外观/.test(added.find(r => r.some(c => c === 'ASM-APPEARANCE'))?.[0] || ''), JSON.stringify(added.find(r => r.some(c => c === 'ASM-APPEARANCE'))))
  ok('带入后 ASM-DIMENSION 类别=尺寸', /尺寸/.test(added.find(r => r.some(c => c === 'ASM-DIMENSION'))?.[0] || ''), JSON.stringify(added.find(r => r.some(c => c === 'ASM-DIMENSION'))))
  ok('带入后 ASM-WEIGHT 类别=出货重量', /出货重量/.test(added.find(r => r.some(c => c === 'ASM-WEIGHT'))?.[0] || ''), JSON.stringify(added.find(r => r.some(c => c === 'ASM-WEIGHT'))))
}

// 只截弹窗
const clip = await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验方案/.test(x.innerText||'')); if(!d) return null; const r=d.getBoundingClientRect(); return {x:Math.max(0,r.x),y:Math.max(0,r.y),width:Math.min(1800,r.width),height:Math.min(1100,r.height)} })()`)
if (clip) {
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })
  fs.writeFileSync('D:/workspace/yinjia/.tmp/qc-plan-dialog.png', Buffer.from(shot.result.data, 'base64'))
  console.log('screenshot=.tmp/qc-plan-dialog.png')
}
console.log('errs=', errs)
console.log(`RESULT pass=${pass} fail=${fail}`)
ws.close()
edge.kill()
process.exit(fail ? 1 : 0)
