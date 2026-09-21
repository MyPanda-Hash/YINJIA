'use strict'
/**
 * _probe-spec-docrow.cjs — 规格书「1.适用范围 / 2.整体规格参数 / 3.产品主要性能」三行的行高与行距实测
 *
 * 用户口径(2026-09-21):「产品规格书归档之后 1.适用范围 / 2.整体规格参数 / 3.产品主要性能
 *   这三个字段之间有一些间隔太远。」
 *
 * 原因怀疑:只读(归档)态的值是 <span class="rsp-docval rsp-pre">,而 `.rsp-pre { min-height: 60px }`
 *   —— 那一行本来是一句话(编辑态 .el-textarea__inner 只有 22px 高),只读态却被撑到 60px+;
 *   设计图里整块章节(1/2/3 三行)只有 87px 高。
 *
 * 本探针把"屏幕上的真实像素"量出来(design 87px 作对照),before/after 各跑一遍留档。
 * 用法:node _probe-spec-docrow.cjs [http://localhost:8090] [单据编号]
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:8090'
const DOC = process.argv[3] || 'T-PF-833095'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9346
const SHOTS = path.join(__dirname, '_shots')
const TAG = process.argv[4] || 'before'
const DESIGN_BLOCK_H = 87   // 《规格书细分.xlsx》「页面-产品信息」章节块 509×87(×k 缩放后由渲染器按 A4 还原)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-docrow-'))
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
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1700, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(2500)
    // 按单号打开:查询单据 → 输入编号 → 查询
    await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='查询单据'){ all[i].click(); return 'OK' } } return 'NO_BTN' })()`)
    await sleep(1300)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 'NO_DIALOG'; var inp=d.querySelector('input'); if(!inp) return 'NO_INPUT'
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(DOC)})
      inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    await sleep(400)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 0; var bs=[].slice.call(d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 1 } } return 0 })()`)
    await sleep(3500)

    const layout = await ev(`(function(){
      var rs=document.querySelector('.record-sheet'); if(!rs) return 'NO_SHEET'
      var page=rs.querySelector('.rsp-page') || rs
      var kids=[].slice.call(page.children).map(function(el){ var b=el.getBoundingClientRect()
        return { cls:(el.className||'').toString().slice(0,42), h:Math.round(b.height), top:Math.round(b.top) } }).filter(function(x){ return x.h>0 })
      var cover=rs.querySelector('.rsp-cover'); var cb=cover? cover.getBoundingClientRect():null
      var tailTb=null, rows=[].slice.call(rs.querySelectorAll('.rsp-docrow'))
      if(rows.length){ var t=rows[0].closest('table'); if(t) tailTb=t }
      var tb=tailTb? tailTb.getBoundingClientRect():null
      return JSON.stringify({ sheetH: Math.round(rs.getBoundingClientRect().height), kids: kids,
        coverH: cb? Math.round(cb.height):0, tailH: tb? Math.round(tb.height):0, sum: (cb?Math.round(cb.height):0)+(tb?Math.round(tb.height):0) })
    })()`)
    console.log('   版面块: ' + layout)
    const info = await ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('.rsp-docrow')).filter(function(r){ var b=r.getBoundingClientRect(); return b.height>0 })
      var out = rows.map(function(r){
        var b=r.getBoundingClientRect()
        var lb=r.querySelector('.rsp-doclabel'), vl=r.querySelector('.rsp-docval'), inp=r.querySelector('.el-textarea__inner')
        var v=(vl||inp), vb=v? v.getBoundingClientRect() : null
        var cs=v? getComputedStyle(v) : null
        return { label:(lb?lb.textContent:'').trim(), rowTop:Math.round(b.top), rowH:Math.round(b.height),
          valH: vb? Math.round(vb.height):0, minH: cs? cs.minHeight:'-', display: cs? cs.display:'-',
          cls: v? v.className : '-' }
      })
      var gaps=[]; for (var i=1;i<out.length;i++){ gaps.push(out[i].rowTop - (out[i-1].rowTop + out[i-1].rowH)) }
      var blockH = out.length? Math.round((out[out.length-1].rowTop+out[out.length-1].rowH) - out[0].rowTop) : 0
      // 整页高度:A4 高 = 794 × 297/210 = 1123px(封面画布 + 尾部章节块 + 页面自身边距都要装进去)
      var sheet=document.querySelector('.record-sheet')
      var sheetH = sheet ? Math.round(sheet.getBoundingClientRect().height) : 0
      return JSON.stringify({ count: out.length, rows: out, gaps: gaps, blockH: blockH, sheetH: sheetH, a4H: 1123,
        readonly: !document.querySelector('.record-sheet .rsp-doccell .el-textarea__inner') })
    })()`)
    const data = JSON.parse(info)
    console.log(`── 规格书 ${DOC}(${TAG})——`)
    console.log(`   只读态: ${data.readonly} | 章节块总高: ${data.blockH}px(设计 ${DESIGN_BLOCK_H}px)`)
    for (const r of data.rows) console.log(`   ${r.label.padEnd(12)} 行高=${String(r.rowH).padStart(3)}px  值高=${String(r.valH).padStart(3)}px  min-height=${r.minH}  ${r.cls}`)
    console.log(`   行间空隙: ${JSON.stringify(data.gaps)}`)
    // 打印高度只算**会打印的两块**:封面画布(.rs-head-t)+ 章节块表格(.rs-t);
    // 页签条(.rsp-pages)是屏幕 chrome,不进纸面,算进去会假报"超标"。
    const kids = (JSON.parse(layout).kids) || []
    const printed = kids.reduce((s, k) => {
      const cls = String(k.cls || '')
      return (cls.includes('rs-head-t') || cls.trim() === 'rs-t') ? s + k.h : s
    }, 0)
    const fit = printed <= data.a4H ? 'OK(一页装得进)' : '超标(会多出一页空白)'
    console.log(`   打印高度(封面 ${kids.filter((k) => String(k.cls).includes('rs-head-t')).map((k) => k.h)} + 章节 ${kids.filter((k) => String(k.cls).trim() === 'rs-t').map((k) => k.h)}) = ${printed}px / A4 ${data.a4H}px → ${fit}`)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (shot.result?.data) {
      const f = path.join(SHOTS, `spec-docrow-${TAG}.png`)
      fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'))
      console.log(`   截图: ${f}`)
    }
    // 机器可读结果,便于 before/after 对比
    fs.writeFileSync(path.join(SHOTS, `spec-docrow-${TAG}.json`), JSON.stringify(data, null, 2), 'utf8')
  } finally {
    try { if (ws) ws.close() } catch { }
    try { edge.kill() } catch { }
  }
}

main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
