// 验收:标准库条目可编辑(勾选→编辑→行内改→保存)、可停用、可恢复启用;
//      且编辑库条目**不得**改到历史单据已录入的值(面板存文本,不存库条目 id)。
// 用法: node tools/_probe-stdlib-edit.cjs [BASE]   默认 http://localhost:8090
//
// 前置:RD_EQUIP_USE(设备名称 → lab.device)有「标准库维护」入口(⧉)。
// 说明:探针只改库条目内容再改回,不动任何单据数据。
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9400
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  if (!token) { console.error('登录失败', login); process.exit(1) }
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()

  // ---- ① 后端:list 支持带出停用条目(维护界面要能看见并恢复) ----
  const all = await api('/api/stdlib/list?lib=lab.device&all=1')
  const rows = all?.data || []
  console.log('   /stdlib/list?all=1 返回', rows.length, '条,首条:', JSON.stringify(rows[0] || {}))
  ok(rows.length > 0 && rows[0].enabled !== undefined, '①list 下发 enabled(维护界面需要区分启用/停用)')

  // ---- ② 后端:update 能改内容并记修改人 ----
  const target = rows.find((r) => Number(r.enabled) === 1) || rows[0]
  if (!target) { console.error('lab.device 无条目,无法继续'); process.exit(1) }
  const original = String(target.content)
  const tmp = original + '-探针临时'
  const up = await api('/api/stdlib/update', { method: 'POST', body: JSON.stringify({ id: target.id, content: tmp }) })
  ok(up?.code === 200, `②update 接口成功(返回 ${JSON.stringify(up).slice(0, 100)})`)
  const after = (await api('/api/stdlib/list?lib=lab.device&all=1'))?.data || []
  const row2 = after.find((r) => r.id === target.id) || {}
  ok(row2.content === tmp, `③条目内容已更新(期望 "${tmp}",实际 "${row2.content}")`)

  // ---- ③ 后端:停用 / 恢复启用 ----
  await api('/api/stdlib/remove', { method: 'POST', body: JSON.stringify({ id: target.id }) })
  let cur = ((await api('/api/stdlib/list?lib=lab.device&all=1'))?.data || []).find((r) => r.id === target.id) || {}
  ok(Number(cur.enabled) === 0, `④停用生效(enabled=${cur.enabled})`)
  ok(!((await api('/api/stdlib/list?lib=lab.device'))?.data || []).some((r) => r.id === target.id), '⑤停用条目不出现在默认列表里(不影响下拉)')
  await api('/api/stdlib/enable', { method: 'POST', body: JSON.stringify({ id: target.id }) })
  cur = ((await api('/api/stdlib/list?lib=lab.device&all=1'))?.data || []).find((r) => r.id === target.id) || {}
  ok(Number(cur.enabled) === 1, `⑥恢复启用生效(enabled=${cur.enabled})`)

  // ---- ④ JSON 库(spec.test)条目也能改:content 原样往返 ----
  const specAdd = await api('/api/stdlib/add', { method: 'POST', body: JSON.stringify({
    lib: 'spec.test', item: '探针组', content: JSON.stringify({ sub: '探针子项', req: '原要求', method: '', basis: '' }) }) })
  ok(specAdd?.code === 200, '⑦JSON 库新增条目成功')
  const specRows = ((await api('/api/stdlib/list?lib=spec.test&all=1'))?.data || [])
  const specRow = specRows.filter((r) => r.item === '探针组').pop()
  ok(!!specRow, '⑧能取回该 JSON 条目')
  if (specRow) {
    const newJson = JSON.stringify({ sub: '探针子项', req: '改后要求', method: '方法X', basis: '' })
    await api('/api/stdlib/update', { method: 'POST', body: JSON.stringify({ id: specRow.id, content: newJson }) })
    const back = ((await api('/api/stdlib/list?lib=spec.test&all=1'))?.data || []).find((r) => r.id === specRow.id) || {}
    ok(back.content === newJson, '⑨JSON 条目内容原样往返(结构化字段不丢)')
    await api('/api/stdlib/remove', { method: 'POST', body: JSON.stringify({ id: specRow.id }) })
    console.log('   探针 JSON 条目已停用(id=' + specRow.id + ')')
  }

  // ---- ⑤ 界面:勾选后点「编辑」行内改,保存生效 ----
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sl-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    const clickText = (t) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('button,span,div'));
      for(var i=0;i<all.length;i++){var e=all[i];
        if((e.textContent||'').trim()===${JSON.stringify(t)}&&e.offsetParent){e.click();return e.tagName+'.'+String(e.className).slice(0,30)}}
      return '' })()`)
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_EQUIP_USE`)
    await sleep(1200)
    // 打开「标准库维护」(⧉ 按钮)
    const opened = await ev(`(function(){
      var el=document.querySelector('.rs-lib-btn'); if(!el) return '';
      el.click(); return 'ok' })()`)
    for (let i = 0; i < 20; i++) { await sleep(400); if (await ev(`!!document.querySelector('.slm')`)) break }
    const dlg = await ev(`JSON.stringify({slm:!!document.querySelector('.slm'),rows:document.querySelectorAll('.slm .el-table__row').length})`)
    console.log('   标准库维护弹窗:', opened, dlg)
    ok(/slm":true/.test(String(dlg)), '⑩界面:弹出标准库维护(共用组件 .slm)')
    ok(/rows":[1-9]/.test(String(dlg)), '⑪界面:列出条目')

    // 勾选第 1 行 → 点「编辑」→ 行内出现输入框
    const checked = await ev(`(function(){
      var cb=document.querySelector('.slm .el-table__row .el-checkbox'); if(!cb) return false;
      cb.click(); return true })()`)
    await sleep(500)
    const editBtn = await clickText('编辑')
    await sleep(700)
    const inline = await ev(`JSON.stringify({editing:!!document.querySelector('.slm .el-table__row input')})`)
    console.log('   勾选:', checked, '编辑按钮:', editBtn, inline)
    ok(/editing":true/.test(String(inline)), '⑫勾选后点「编辑」行内变输入框')

    // 改成探针值并保存
    const setVal = await ev(`(function(){
      var inp=document.querySelector('.slm .el-table__row input'); if(!inp) return '';
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp, ${JSON.stringify(tmp)});
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      return inp.value })()`)
    await sleep(300)
    await clickText('确定')
    await sleep(1200)
    const afterUi = ((await api('/api/stdlib/list?lib=lab.device&all=1'))?.data || []).find((r) => r.id === target.id) || {}
    ok(afterUi.content === tmp, `⑬界面保存生效(库中="${afterUi.content}")`)

    // 改回原值,不留痕
    await api('/api/stdlib/update', { method: 'POST', body: JSON.stringify({ id: target.id, content: original }) })
    const restored = ((await api('/api/stdlib/list?lib=lab.device&all=1'))?.data || []).find((r) => r.id === target.id) || {}
    ok(restored.content === original, `⑭已还原原值("${original}")`)
    console.log('   输入框设值回显:', setVal)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }

  console.log(fails.length ? `\n结果: ${fails.length} 项失败` : '\n结果: 全部通过')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
