/**
 * _probe-matpick-precise.cjs —— 「从物料清单引用」落行 bug 的精确取证(2026-10-13)
 *
 * 为什么重写:上一版 _probe-spec-materialpick.cjs 的对照实验用
 *   document.querySelector('.rs-op-add') 取的是**文档里第一个**加号,未必是目标表那一张,
 *   于是"点 ＋ 能出行(13→14)"这个结论不可靠 —— 它可能数的是别的页/别的表。
 *   本版把范围严格限定到**目标表自己的 .rsp-dt-wrap 容器**,每步都重新查一次 DOM。
 *
 * 要回答的两个问题:
 *   ① 目标表(含「物料编码」表头的那张)里,点它**自己的** ＋(addRow) 能不能出行?
 *      —— 能 ⇒ 该表渲染 items 正常,问题在导入的落点;不能 ⇒ 该表整体不渲染 items。
 *   ② 目标表**当前**的 :data 数组里到底有几行?(通过行数 + el-table 虚拟渲染不会发生,行数=数组长度)
 *
 * 只读;唯一写操作是往草稿明细追加行(不保存)。
 * 用法:node tools/archive/_probe-matpick-precise.cjs [单号] [身份]
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PAGE = process.env.YINJIA_PAGE || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DOC = process.argv[2] || 'SD-2026-10-0001'
const USER = process.argv[3] || 'admin'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9784
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n=== 「从物料清单引用」落行精确取证(身份=${USER} / 单=${DOC}) ===`)
  const lr = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: '123456', factory: FACTORY }),
  })).json()
  if (lr?.code !== 200) throw new Error('登录失败')

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-matpick2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1300', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3600); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `matpick2-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1300, deviceScaleFactor: 1, mobile: false })
    await nav(`${PAGE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(lr.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${PAGE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(DOC)}`)
    await sleep(1500)

    // 切到有那张表的页(第 4 个页签「成品及包装运输」;找不到就按当前页继续)
    await ev(`(function(){
      var el=[].slice.call(document.querySelectorAll('*')).filter(function(e){
        return e.offsetParent && (e.textContent||'').trim()==='成品及包装运输' })[0];
      if (el) el.click(); return el?'OK':'NO_TAB';
    })()`)
    await sleep(1800)

    // ★ 目标表 = 自己的容器里含「物料编码」表头的那张 .rsp-dt-wrap
    const probe = `(function(){
      var wraps = [].slice.call(document.querySelectorAll('.rsp-dt-wrap')).filter(function(w){ return w.offsetParent });
      var info = wraps.map(function(w,i){
        var rows = w.querySelectorAll('tbody tr');
        return { i:i, rows: rows.length, addBtns: w.querySelectorAll('.rs-op-add').length,
                 delBtns: w.querySelectorAll('.rs-op-del').length,
                 head: (w.textContent||'').replace(/\\s+/g,' ').trim().slice(0,46),
                 rowTexts: [].slice.call(rows).slice(0,3).map(function(r){ return (r.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40) }) };
      });
      var target = -1;
      for (var k=0;k<info.length;k++){ if (info[k].head.indexOf('物料编码')>=0){ target=k; break } }
      return JSON.stringify({ wraps: info, targetIndex: target });
    })()`

    const before = JSON.parse(await ev(probe))
    console.log('\n──────── ① 目标表定位(全部 .rsp-dt-wrap 容器) ────────')
    before.wraps.forEach((w) => console.log(`  [${w.i}] 行=${w.rows} ＋=${w.addBtns} ×=${w.delBtns} | ${w.head}`))
    console.log(`  ⇒ 目标表 index=${before.targetIndex}`)
    if (before.targetIndex < 0) { console.log('\n找不到含「物料编码」表头的表,无法继续'); await shot('noTarget'); return }

    // ★ 对照实验:点目标表**自己的** ＋
    const afterAdd = JSON.parse(await ev(`(function(){
      var wraps = [].slice.call(document.querySelectorAll('.rsp-dt-wrap')).filter(function(w){ return w.offsetParent });
      var w = wraps[${before.targetIndex}];
      if (!w) return JSON.stringify({err:'no wrap'});
      var b = w.querySelectorAll('tbody tr').length;
      var btn = w.querySelector('.rs-op-add');
      if (btn) btn.click();
      return JSON.stringify({ before:b, clicked: !!btn });
    })()`))
    await sleep(1600)
    const afterAddState = JSON.parse(await ev(probe))
    const t2 = afterAddState.wraps[before.targetIndex] || {}
    console.log(`\n──────── ② 对照:点目标表自己的 ＋ ────────`)
    console.log(`  ${afterAdd.before} 行 → ${t2.rows} 行   (clicked=${afterAdd.clicked})`)
    console.log(`  ⇒ ${Number(t2.rows) > Number(afterAdd.before) ? 'addRow 在这张表上**有效** ⇒ 该表能渲染 items' : 'addRow 在这张表上也**不出行** ⇒ 该表整体不渲染 items'}`)
    console.log(`     行文本: ${JSON.stringify(t2.rowTexts || [])}`)
    await shot('afterAdd')

    // ③ 再把刚加的行删掉,回到干净状态,然后走导入
    await ev(`(function(){
      var wraps = [].slice.call(document.querySelectorAll('.rsp-dt-wrap')).filter(function(w){ return w.offsetParent });
      var w = wraps[${before.targetIndex}]; if (!w) return 'no wrap';
      var d = w.querySelector('.rs-op-del'); if (d) d.click(); return 'deleted';
    })()`)
    await sleep(1200)

    const beforeImp = JSON.parse(await ev(probe))
    const b0 = (beforeImp.wraps[beforeImp.targetIndex] || {}).rows

    // 走导入
    await ev(`(function(){
      var el=[].slice.call(document.querySelectorAll('.rs-lib-btn')).filter(function(e){
        return e.offsetParent && (e.textContent||'').indexOf('从物料清单引用')>=0 })[0];
      if (el) { el.click(); return 'OPENED' } return 'NO_BTN';
    })()`)
    await sleep(2400)
    const dlgRows = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0});
      var d=ds[ds.length-1]; return d? d.querySelectorAll('.el-table__body tbody tr').length : -1;
    })()`)
    await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0});
      var d=ds[ds.length-1]; if(!d) return 'no dlg';
      var cb=d.querySelector('.el-table__body tbody tr .el-checkbox'); if(!cb) return 'no cb'; cb.click(); return 'checked';
    })()`)
    await sleep(700)
    const btnTxt = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0});
      var d=ds[ds.length-1]; if(!d) return '';
      return [].slice.call(d.querySelectorAll('button')).map(function(b){return (b.textContent||'').trim()}).join('|');
    })()`)
    await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0});
      var d=ds[ds.length-1]; if(!d) return 'no dlg';
      var b=[].slice.call(d.querySelectorAll('button')).filter(function(x){return (x.textContent||'').indexOf('导入')>=0})[0];
      if (b) { b.click(); return 'imported' } return 'no btn';
    })()`)
    await sleep(2000)
    await ev(`(function(){ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); return 'esc' })()`)
    await sleep(1200)

    const afterImp = JSON.parse(await ev(probe))
    const t3 = afterImp.wraps[afterImp.targetIndex] || {}
    // ★ 关键:各列是 el-input/textarea 渲染的,**值在 input.value 里,textContent/innerText 都读不到**
    //   —— 之前几版探针全用 innerText 找 M-001,所以一直误判"没落行"。
    const vals = await ev(`(function(){
      var wraps = [].slice.call(document.querySelectorAll('.rsp-dt-wrap')).filter(function(w){ return w.offsetParent });
      var w = wraps[${afterImp.targetIndex}]; if (!w) return '[]';
      var out = [];
      [].slice.call(w.querySelectorAll('tbody tr')).forEach(function(tr, ri){
        var cells = [].slice.call(tr.querySelectorAll('td')).map(function(td){
          var f = td.querySelector('input, textarea');
          return f ? String(f.value == null ? '' : f.value) : (td.textContent||'').replace(/\\s+/g,' ').trim();
        });
        out.push({ row: ri, cells: cells });
      });
      return JSON.stringify(out);
    })()`)
    console.log(`\n──────── ③ 导入:目标表自己的行数 ────────`)
    console.log(`  弹窗 ${dlgRows} 行 / 按钮 = ${btnTxt}`)
    console.log(`  导入前目标表 ${b0} 行 → 导入后 ${t3.rows} 行`)
    console.log(`  行文本(不含输入框值): ${JSON.stringify(t3.rowTexts || [])}`)
    console.log(`  ★ 逐格实际值(含 input.value): ${vals}`)
    console.log(`  ⇒ ${Number(t3.rows) > Number(b0) ? '★ 导入落行成功' : '✗ 导入后目标表行数未变 —— 复现'}`)
    const f = await shot('afterImport')
    console.log(`\n  截图:${f}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
