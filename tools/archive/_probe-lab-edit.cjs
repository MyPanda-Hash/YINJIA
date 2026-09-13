// _probe-lab-edit.cjs — 实验室使用记录表 4 面板行编辑现状探查(诊断,不断言):
//   打开各面板 → 新建草稿 → 检查明细行单元格是否 input、可否加行、加行后可否输入
// 用法: node tools/_probe-lab-edit.cjs [BASE]  默认 http://localhost:8090
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9397
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const listRows = async (panel) => {
    const r = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 300 }) })
    const d = r?.data || {}
    return d.rows || d.list || d.records || []
  }

  const profile = fs.mkdtempSync(require('node:path').join(os.tmpdir(), 'yj-le-'))
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
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')

    for (const panel of ['RD_EQUIP_USE', 'RD_INSTR_USE', 'RD_SPIKE_WATER', 'RD_DOM_TEST']) {
      await nav(`${BASE}/#/panelx/list/${panel}`)
      await sleep(900)
      const before = new Set((await listRows(panel)).map((r) => r['单据编号'] || r['编号']))
      await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
        for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
          if(t==='新增'&&all[i].offsetParent){all[i].click();return 1}}
        return 0 })()`)
      let no = ''
      for (let i = 0; i < 30; i++) { await sleep(600)
        const fresh = (await listRows(panel)).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !before.has(n))
        if (fresh.length) { no = fresh[0]; break } }
      await nav(`${BASE}/#/panelx/list/${panel}`) // 定位新单(新单号排序首位)
      await sleep(1400)
      const cellInputs = await ev(`(function(){
        var t=document.querySelector('table.rs-dt');if(!t)return 'no-table';
        var rows=t.querySelectorAll('tbody tr');var inp=0,span=0,total=0;
        for(var i=0;i<rows.length;i++){var tds=rows[i].querySelectorAll('td');
          for(var j=0;j<tds.length;j++){if(tds[j].className.indexOf('rs-td-op')>=0||tds[j].className.indexOf('rsp-op-pad')>=0)continue;
            if(tds[j].className.indexOf('rs-th')>=0)continue;
            var cls=tds[j].className;
            if(cls.indexOf('rsp-plain-title')>=0||cls.indexOf('rsp-subtitle-row')>=0||cls.indexOf('rs-sectionbar')>=0||cls.indexOf('rs-subhead')>=0||cls.indexOf('rs-grp')>=0||cls.indexOf('rsp-page-title')>=0||cls.indexOf('rsp-footnote')>=0||cls.indexOf('rs-empty')>=0)continue;
            total++; if(tds[j].querySelector('input,textarea'))inp++; else span++}}
        return JSON.stringify({rows:rows.length,total:total,inputs:inp,spans:span})})()`)
      const addBtn = await ev(`!!document.querySelector('.rs-add')`)
      const status = await ev(`(document.querySelector('.doc-status')||{}).textContent || ''`)
      // 加一行 → 检查数据行单元格是否 input → 输入测试值 → 保存 → 重载检查
      let roundTrip = ''
      if (addBtn) {
        await ev(`document.querySelector('.rs-add').click(); 'ok'`); await sleep(600)
        const afterAdd = await ev(`(function(){
          var t=document.querySelector('table.rs-dt');if(!t)return 'no-table';
          var rows=t.querySelectorAll('tbody tr');var inp=0,span=0,total=0;
          for(var i=0;i<rows.length;i++){
            if(rows[i].className.indexOf('rs-grp')>=0)continue;
            var tds=rows[i].querySelectorAll('td');
            for(var j=0;j<tds.length;j++){var cls=tds[j].className;
              if(cls.indexOf('rs-td-op')>=0||cls.indexOf('rsp-op-pad')>=0||cls.indexOf('rs-th')>=0)continue;
              if(cls.indexOf('rsp-plain-title')>=0||cls.indexOf('rsp-subtitle-row')>=0||cls.indexOf('rs-sectionbar')>=0||cls.indexOf('rs-subhead')>=0||cls.indexOf('rsp-page-title')>=0||cls.indexOf('rsp-footnote')>=0||cls.indexOf('rs-empty')>=0)continue;
              total++; if(tds[j].querySelector('input,textarea'))inp++; else span++}}
          return JSON.stringify({total:total,inputs:inp,spans:span})})()`)
        // 往第一格 input 写值(原生 input 事件触发 v-model)
        const typed = await ev(`(function(){
          var t=document.querySelector('table.rs-dt');if(!t)return 'no-table';
          var inp=t.querySelector('tbody input,tbody textarea');if(!inp)return 'no-input';
          var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
          setter.call(inp,'探针测试值');
          inp.dispatchEvent(new Event('input',{bubbles:true}));
          return 'typed:'+inp.value})()`)
        // 点侧栏「保存」
        const saved = await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button'));
          for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
            if(t==='保存'&&all[i].offsetParent){all[i].click();return 1}}
          return 0 })()`)
        await sleep(2500)
        const stAfter = await ev(`(document.querySelector('.doc-status')||{}).textContent || ''`)
        roundTrip = `加行后=${afterAdd} 写值=${typed} 点保存=${saved} 保存后状态=${stAfter.trim()}`
      }
      console.log(`${panel} 单据=${no} 状态=${status.trim()} 加行按钮=${addBtn} ${roundTrip}`)
      // 现有单据(非新单)的表现:翻回第一张已归档单
      // 清理:删测试草稿
      if (no) await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: panel, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
    }
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
