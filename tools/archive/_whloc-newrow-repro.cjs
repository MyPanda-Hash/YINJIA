/* 诊断(2026-09-28):用户报 WHLOC 库位页点「新增数据」后,库位编码/库位地址无法填写,只能选仓库。
   本探针按用户流程逐步复现:进 WHLOC → 点「新增数据」小按钮 → 点新行 库位编码/库位地址 单元格 → 真实键盘输入。
   用法: node tools/archive/_whloc-newrow-repro.cjs [vite|jar]   (vite=http://localhost:5173, jar=http://127.0.0.1:8090) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9371
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] === 'jar' ? 'http://127.0.0.1:8090' : 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HELPERS = `
window.__mainTable = function(){ return [].slice.call(document.querySelectorAll('.el-table')).filter(function(t){return !t.closest('.el-dialog')})[0] };
window.__mainDataRows = function(){ var t=window.__mainTable(); if(!t) return []; return [].slice.call(t.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')}) };
window.__cellOf = function(label,rowIdxFromEnd){ var t=window.__mainTable(); if(!t) return null; var ths=[].slice.call(t.querySelectorAll('.el-table__header th')); var idx=-1; ths.forEach(function(th,i){ if((th.textContent||'').indexOf(label)>=0 && idx<0) idx=i }); if(idx<0) return null; var rs=window.__mainDataRows(); var tr=rs.length?rs[(rowIdxFromEnd!==undefined? rs.length-1-rowIdxFromEnd : rs.length-1)]:null; if(!tr) return null; var tds=tr.querySelectorAll('td'); return tds[idx]||null };
window.__rect = function(el){ if(!el) return null; var r=el.getBoundingClientRect(); return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}) };
window.__cellState = function(label,fromEnd){ var td=window.__cellOf(label,fromEnd); if(!td) return 'NO_TD'; var inp=td.querySelector('input'); var ae=document.activeElement; return JSON.stringify({editor:!!inp,val:inp?String(inp.value).slice(0,20):(td.textContent||'').trim().slice(0,20),focusIn:!!td.contains(ae),lazy:!!td.querySelector('.cell-lazy'),refEd:!!td.querySelector('.inline-ref-editor')}) };
window.__toasts = function(){ return [].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()}).join(' | ') };
`

async function main() {
  console.log(`== WHLOC 新增数据行可编辑性探针 (BASE=${BASE}) ==`)
  const loginRes = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-newrow-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const errors = []
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 250))
      if (m.method === 'Runtime.exceptionThrown') errors.push('EXC:' + ((m.params.exceptionDetails || {}).text || ''))
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return 'EVAL_ERR:' + JSON.stringify(r.result.exceptionDetails).slice(0, 200)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(700); return } }
    }
    const realClick = async (x, y) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await sleep(60)
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
    }
    const clickCenter = async (jsonRect) => {
      const r = JSON.parse(jsonRect)
      await realClick(Math.round(r.x), Math.round(r.y))
    }
    const pressKey = async (ch) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, code: 'Key' + ch.toUpperCase(), unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: 'Key' + ch.toUpperCase() })
    }

    await send('Page.enable'); await send('Runtime.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/WHLOC`)
    for (let i = 0; i < 80; i++) { await sleep(500); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) break }
    await sleep(1500)
    await evalOnce(HELPERS)

    const rows0 = await evalOnce('(function(){return window.__mainDataRows().length})()')
    console.log('初始数据行:', rows0)

    // ① 点明细区「新增数据」蓝色小按钮
    const addBtn = await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});return window.__rect(el)})()`)
    console.log('① 新增数据按钮 rect:', addBtn)
    if (addBtn && String(addBtn).startsWith('{')) { await clickCenter(addBtn); await sleep(900) }
    const rows1 = await evalOnce('(function(){return window.__mainDataRows().length})()')
    console.log('   点击后数据行:', rows1, ' toast:', await evalOnce('window.__toasts()'))
    if (Number(rows1) <= Number(rows0)) {
      // 真点击失灵时:先 dump 组件状态,再换 evaluate 派发点击(运维速查第22条)
      console.log('   组件状态:', await evalOnce(`(function(){
        var el = document.querySelector('.el-table'); var inst = el && el.__vueParentComponent; var hops = 0
        while (inst && hops < 25) { var ss = inst.setupState || {}
          if ('cfgCache' in ss || 'singleDocMode' in ss) {
            var cur = ss.cur && ss.cur.value !== undefined ? ss.cur.value : ss.cur
            var tab = ss.detailRows ? Object.keys((cur && cur.detail) || {}) : []
            var rowCnt = {}; tab.forEach(function(k){ rowCnt[k] = ((cur.detail||{})[k]||[]).filter(function(r){return !r._placeholder}).length })
            var de = ss.draftEditable, sdm = ss.singleDocMode, ac = ss.activeCell
            return JSON.stringify({ comp: inst.type.__name || '?', draftEditable: de && de.value !== undefined ? de.value : String(de),
              singleDoc: sdm && sdm.value !== undefined ? sdm.value : String(sdm), docStatus: (cur||{})['单据状态'], rows: rowCnt,
              archPage: ss.archPage && ss.archPage.value, activeCell: ac && ac.value ? { prop: ac.value.prop, hasRow: !!ac.value.row } : null })
          } inst = inst.parent; hops++ }
        return 'NOT_FOUND'
      })()`))
      await evalOnce(`(function(){var els=[].slice.call(document.querySelectorAll('button'));var el=els.find(function(x){return (x.textContent||'').trim()==='新增数据'});if(el){el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'dispatched'}return 'no-btn'})()`)
      await sleep(800)
      console.log('   派发点击后数据行:', await evalOnce('(function(){return window.__mainDataRows().length})()'), ' toast:', await evalOnce('window.__toasts()'))
    }
    const rows1b = Number(await evalOnce('(function(){return window.__mainDataRows().length})()'))
    if (rows1b <= Number(rows0)) { console.log('!! 新增数据未生效,终止'); ws.close(); return }

    // 新行 = 最后一个数据行(rowIdxFromEnd=0);本环境 CDP 坐标真点击不落(运维速查第22条),统一派发点击
    for (const col of ['仓库', '库位编码', '库位地址']) {
      const st0 = await evalOnce(`window.__cellState("${col}", 0)`)
      console.log(`\n② ${col} 新行初始:`, st0)
      const clicked = await evalOnce(`(function(){var td=window.__cellOf("${col}",0);if(!td)return 'no-td';var el=td.querySelector('.cell-lazy')||td.querySelector('.inline-ref-editor')||td;el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'clicked:'+(el.className||el.tagName)})()`)
      await sleep(600)
      console.log(`   派发点击(${clicked}) 后:`, await evalOnce(`window.__cellState("${col}", 0)`))
      if (col !== '仓库') {
        for (const ch of ['A', '1']) {
          await pressKey(ch); await sleep(400)
          console.log(`     按'${ch}' →`, await evalOnce(`window.__cellState("${col}", 0)`))
        }
        // 行对象落值核对(保存读的是行对象,不是 input 显示)
        console.log(`     行对象值:`, await evalOnce(`(function(){var el=document.querySelector('.el-table');var inst=el&&el.__vueParentComponent;var hops=0;while(inst&&hops<25){var ss=inst.setupState||{};if('activeCellEcho' in ss){var cur=ss.cur.value!==undefined?ss.cur.value:ss.cur;var rows=((cur.detail||{}).locations||[]);var r=rows[rows.length-1];return JSON.stringify(r?{库位编码:r['库位编码'],库位地址:r['库位地址']}:null)}inst=inst.parent;hops++}return 'NOT_FOUND'})()`))
      }
    }
    console.log('\nconsole 错误:', errors.length ? errors.slice(0, 6) : '无')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message, '| cause:', e.cause ? (e.cause.code || e.cause.message) : 'n/a'); process.exit(1) })
