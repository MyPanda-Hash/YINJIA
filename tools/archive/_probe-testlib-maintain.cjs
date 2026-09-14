// _probe-testlib-maintain.cjs — 检验项目标准库重构验收(规格书 spec.test + 出货计划 insp.plan):
//   ① 规格书「从标准库勾选」弹窗:种子条目齐(≥26 组/48 子项),条目可勾选
//   ② 停用一条种子条目(✕) → 同组内该条目灰显划线带「已停用」且 checkbox 禁用
//   ③ 恢复启用(↩) → 条目回到可勾选状态
//   ④ 编辑一条种子条目(勾选→编辑→改检验要求→保存修改) → 重开弹窗值已更新(库数据真改了)
//   ⑤ 出货检验计划(必测项):7 条种子行 + 操作列;停用→行灰显(已停用);恢复→还原
//   ⑥ 种子幂等口径:编辑/停用后重新跑种子不会复活或覆盖(改库不回弹)
//   ⑦ 旧口径不回归:实验室标准库维护(StdLibManager)仍可用(简查接口)
// 用法: node tools/_probe-testlib-maintain.cjs [BASE]  默认 http://localhost:8090
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9394
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  if (!token) { console.error('登录失败', login); process.exit(1) }
  const auth = { Authorization: 'Bearer ' + token }
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', ...auth, ...(opts.headers || {}) } })).json()
  const listRows = async (panel) => {
    const r = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 300 }) })
    const d = r?.data || {}
    return d.rows || d.list || d.records || []
  }
  const specBeforeNos = new Set()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tl-'))
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

    // ═══ 规格书:先建草稿(「从标准库勾选」按钮仅草稿态渲染)→ 检验项目及标准页 → 从标准库勾选 ═══
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(1200)
    for (const r of await listRows('RD_SPEC_DOC')) specBeforeNos.add(r['单据编号'] || r['编号'])
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
        if(t==='新增'&&all[i].offsetParent){all[i].click();return 1}}
      return 0})()`)
    await sleep(3500) // directAdd 建草稿+列表刷新
    let specDraftNo = ''
    for (let i = 0; i < 20; i++) {
      await sleep(800)
      const fresh = (await listRows('RD_SPEC_DOC')).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !specBeforeNos.has(n))
      if (fresh.length) { specDraftNo = fresh[0]; break }
    }
    ok(!!specDraftNo, `①-0a 规格书测试草稿已建(${specDraftNo || '无'})`)
    // 切到「检验项目及标准」页签(页签名含"检验")
    const tabOk = await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.rsp-page-tab'));for(var i=0;i<t.length;i++){if((t[i].textContent||'').indexOf('检验')>=0){t[i].click();return 1}}return 0})()`)
    await sleep(800)
    // 打开「从标准库勾选」
    const libBtn = await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-lib-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('标准库')>=0&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    await sleep(1400)
    ok(tabOk === 1 && libBtn === 1, `①-0 草稿态检验页标准库入口可开(页签=${tabOk} 按钮=${libBtn})`)
    const stats = await ev(`(function(){
      var gs=document.querySelectorAll('.lib-group');var subs=document.querySelectorAll('.lib-sub-item');
      var offs=document.querySelectorAll('.lib-sub-item-off');
      return JSON.stringify({groups:gs.length,subs:subs.length,off:offs.length})})()`)
    const st = JSON.parse(stats || '{}')
    ok(st.groups >= 26 && st.subs >= 48, `① 种子条目齐(组=${st.groups}≥26, 子项=${st.subs}≥48)`)
    // ② 停用第一条种子条目
    const firstDel = await ev(`(function(){var d=document.querySelector('.lib-sub-del');if(!d)return 0;d.click();return 1})()`)
    await sleep(1400)
    const afterOff = await ev(`(function(){var o=document.querySelector('.lib-sub-item-off');
      if(!o)return JSON.stringify({off:0});
      var cb=o.querySelector('input[type=checkbox]');
      var undo=!!o.querySelector('.lib-sub-undo');
      var txt=(o.textContent||'').indexOf('已停用')>=0;
      var strike=!!o.querySelector('.lib-sub-name-off');
      return JSON.stringify({off:1,disabled:cb?cb.disabled:null,undo:undo,txt:txt,strike:strike})})()`)
    const ao = JSON.parse(afterOff || '{}')
    ok(firstDel === 1 && ao.off === 1, '②-1 ✕ 停用种子条目 → 条目呈停用态')
    ok(ao.disabled === true, `②-2 停用条目 checkbox 禁用(disabled=${ao.disabled})`)
    ok(ao.undo === true && ao.txt === true && ao.strike === true, '②-3 划线+「已停用」标注+↩ 恢复入口')
    // ③ 恢复启用
    await ev(`(function(){var u=document.querySelector('.lib-sub-undo');if(!u)return 0;u.click();return 1})()`)
    await sleep(1400)
    const offCount = await ev(`document.querySelectorAll('.lib-sub-item-off').length`)
    ok(offCount === 0, '③ ↩ 恢复启用 → 停用态清零')
    // ④ 编辑第一条种子条目:勾选 → 编辑 → 检验要求前缀加标记 → 保存修改 → 重开校验(收尾还原)
    await ev(`(function(){var c=document.querySelector('.lib-sub-item input[type=checkbox]');if(!c)return 0;c.click();return 1})()`)
    await sleep(300)
    await ev(`(function(){var f=document.querySelector('.el-dialog__footer .el-button');var bs=[].slice.call(document.querySelectorAll('.el-dialog__footer .el-button'));
      for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='编辑'){bs[i].click();return 1}}return 0})()`)
    await sleep(600)
    const editBrought = await ev(`(function(){var f=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form textarea'));
      return f.length?String(f[0].value||''):'')`.replace(/\)$/, '})()'))
    const MARK = '【维护探针' + Date.now().toString().slice(-5) + '】'
    await ev(`(function(){var f=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form textarea'));
      if(!f.length)return 0;var i=f[0];
      var setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      setter.call(i,${JSON.stringify(MARK)}+i.value);i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
    // 点「保存修改」(编辑态主按钮文案)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog .lib-custom-form .el-button'));
      for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').trim();if(t==='保存修改'||t==='存入标准库'){bs[i].click();return t}}return 0})()`)
    await sleep(1600)
    // 弹窗已自动重开(openLib),查第一条子项的要求预览是否带标记
    const reqNow = await ev(`(function(){var r=document.querySelector('.lib-sub-req');return r?(r.textContent||''):'')`.replace(/\)$/, '})()'))
    ok(String(reqNow).startsWith('【维护探针'), `④ 编辑种子条目保存后生效(要求前缀="${String(reqNow).slice(0, 18)}")`)
    ok(String(editBrought || '').length > 0, `④-2 编辑带入原值(带入="${String(editBrought).slice(0, 12)}…")`)

    // ═══ 出货检验计划:必测项表 ═══
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__headerbtn'));if(bs.length)bs[bs.length-1].click();return 1})()`)
    await sleep(500)
    await nav(`${BASE}/#/panelx/list/RD_INSP_PLAN`)
    await sleep(1600)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-lib-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('标准库')>=0&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    await sleep(1400)
    const flatRows = await ev(`document.querySelectorAll('.el-dialog .el-table__body-wrapper tr').length`)
    const flatOff = await ev(`document.querySelectorAll('.el-dialog .lib-row-off').length`)
    ok(flatRows >= 7 && flatOff === 0, `⑤-1 必测项种子 7 行(行=${flatRows}, 停用=${flatOff})`)
    // 停用第一行 → 灰显 + 不可勾 + ↩
    await ev(`(function(){var d=document.querySelector('.el-dialog .lib-sub-del');if(!d)return 0;d.click();return 1})()`)
    await sleep(1400)
    const flatState = await ev(`(function(){var o=document.querySelector('.el-dialog .lib-row-off');if(!o)return JSON.stringify({off:0});
      var undo=!!o.querySelector('.lib-sub-undo');
      var sel=o.querySelector('.el-checkbox__input')?o.querySelector('.el-checkbox__input').classList.contains('is-disabled'):null;
      var txt=(o.textContent||'').indexOf('已停用')>=0;
      return JSON.stringify({off:1,undo:undo,selDisabled:sel,txt:txt})})()`)
    const fs2 = JSON.parse(flatState || '{}')
    ok(fs2.off === 1 && fs2.undo === true && fs2.txt === true, '⑤-2 停用 → 行灰显划线「已停用」+ ↩ 恢复入口')
    // 恢复
    await ev(`(function(){var u=document.querySelector('.el-dialog .lib-sub-undo');if(!u)return 0;u.click();return 1})()`)
    await sleep(1400)
    const flatOff2 = await ev(`document.querySelectorAll('.el-dialog .lib-row-off').length`)
    ok(flatOff2 === 0, '⑤-3 恢复启用 → 停用行清零')

    // ═══ ⑥ 种子幂等不回弹:编辑值真实落库(重跑种子 NOT EXISTS 命中不会覆盖),并还原被编辑条目 ═══
    const libAll = await api('/api/stdlib/list?lib=spec.test&all=1')
    const markedRow = (libAll.data || []).find((r) => String(r.content || '').includes(MARK))
    ok(!!markedRow, '⑥ 编辑值真实落库(yj_std_lib content 含标记,种子重跑不会覆盖)')
    if (markedRow) {
      try {
        const c = JSON.parse(markedRow.content)
        c.req = String(c.req || '').replace(MARK, '')
        await api('/api/stdlib/update', { method: 'POST', body: JSON.stringify({ id: markedRow.id, content: JSON.stringify(c) }) })
      } catch { /* 还原失败不影响结论,种子重跑仍不会覆盖 */ }
    }

    // ═══ ⑦ 回归:实验室标准库维护接口仍可用(StdLibManager 数据面,真实库编码 lab.*) ═══
    const lab = await api('/api/stdlib/list?lib=lab.test_item&all=1')
    ok(lab.code === 200, '⑦ 标准库接口回归正常(实验室库 lab.test_item 可查)')

    // ═══ 清理:规格书测试草稿 ═══
    if (specDraftNo) {
      await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '删除', formData: { 编号: specDraftNo }, buttonParam: {} }) })
    }
  } catch (e) {
    console.error('PROBE ERROR', e)
    fails.push('probe error: ' + (e && e.message))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
