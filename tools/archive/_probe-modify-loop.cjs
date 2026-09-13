// _probe-modify-loop.cjs — 归档后申请修改闭环放开到全部文书归档面板 验收探针:
//   ① 实验室面板(RD_EQUIP_USE)完整闭环:新建草稿→保存归档→申请修改→修改审批通过→修改中可编辑行
//      →改行字段值→保存→提交审批→审批通过→已归档,值已更新且修改记录有留痕
//   ② 数据记录表(RD_ALKALINE)归档单出现「申请修改」按钮(原 7 面板外的新放开面)
//   ③ 产品文件(RD_PROD_INFO)回归:申请修改/修改记录按钮仍在(不因改造消失)
//   ④ 非文书归档面板(RKD 入库单)不出现修改组(开关不误伤普通单据)
//   ⑤ 修改记录弹窗可打开(实验室面板,滚动留痕口径)
// 用法: node tools/_probe-modify-loop.cjs [BASE]  默认 http://localhost:8090
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9396
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
  const listRows = async (panel) => {
    const r = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 300 }) })
    const d = r?.data || {}
    return d.rows || d.list || d.records || []
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ml-'))
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

    const clickSide = (label) => ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)}&&all[i].offsetParent){all[i].click();return 1}}
      return 0 })()`)
    const status = () => ev(`(document.querySelector('.doc-status')||{}).textContent || ''`)
    const modBtnVisible = () => ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){if((all[i].textContent||'').trim()==='申请修改'&&all[i].offsetParent)return 1}
      return 0 })()`)
    const modlogBtnVisible = () => ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){if((all[i].textContent||'').trim()==='修改记录'&&all[i].offsetParent)return 1}
      return 0 })()`)

    // ───────── ① 实验室面板完整闭环(RD_EQUIP_USE) ─────────
    await nav(`${BASE}/#/panelx/list/RD_EQUIP_USE`)
    await sleep(900)
    const before = new Set((await listRows('RD_EQUIP_USE')).map((r) => r['单据编号'] || r['编号']))
    await clickSide('新增')
    let no = ''
    for (let i = 0; i < 30; i++) { await sleep(600)
      const fresh = (await listRows('RD_EQUIP_USE')).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !before.has(n))
      if (fresh.length) { no = fresh[0]; break } }
    ok(!!no, `①-1 新建草稿 ${no}`)
    await nav(`${BASE}/#/panelx/list/RD_EQUIP_USE`); await sleep(1500)
    // 副标题「设备名称」必填(el-select filterable+allow-create):输入后回车提交
    await ev(`(function(){var i=document.querySelector('.rsp-sub-ctl input');if(!i)return 0;i.focus();
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(i,'加标测试系统1#');i.dispatchEvent(new Event('input',{bubbles:true}));
      i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true}));return 1})()`)
    await sleep(400)
    // 加一行 + 填测试项目(必填头:单据日期默认今天)
    await ev(`document.querySelector('.rs-add').click();'ok'`); await sleep(500)
    await ev(`(function(){var t=document.querySelector('table.rs-dt');if(!t)return 0;
      var inp=t.querySelectorAll('tbody input,tbody textarea');if(!inp.length)return 0;
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp[1],'闭环探针行');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
    await clickSide('保存'); await sleep(2500)
    let st = await status()
    if (st.trim() !== '已归档') { // 普通用户路径不同;admin 保存即归档——若失败打印当前状态
      console.log('   保存后状态=' + st.trim())
    }
    ok(st.trim() === '已归档', `①-2 保存即归档(实际 "${st.trim()}")`)
    ok(await modBtnVisible() === 1, '①-3 实验室面板出现「申请修改」按钮(本次放开点)')
    await clickSide('申请修改'); await sleep(1800)
    st = await status()
    ok(st.trim() === '修改申请中', `①-4 申请修改 → 修改申请中(实际 "${st.trim()}")`)
    // 打开修改组的 ▼ 菜单(定位:申请修改按钮所在的 as-side-btn-row 内的 caret,勿误点删除组)
    const openModMenu = () => ev(`(function(){var btns=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<btns.length;i++){if((btns[i].textContent||'').trim()==='申请修改'){
        var row=btns[i].closest('.as-side-btn-row');var c=row&&row.querySelector('.as-side-caret');
        if(c&&c.offsetParent){c.click();return 1}}}return 0})()`)
    await openModMenu()
    await sleep(500)
    await clickSide('修改审批通过'); await sleep(1800)
    st = await status()
    ok(st.trim() === '修改中', `①-5 修改审批通过 → 修改中(实际 "${st.trim()}")`)
    // 修改中行可编辑:改测试项目值
    const cellEditable = await ev(`(function(){var t=document.querySelector('table.rs-dt');if(!t)return 0;
      var inp=t.querySelectorAll('tbody input,tbody textarea');if(!inp.length)return 0;
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp[1],'闭环修改后的值');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return inp.length})()`)
    ok(cellEditable > 0, `①-6 修改中明细行可编辑(${cellEditable} 个输入框)`)
    await clickSide('保存'); await sleep(2200)
    await clickSide('提交审批'); await sleep(700)
    // 提交审批/审批通过会弹 ElMessageBox 确认框 → 点主按钮确认
    const confirmBox = () => ev(`(function(){var b=[].slice.call(document.querySelectorAll('.el-message-box__btns .el-button--primary'));
      if(b.length){b[b.length-1].click();return 1}return 0})()`)
    await confirmBox()
    await sleep(1800)
    st = await status()
    ok(st.trim() === '审批中', `①-7 提交审批 → 审批中(实际 "${st.trim()}")`)
    await openModMenu()
    await sleep(500)
    await clickSide('审批通过'); await sleep(700)
    await confirmBox()
    await sleep(2200)
    st = await status()
    ok(st.trim() === '已归档', `①-8 审批通过 → 再归档(实际 "${st.trim()}")`)
    const rowNow = (await listRows('RD_EQUIP_USE')).find((r) => (r['单据编号'] || r['编号']) === no)
    const items = (rowNow && (rowNow.detail?.items)) || []
    // 注:①-6 的 inp[1] 实为该行「使用日期」格(表内首个 input 是副标题设备名称下拉),按值断言
    ok(items.some((r) => Object.values(r).includes('闭环修改后的值')), `①-9 修改值已落库(首行=${JSON.stringify(items[0] || {}).slice(0, 140)})`)
    // 修改记录弹窗
    await clickSide('修改记录'); await sleep(1200)
    const logOpen = await ev(`!!document.querySelector('.el-dialog')`)
    ok(logOpen === true, '⑤ 修改记录弹窗可打开(实验室面板)')
    await ev(`(function(){var d=[].slice.call(document.querySelectorAll('.el-dialog__headerbtn'));if(d.length){d[d.length-1].click()}return 1})()`)
    await sleep(400)

    // ───────── ② 数据记录表面板:归档单出现申请修改(不动数据,只验按钮) ─────────
    await nav(`${BASE}/#/panelx/list/RD_ALKALINE`); await sleep(1600)
    const alkBtn = await modBtnVisible()
    console.log(`   RD_ALKALINE 当前单状态=${(await status()).trim()} 申请修改按钮=${alkBtn}`)
    ok(alkBtn === 1, '② 数据记录表(碱性)出现「申请修改」按钮')

    // ───────── ③ 产品文件回归 ─────────
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`); await sleep(1600)
    ok(await modBtnVisible() === 1 && await modlogBtnVisible() === 1, '③ 产品信息表申请修改/修改记录按钮仍在(回归)')

    // ───────── ④ 普通单据不受影响(RKD 入库单无修改组) ─────────
    await nav(`${BASE}/#/panelx/list/RKD`); await sleep(2200)
    ok(await modBtnVisible() === 0, '④ 普通单据(RKD)不出现「申请修改」(开关不误伤)')

    // ───────── 清理:实验室测试单走删除申请→管理员直接作废 ─────────
    const del = await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_EQUIP_USE', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
    ok(del.code === 200, '⑦ 清理:测试单已删除留痕(归档单删除走管理员作废)')
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
