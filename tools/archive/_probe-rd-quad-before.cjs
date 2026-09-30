'use strict'
/**
 * _probe-rd-quad-before.cjs — 「研发管理四项改动」动手前的现状取证(只读,不改库不改码)
 *
 * 用法:node tools/archive/_probe-rd-quad-before.cjs [http://localhost:5173]
 * 证据:tools/archive/_shots/rdquad-*.png + 控制台输出
 *
 * 查四件事的"改前"真身:
 *   ① 产品信息表(RD_PROD_INFO)纸面到底渲染了哪些格 —— 核对 yj_field 里 required=1 的
 *      「产品名称/产品类别」在不在纸上(不在纸上 = 保存必报"产品名称不能为空")
 *   ② 产品形态下拉:现有选项 + 有没有"标准库维护"入口(现为 data_type=下拉框,应为无)
 *   ③ 规格书(RD_SPEC_DOC)右上角编号格显示什么(文档编号/单据编号/产品编号?)
 *   ④ 规格书第 1 页封面之下那三行(1.适用范围/2.整体规格参数/3.产品主要性能)的实测高度
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:5173'
const PROD_DOC = process.argv[3] || 'DEMO-PI-002'
const SPEC_DOC = process.argv[4] || 'DEMO-SD-002'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9351
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 模块级绑定:main 里赋值,下面的 paperCells/openByDocNo 才能用(闭包跨函数) */
let ev = null

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(lr))
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdquad-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1700', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
      else console.log('  ✗ 截图失败 ' + name + ' ' + JSON.stringify(r).slice(0, 200))
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1700, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    // ═══ ① 产品信息表 ═══
    console.log('\n① 产品信息表 RD_PROD_INFO (' + PROD_DOC + ')')
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(1500)
    await openByDocNo(PROD_DOC)
    await shot('rdquad-prodinfo-readonly.png')
    console.log('  只读态纸面格: ' + await paperCells())
    // 编辑态(点侧栏「新增」看可编辑格与下拉选项)
    const added = await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='新增'){ all[i].click(); return 'OK' } } return 'NO_BTN' })()`)
    console.log('  点「新增」: ' + added)
    await sleep(4000)
    await shot('rdquad-prodinfo-new.png')
    console.log('  编辑态纸面格: ' + await paperCells())
    // 产品形态下拉选项
    const sel = await ev(`(function(){
      var out=[]
      var tds=[].slice.call(document.querySelectorAll('.record-sheet td')).filter(function(t){return t.offsetParent})
      for (var i=0;i<tds.length;i++){
        var lb=tds[i].textContent.trim()
        if (lb==='产品形态' && tds[i+1]) {
          var s=tds[i+1].querySelector('.el-select')
          out.push({ has: !!s, html: tds[i+1].innerHTML.replace(/\\s+/g,' ').slice(0,240) })
        }
      }
      return JSON.stringify(out)
    })()`)
    console.log('  产品形态格: ' + sel)
    await ev(`(function(){ var tds=[].slice.call(document.querySelectorAll('.record-sheet td')).filter(function(t){return t.offsetParent})
      for (var i=0;i<tds.length;i++){ if(tds[i].textContent.trim()==='产品形态' && tds[i+1]){ var s=tds[i+1].querySelector('.el-select__wrapper'); if(s){ s.click(); return 'OK' } } } return 'NO' })()`)
    await sleep(1200)
    await shot('rdquad-prodinfo-form-dropdown.png')
    console.log('  下拉选项: ' + await ev(`(function(){ var ps=[].slice.call(document.querySelectorAll('.el-select-dropdown__item')).filter(function(x){return x.offsetParent})
      return JSON.stringify(ps.map(function(x){return x.textContent.trim()})) })()`))

    // ═══ ③④ 规格书 ═══
    console.log('\n③④ 规格书 RD_SPEC_DOC (' + SPEC_DOC + ')')
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(1500)
    await openByDocNo(SPEC_DOC)
    await shot('rdquad-specdoc-readonly.png')
    console.log('  右上角编号格: ' + await ev(`(function(){
      var el=document.querySelector('.rs-docno-in'); if(!el) return 'NO_DOCNO'
      var b=el.getBoundingClientRect()
      return JSON.stringify({ text: el.textContent.trim(), cls: el.className, x: Math.round(b.left), y: Math.round(b.top) })
    })()`))
    console.log('  封面字段行: ' + await ev(`(function(){
      var out=[]
      var tds=[].slice.call(document.querySelectorAll('.rsp-cover-lb'))
      for (var i=0;i<tds.length;i++){ var lb=tds[i], vl=lb.nextElementSibling
        out.push({ label: lb.textContent.trim(), val: vl? (vl.querySelector('input')? vl.querySelector('input').value : vl.textContent.trim()) : '' }) }
      return JSON.stringify(out)
    })()`))
    console.log('  封面下三行(docrow): ' + await ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('.rsp-docrow')).filter(function(r){return r.getBoundingClientRect().height>0})
      return JSON.stringify(rows.map(function(r){ var b=r.getBoundingClientRect()
        return { label:(r.querySelector('.rsp-doclabel')||{}).textContent||'', h:Math.round(b.height), top:Math.round(b.top) } }))
    })()`))
    console.log('  版面块: ' + await ev(`(function(){
      var rs=document.querySelector('.record-sheet'); if(!rs) return 'NO_SHEET'
      var cv=rs.querySelector('.rsp-cover'); var tb=null
      var rows=[].slice.call(rs.querySelectorAll('.rsp-docrow')); if(rows.length){ tb=rows[0].closest('table') }
      return JSON.stringify({ sheetH: Math.round(rs.getBoundingClientRect().height),
        coverH: cv? Math.round(cv.getBoundingClientRect().height):0,
        tailH: tb? Math.round(tb.getBoundingClientRect().height):0 })
    })()`))
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }

  /** 纸面渲染出的所有「标签:值键」格 + 是否标准库入口 */
  async function paperCells() {
    return await ev(`(function(){
      var out=[]
      var rs=document.querySelector('.record-sheet'); if(!rs) return 'NO_SHEET'
      var lbs=[].slice.call(rs.querySelectorAll('td.rs-label')).filter(function(t){return t.offsetParent})
      for (var i=0;i<lbs.length;i++){ var lb=lbs[i].textContent.trim(); var td=lbs[i].nextElementSibling
        out.push(lb + (td? (td.querySelector('.rsp-lib-pick, .rs-lib-btn')?'[标准库]':'') + (td.querySelector('input[type=text]:not([readonly])')||td.querySelector('textarea.el-textarea__inner[readonly]')===null&&td.querySelector('textarea')?'[可编辑]':''):''))
      }
      return JSON.stringify(out)
    })()`)
  }

  /** 用「查询单据」按单号打开 */
  async function openByDocNo(doc) {
    await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='查询单据'){ all[i].click(); return 'OK' } } return 'NO_BTN' })()`)
    await sleep(1300)
    const set = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 'NO_DIALOG'; var inp=d.querySelector('input'); if(!inp) return 'NO_INPUT'
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(doc)})
      inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    if (set !== 'SET') { console.log('  ⚠ 查询框注入失败: ' + set); return }
    await sleep(400)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 0; var bs=[].slice.call(d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 1 } } return 0 })()`)
    await sleep(3500)
  }
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
