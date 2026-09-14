// _probe-lib-destroy.cjs — 彻底删除功能验收:
//   ① 规格书弹窗:自建条目 → 🗑 → 确认 → 条目从弹窗消失且 DB 物理删除(区别于停用:不可恢复)
//   ② 出货计划弹窗:同样链路(扁平表)
//   ③ 种子条目也有 🗑(不点,只验存在)——所有库条目均可彻底删除
// 用法: node tools/_probe-lib-destroy.cjs [BASE]
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9391
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const MARK = '删除探针' + Date.now().toString().slice(-5)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ds-'))
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

    // ── ① 规格书:自建 → 🗑 删除 ──
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(1200)
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var x=(all[i].textContent||'').trim();if(x==='新增'&&all[i].offsetParent){all[i].click();return 1}}return 0})()`)
    await sleep(3500)
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.rsp-page-tab'));for(var i=0;i<t.length;i++){if((t[i].textContent||'').indexOf('检验')>=0){t[i].click();return 1}}return 0})()`)
    await sleep(700)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-lib-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('标准库')>=0&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    await sleep(1400)
    const seedHasDestroy = await ev(`document.querySelectorAll('.lib-sub-destroy').length`)
    ok(seedHasDestroy >= 48, `③ 规格书种子条目均有 🗑 入口(=${seedHasDestroy}≥48)`)
    // 自建一条(组名=探针组)
    await ev(`(function(){var f=document.querySelectorAll('.el-dialog .lib-custom-form .el-input__inner');
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(f[0],${JSON.stringify(MARK)});f[0].dispatchEvent(new Event('input',{bubbles:true}));
      var ta=document.querySelector('.el-dialog .lib-custom-form textarea');
      var tset=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      tset.call(ta,'探针要求');ta.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form .el-button'));
      for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').trim();if(t==='存入标准库'){bs[i].click();return 1}}return 0})()`)
    await sleep(1500)
    const addedVisible = await ev(`(function(){var gs=[].slice.call(document.querySelectorAll('.lib-group'));
      for(var i=0;i<gs.length;i++){if((gs[i].textContent||'').indexOf(${JSON.stringify(MARK)})>=0)return 1}return 0})()`)
    ok(addedVisible === 1, `①-1 自建条目已入库显示(${MARK})`)
    const beforeList = await api('/api/stdlib/list?lib=spec.test&all=1')
    const rowBefore = (beforeList.data || []).filter((r) => String(r.content || '').includes(MARK))
    ok(rowBefore.length === 1, `①-2 DB 存在该行(id=${rowBefore[0] && rowBefore[0].id})`)
    // 点该组的 🗑 → 确认弹窗 → 确定
    await ev(`(function(){var gs=[].slice.call(document.querySelectorAll('.lib-group'));
      for(var i=0;i<gs.length;i++){if((gs[i].textContent||'').indexOf(${JSON.stringify(MARK)})>=0){
        var d=gs[i].querySelector('.lib-sub-destroy');if(d){d.click();return 1}}}return 0})()`)
    await sleep(700)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.el-message-box__btns .el-button--primary'));
      if(b.length){b[b.length-1].click();return 1}return 0})()`)
    await sleep(1600)
    const afterList = await api('/api/stdlib/list?lib=spec.test&all=1')
    const rowAfter = (afterList.data || []).filter((r) => String(r.content || '').includes(MARK))
    ok(rowAfter.length === 0, `①-3 🗑 彻底删除后 DB 行已消失(物理删,剩 ${rowAfter.length})`)
    const goneUi = await ev(`(function(){var gs=[].slice.call(document.querySelectorAll('.lib-group'));
      for(var i=0;i<gs.length;i++){if((gs[i].textContent||'').indexOf(${JSON.stringify(MARK)})>=0)return 1}return 0})()`)
    ok(goneUi === 0, '①-4 弹窗中该组已消失(重载)')
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__headerbtn'));if(bs.length)bs[bs.length-1].click();return 1})()`)

    // ── ② 出货计划:同链路 ──
    await nav(`${BASE}/#/panelx/list/RD_INSP_PLAN`)
    await sleep(1600)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-lib-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('标准库')>=0&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    await sleep(1400)
    // 自建一条(控制项目=MARK)
    await ev(`(function(){var f=document.querySelectorAll('.el-dialog .lib-custom-form .el-input__inner');
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(f[0],${JSON.stringify(MARK)});f[0].dispatchEvent(new Event('input',{bubbles:true}));
      var ta=document.querySelector('.el-dialog .lib-custom-form textarea');
      var tset=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      tset.call(ta,'探针要求');ta.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form .el-button'));
      for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').trim();if(t==='存入标准库'){bs[i].click();return 1}}return 0})()`)
    await sleep(1500)
    const flatHasDestroy = await ev(`document.querySelectorAll('.el-dialog .lib-sub-destroy').length`)
    ok(flatHasDestroy >= 8, `②-1 扁平表全部条目有 🗑(=${flatHasDestroy}≥7种子+1自建)`)
    // 找到自建行点 🗑 → 确认
    await ev(`(function(){var trs=[].slice.call(document.querySelectorAll('.el-dialog .el-table__body-wrapper tbody tr'));
      for(var i=0;i<trs.length;i++){if((trs[i].textContent||'').indexOf(${JSON.stringify(MARK)})>=0){
        var d=trs[i].querySelector('.lib-sub-destroy');if(d){d.click();return 1}}}return 0})()`)
    await sleep(700)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.el-message-box__btns .el-button--primary'));
      if(b.length){b[b.length-1].click();return 1}return 0})()`)
    await sleep(1600)
    const afterFlat = await api('/api/stdlib/list?lib=insp.plan&all=1')
    const rowAfterFlat = (afterFlat.data || []).filter((r) => String(r.content || '').includes(MARK))
    ok(rowAfterFlat.length === 0, `②-2 扁平自建条目已物理删除(剩 ${rowAfterFlat.length})`)
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
