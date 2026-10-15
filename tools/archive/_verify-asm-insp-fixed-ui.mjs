/*
 * _verify-asm-insp-fixed-ui.mjs — 「带入固定检验项」按钮界面实测(2026-10-16,一次性探针)
 *
 * 链路:登录 → 组装成品检验单 → 翻到草稿 → 工具栏「更多」→「带入固定检验项」
 *       → 断言明细里出现 端盖两头 / 管身两侧 两行(表区=外观,列里看不到表区,只看项目名)。
 * ⚠ 只读性质:只在页面内存里加行,**不点保存**(库里不留痕)。
 * 用法: node tools/archive/_verify-asm-insp-fixed-ui.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9470
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fixed-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let n = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(6500)

  /* 明细列里应有「检验结果」 */
  const heads = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean)`)
  console.log('   明细表头: ' + heads.join('|'))
  ok('明细出现「检验结果」列', heads.includes('检验结果'), heads.join('|'))

  /* 翻到草稿(已审核单只读,加了行也看不到编辑效果;与其它探针同款做法) */
  const findDraft = async () => {
    for (let i = 0; i < 8; i++) {
      if (await ev(`!!document.querySelector('.header-fields.is-draft')`)) return true
      const c = await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`)
      if (c !== 'OK') return false
      await sleep(1800)
    }
    return !!(await ev(`!!document.querySelector('.header-fields.is-draft')`))
  }
  const draft = await findDraft()
  ok('翻到一张草稿(可编辑)', draft)

  /* ══ 2026-10-16 口径变更:固定项**不再靠按钮带入**,而是分区渲染里**默认铺出的预置行** ══
     用户口径「不要实现使用按钮的形式进行操作,根据当前的实现方式使用组件形式完成对默认情况下增加
     三个检验 外观/尺寸/出货重量」+「按三区实现,没有数据的时候显示和当前截图形式相当即可」。
     ⇒ 本探针验:①三个区默认就在;②外观区**默认就有 端盖两头/管身两侧 两行**(不用点任何按钮);
       ③「更多」里**不再有**「带入固定检验项」动作;④点预置行能在该区落成真行(未保存只在内存)。 */
  const sections = await ev(`[...document.querySelectorAll('.arch-section')].map(s=>{
      const t=(s.querySelector('.arch-section-title')?.innerText||'').trim().split('\\n')[0];
      const rows=[...s.querySelectorAll('.el-table__body tbody tr')].map(tr=>(tr.innerText||'').replace(/\\s+/g,' ').trim());
      return {t, rows}})`)
  console.log('   分区: ' + (sections || []).map((s) => s.t).join(' | '))
  ok('默认就铺出三个固定区(外观/尺寸/出货重量)',
    (sections || []).length >= 3 && ['外观', '尺寸', '重量'].every((k) => (sections || []).some((s) => s.t.includes(k))),
    JSON.stringify((sections || []).map((s) => s.t)))
  const app = (sections || []).find((s) => /外观/.test(s.t)) || { rows: [] }
  ok('外观区**默认**已有「端盖两头」预置行(无需点按钮)', app.rows.some((r) => /端盖两头/.test(r)), JSON.stringify(app.rows).slice(0, 200))
  ok('外观区**默认**已有「管身两侧」预置行', app.rows.some((r) => /管身两侧/.test(r)), JSON.stringify(app.rows).slice(0, 200))

  /* 「更多」菜单里不该再有按钮式的「带入固定检验项」 */
  const clickMore = () => ev(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';(grp.querySelector('.tb-caret')||grp).click();return 'CLICKED'})()`)
  for (let i = 0; i < 3 && (await clickMore()) !== 'CLICKED'; i++) await sleep(500)
  await sleep(700)
  const menu = await ev(`[...document.querySelectorAll('.tb-menu .ctx-item')].map(x=>(x.textContent||'').trim()).join('|')`)
  console.log('   「更多」菜单: ' + String(menu).slice(0, 200))
  ok('「更多」里已无「带入固定检验项」动作(改为默认铺出)', !/带入固定检验项/.test(String(menu)), String(menu).slice(0, 160))
  await ev(`document.body.click()`)
  await sleep(300)

  /* 2026-10-16 口径:固定项**自动补成真行** ⇒ 不需要任何点击,直接可填;
     下面再验"点它可打开编辑器"。 */
  const realRows = () => ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
      return s? [...s.querySelectorAll('.el-table__body tbody tr')].filter(tr=>!tr.className.includes('ph-row')).map(tr=>(tr.innerText||'').replace(/\\s+/g,' ').trim()) : []})()`)
  const rb = await realRows()
  console.log('   外观区真行: ' + JSON.stringify(rb))
  ok('外观区**默认**就有 端盖两头 / 管身两侧 真行(无需点任何按钮)',
    rb.some((r) => /端盖两头/.test(r)) && rb.some((r) => /管身两侧/.test(r)), JSON.stringify(rb).slice(0, 200))

  /* 点它的「检验结果」格 ⇒ 出现编辑器(说明能填) */
  const pt = JSON.parse(String(await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
      const hs=[...s.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
      const ci=hs.indexOf('检验结果');
      const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>/端盖两头/.test(x.innerText||''));
      if(!tr||ci<0) return JSON.stringify({err:true});
      const td=tr.querySelectorAll('td')[ci]; const sp=td.querySelector('.cell-lazy')||td; const r=sp.getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.x+4), y:Math.round(r.y+r.height/2)}) })()`)))
  if (!pt.err) {
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
    }
  }
  await sleep(900)
  const editor = await ev(`document.querySelector('.arch-section .el-table__body input, .arch-section .el-table__body textarea') ? 'EDITOR' : 'NO'`)
  ok('固定项那格可点开录入(编辑器出现)', editor === 'EDITOR', String(editor))

  const after = await ev(`[...document.querySelectorAll('.arch-section .el-table__body tbody tr')].map(tr=>(tr.innerText||'').replace(/\\s+/g,' ').trim())`)
  ok('落成的真行仍带「端盖两头」(预置项目名没丢)', (after || []).some((r) => /端盖两头/.test(r)), JSON.stringify(after).slice(0, 200))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_verify-asm-insp-fixed-ui.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('   截图: ' + out)
  }
} finally { try { edge.kill() } catch {} }

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
