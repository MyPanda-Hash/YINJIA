/**
 * _verify-dblclick-no-dialog.mjs — 验收「双击明细行不再弹整单卡片(VoucherFormDialog)」
 * 背景(2026-10-15 用户口径):PanelxList.onDetailCellDblclick 原本在非草稿态 `openForm(cur.value)`,
 *      各单据面板双击明细行都会蹦出整单卡片;用户要求去掉,只保留「参照触发=双击」的选择器。
 * 断言:
 *   ① 双击明细行 → **没有** .el-dialog / .panelx-form(卡片没出现);
 *   ② 工具栏「修改」→ 卡片**仍然**能打开(功能没丢,只是不再挂在双击上);
 *   ③ 顺带打印卡片每格控件数(用于核对产物是否已回退到"每格两个框"的原始状态)。
 * 用法:node tools/archive/_probe-dblclick-form/_verify-dblclick-no-dialog.mjs [PANEL] [DOC] [--site URL]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flag = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const PANEL = argv[0] || 'PURCHASE_IN'
const DOC = argv[1] || 'PI-2026-10-0003'
const SITE = flag('site', 'http://127.0.0.1:8090')
/** 默认不落图(截图不入库);需要看图时加 --shots */
const SHOTS = process.argv.includes('--shots')
const PORT = 9418
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = path.resolve('D:/workspace/yinjia/.probe-edge-profile-dblclick')
const OUT = path.resolve('tools/archive/_probe-dblclick-form')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1600,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })
let version = null
for (let i = 0; i < 40 && !version; i++) { await sleep(500); try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch {} }
if (!version) { console.error('[FATAL] Edge 未就绪'); edge.kill(); process.exit(1) }

const errors = []
let failed = false
try {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const tab = targets.find((t) => t.type === 'page' && t.url === 'about:blank') || targets.find((t) => t.type === 'page')
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  let seq = 0; const pending = new Map()
  await new Promise((res, rej) => { socket.addEventListener('open', () => res()); socket.addEventListener('error', () => rej(new Error('ws fail'))) })
  socket.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data) } catch { return }
    if (m?.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m?.method === 'Runtime.exceptionThrown') errors.push('EXC ' + String(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text).slice(0, 200))
    if (m?.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') errors.push('CONSOLE ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); socket.send(JSON.stringify({ id, method, params })) })
  const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')

  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!login?.data?.token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 160))
  await send('Page.navigate', { url: SITE + '/#/login' }); await sleep(4000)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
            localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))});
            localStorage.setItem('mes_init_done', '1');
            localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
  await send('Page.navigate', { url: `${SITE}/#/panelx/list/${PANEL}` }); await sleep(11000)

  // 左栏选中目标单据(保证双击的是「已审核」那张)
  console.log('[左栏]', await ev(`(function(){
    const leaves = [...document.querySelectorAll('.doc-select-rail *')].filter((e) => e.children.length === 0);
    const el = leaves.find((e) => (e.innerText || '').trim() === ${JSON.stringify(DOC)})
      || leaves.find((e) => (e.innerText || '').includes(${JSON.stringify(DOC)}));
    if (!el) return 'not-found';
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
    return 'clicked:' + (el.innerText || '').trim().slice(0, 24);
  })()`))
  await sleep(2500)
  // 没有左栏(rail 未启用)的清单式面板:用「下一张」翻页定位目标单据
  let chip = await ev(`document.querySelector('.doc-chip')?.innerText || '(无)'`)
  for (let i = 0; i < 8 && !chip.includes(DOC); i++) {
    const moved = await ev(`(function(){
      const el = [...document.querySelectorAll('.page-btn')].find((e) => (e.getAttribute('title') || '') === '下一张');
      if (!el) return 'no-next';
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
      return 'next';
    })()`)
    if (moved !== 'next') break
    await sleep(2500)
    chip = await ev(`document.querySelector('.doc-chip')?.innerText || '(无)'`)
  }
  console.log('[当前单据]', chip, chip.includes(DOC) ? '✅ 命中所验单据' : '⚠ 未定位到所验单据(结论仅对当前这张有效)')

  // ① 双击明细行 → 不应出现弹窗
  const before = await ev(`document.querySelectorAll('.el-dialog').length`)
  console.log('[双击前 .el-dialog 数]', before)
  console.log('[双击明细行]', await ev(`(function(){
    const tds = [...document.querySelectorAll('.detail .el-table .el-table__body-wrapper tbody tr td')];
    if (!tds.length) return 'no-td';
    tds[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window, detail: 2 }));
    return 'dblclick@' + (tds[0].innerText || '').slice(0, 16) + ' (tds=' + tds.length + ')';
  })()`))
  await sleep(4500)
  const after = await ev(`JSON.stringify({
    dialogs: document.querySelectorAll('.el-dialog').length,
    forms: document.querySelectorAll('.panelx-form').length,
    titles: [...document.querySelectorAll('.el-dialog__title')].map((t) => t.innerText),
  })`)
  console.log('[双击后]', after)
  const a = JSON.parse(after)
  const noDialog = a.dialogs === 0 && a.forms === 0
  console.log(noDialog ? '① 双击明细行没有再弹卡片 ✅' : '① 双击明细行仍然弹出了卡片 ❌')
  if (!noDialog) failed = true
  const shot1 = SHOTS ? await send('Page.captureScreenshot', { format: 'png' }) : null
  if (shot1?.result?.data) fs.writeFileSync(path.join(OUT, `dblclick-${PANEL}-无弹窗.png`), Buffer.from(shot1.result.data, 'base64'))

  // ② 工具栏「修改」→ 卡片仍应能打开(草稿单该按钮本就禁用,此时跳过该断言)
  console.log('[点「修改」]', await ev(`(function(){
    const el = [...document.querySelectorAll('.tools .tb-main, .tools button')]
      .find((e) => (e.innerText || '').trim() === '修改');
    if (!el) return 'not-found';
    const disabled = String(el.className).includes('disabled');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
    return 'clicked' + (disabled ? '(按钮为灰:当前单据可原地编辑,按设计不弹卡片)' : '');
  })()`))
  await sleep(5500)
  const viaBtn = await ev(`JSON.stringify({
    dialogs: document.querySelectorAll('.el-dialog').length,
    title: document.querySelector('.el-dialog__title')?.innerText || '',
    fields: document.querySelectorAll('.el-dialog .panelx-form .fields .field').length,
    doubled: [...document.querySelectorAll('.el-dialog .panelx-form .fields .field')]
      .filter((f) => f.querySelectorAll('input, textarea').length > 1).length,
  })`)
  console.log('[「修改」后]', viaBtn)
  const b = JSON.parse(viaBtn)
  if (b.dialogs > 0 && b.fields > 0) console.log('② 工具栏「修改」仍能打开卡片 ✅')
  else if (String(await ev(`(() => { const el = [...document.querySelectorAll('.tools .tb-main')].find((e) => (e.innerText || '').trim() === '修改'); return el ? el.className : 'not-found' })()`)).includes('disabled')) {
    console.log('② 「修改」按钮为灰(草稿单原地编辑),本单不适用——跳过该断言')
  } else { console.log('② 「修改」打不开卡片 ❌'); failed = true }
  const shot2 = SHOTS ? await send('Page.captureScreenshot', { format: 'png' }) : null
  if (shot2?.result?.data) fs.writeFileSync(path.join(OUT, `modify-${PANEL}-仍可打开.png`), Buffer.from(shot2.result.data, 'base64'))

  console.log('[控制台错误]', errors.length, errors.slice(0, 4))
  console.log(`\n=== ${failed ? '未通过 ❌' : '通过 ✅'}:${PANEL} ${DOC} 双击明细行不弹卡片、修改按钮仍可打开 ===`)
  if (failed) process.exitCode = 1
} finally {
  try { edge.kill() } catch {}
  await sleep(300)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
}
