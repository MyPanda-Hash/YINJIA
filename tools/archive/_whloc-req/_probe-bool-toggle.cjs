/* 验证「档案行内 是否 开关点击后有视觉反馈」修复(2026-10-08)
   用法: node --experimental-websocket tools/archive/_whloc-req/_probe-bool-toggle.cjs [panelCode]
   背景:档案行是 markRaw 的,`v-model="row[c.prop]"` 写入不触发重渲染 ⇒ 开关点完弹回、
        看着像没反应(值其实已写进行对象)。修法:开关改受控 + 提交点显式 bump archVersion。
   ⚠ 本探针只切换草稿、**绝不点保存**,结束时直接杀掉浏览器 ⇒ 不落库、不改数据。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PANEL = process.argv[2] || 'WHLOC'
const FRONT = process.argv[3] || 'http://localhost:5173'
const API = 'http://localhost:8090'
const PORT = 9341
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!login.data?.token) throw new Error('登录失败: ' + JSON.stringify(login))
  const user = login.data.user
  console.log(`[login] ok admin=${user.isAdmin}`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bool-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1920,1080',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(3000)

  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || '') }
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(300); if ((await ev('document.readyState')) === 'complete') { await sleep(700); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-08'); 'ok'`)
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/${PANEL}`)
    await sleep(4000)

    console.log('[title]', await ev('document.title'))
    const hdrs = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>th.textContent.replace(/\\s+/g,'').trim())`)
    console.log('[表头]', JSON.stringify(hdrs))
    const idx = Array.isArray(hdrs) ? hdrs.findIndex((h) => h.includes('停用')) : -1
    console.log('[停用列下标]', idx)
    if (idx < 0) throw new Error('表头里找不到「停用」列(检查列虚拟化/视口宽度)')

    // ⚠ 档案面板默认只读:必须先点工具栏「修改」,单元格才可激活编辑(activateCell 守 detailEditable)
    console.log('[工具栏文本]', JSON.stringify(await ev(`[...document.querySelectorAll('.tb-main,.act-name')].map(e=>e.tagName+'.'+String(e.className)+'='+e.textContent.replace(/\\s+/g,'').trim()).slice(0,20)`)))
    const clickedModify = await ev(`(() => {
      const spans=[...document.querySelectorAll('.act-name')];
      const t=spans.find(s=>s.textContent.replace(/\\s+/g,'').trim()==='修改');
      if(!t) return 'not-found; 现有=' + spans.map(s=>s.textContent.trim()).join(',');
      const box=t.closest('.tb-main')||t.parentElement;
      // el-button 常挂在父级;直接派发鼠标事件序列更稳
      const r=box.getBoundingClientRect();
      const opts={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2};
      box.dispatchEvent(new MouseEvent('mousedown',opts));
      box.dispatchEvent(new MouseEvent('mouseup',opts));
      box.dispatchEvent(new MouseEvent('click',opts));
      return 'clicked';
    })()`)
    console.log('[点「修改」]', clickedModify, '(档案面板按 单据状态=启用 本就内联可编辑;此处仅尽力而为)')
    await sleep(1800)
    console.log('[修改后]', await ev(`'行数=' + document.querySelectorAll('.el-table__body .el-table__row').length`))

    const before = await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const r=rows[0]; if(!r) return {err:'无数据行'};
      const cell=r.children[${idx}]; if(!cell) return {err:'该行无此列(列虚拟化?)',cells:r.children.length};
      const textBefore=cell.textContent.trim();
      // ⚠ 点击处理器挂在内层 span.cell-lazy 上,点外层 td 不会向下派发 —— 必须点最内层可点元素
      const tgt = cell.querySelector('.cell-lazy') || cell.querySelector('.cell') || cell;
      tgt.click();
      return { textBefore, clickedOn: tgt.tagName+'.'+String(tgt.className).slice(0,40) };
    })()`)
    console.log('[激活前]', JSON.stringify(before))
    await sleep(700)

    const st1 = await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const cell=rows[0].children[${idx}];
      const sw=cell.querySelector('.el-switch');
      if(!sw) return {err:'激活后仍无 .el-switch', html:cell.innerHTML.slice(0,200)};
      const inp=sw.querySelector('input');
      return { checked: inp ? inp.checked : null, cls: sw.className, aria: sw.getAttribute('aria-checked') };
    })()`)
    console.log('[切换前开关态]', JSON.stringify(st1))
    if (st1?.err) throw new Error(st1.err)

    // 点开关核心
    await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const sw=rows[0].children[${idx}].querySelector('.el-switch');
      (sw.querySelector('.el-switch__core')||sw).click(); return 'clicked';
    })()`)
    await sleep(800)

    const st2 = await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const cell=rows[0].children[${idx}];
      const sw=cell.querySelector('.el-switch');
      const inp=sw ? sw.querySelector('input') : null;
      return { hasSwitch: !!sw, checked: inp ? inp.checked : null, cls: sw ? sw.className : null,
               aria: sw ? sw.getAttribute('aria-checked') : null, textAfter: cell.textContent.trim() };
    })()`)
    console.log('[切换后开关态]', JSON.stringify(st2))

    const flipped = st1 && st2 && st1.checked !== st2.checked
    console.log(flipped
      ? '>>> ✓ 开关视觉态已翻转(修复生效:点击后界面有反馈)'
      : '>>> ★ 开关视觉态未翻转(仍无反馈)')

    // 再点一次,确认能来回切
    await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const sw=rows[0].children[${idx}].querySelector('.el-switch');
      (sw.querySelector('.el-switch__core')||sw).click(); return 'clicked';
    })()`)
    await sleep(800)
    const st3 = await ev(`(() => {
      const sw=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${idx}].querySelector('.el-switch');
      const inp=sw?sw.querySelector('input'):null; return inp?inp.checked:null;
    })()`)
    console.log('[再点一次]', st3, st3 === st1.checked ? '✓ 回到初值(可反复切换)' : '★ 未回到初值')

    console.log('\n⚠ 全程未点「保存」,草稿随浏览器关闭丢弃,库内数据未变。')
  } finally {
    try { edge.kill() } catch {}
  }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
