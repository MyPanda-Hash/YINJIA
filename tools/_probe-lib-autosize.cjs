// _probe-lib-autosize.cjs — 标准库编辑表单自适应验收:
//   ① 规格书:编辑带入长文本(检验要求数百字) → textarea 高度随内容增长(≥5 行),不再挤 2 行小框
//   ② 出货计划:编辑带入 控制标准及要求(长) → 高度自适应 + 宽度 460px
//   ③ 弹窗无「已停用」残留(种子恢复启用后)
// 用法: node tools/_probe-lib-autosize.cjs [BASE]
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9392
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-as-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')

    // ── ① 规格书:编辑长文本条目 ──
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(1200)
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var x=(all[i].textContent||'').trim();if(x==='新增'&&all[i].offsetParent){all[i].click();return 1}}return 0})()`)
    await sleep(3500)
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.rsp-page-tab'));for(var i=0;i<t.length;i++){if((t[i].textContent||'').indexOf('检验')>=0){t[i].click();return 1}}return 0})()`)
    await sleep(700)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-lib-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('标准库')>=0&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    await sleep(1400)
    const offCnt = await ev(`document.querySelectorAll('.lib-sub-item-off').length`)
    ok(offCnt === 0, `③ 规格书弹窗无「已停用」残留(=${offCnt})`)
    // 勾第一条(外观组空名子项,req 很长) → 编辑
    await ev(`(function(){var c=document.querySelector('.lib-sub-item input[type=checkbox]');if(c){c.click();return 1}return 0})()`)
    await sleep(300)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__footer .el-button'));
      for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='编辑'){bs[i].click();return 1}}return 0})()`)
    await sleep(800)
    const specTa = await ev(`(function(){var f=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form textarea'));
      if(!f.length)return 'none';
      var t=f[0];return JSON.stringify({h:t.clientHeight,w:t.parentElement.clientWidth||t.clientWidth,rows:Math.round(t.clientHeight/(t.clientHeight/ (t.rows||1))/1)||0})})()`)
    let s1 = {}
    try { s1 = JSON.parse(specTa || '{}') } catch { s1 = { parseFail: specTa } }
    ok(s1.h >= 96, `①-1 检验要求域随长内容增高(clientHeight=${s1.h}px ≥ 96 ≈ 5 行)`)
    ok((s1.w || 0) >= 440, `①-2 长文本域已加宽(宽=${s1.w}px ≥ 440)`)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__headerbtn'));if(bs.length)bs[bs.length-1].click();return 1})()`)

    // ── ② 出货计划 ──
    await nav(`${BASE}/#/panelx/list/RD_INSP_PLAN`)
    await sleep(1600)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-lib-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('标准库')>=0&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    await sleep(1400)
    // 勾第一行(*外观,控制标准及要求 中长) → 编辑
    await ev(`(function(){var c=document.querySelector('.el-dialog .el-table__body-wrapper input[type=checkbox]');if(c){c.click();return 1}return 0})()`)
    await sleep(300)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__footer .el-button'));
      for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='编辑'){bs[i].click();return 1}}return 0})()`)
    await sleep(800)
    const flatTa = await ev(`(function(){var f=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form textarea'));
      if(!f.length)return 'none';var t=f[0];
      return JSON.stringify({h:t.clientHeight,w:t.parentElement.clientWidth||t.clientWidth})})()`)
    let s2 = {}
    try { s2 = JSON.parse(flatTa || '{}') } catch { s2 = { parseFail: flatTa } }
    ok((s2.w || 0) >= 440, `②-1 控制标准及要求域加宽(宽=${s2.w}px ≥ 440)`)
    ok((s2.h || 0) >= 44, `②-2 域高度≥2 行下限(${s2.h}px)`)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__headerbtn'));if(bs.length)bs[bs.length-1].click();return 1})()`)
  } catch (e) {
    console.error('PROBE ERROR', e); fails.push('probe error: ' + (e && e.message))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
