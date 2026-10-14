/**
 * _probe-spec-materialpick.cjs —— 规格书「从物料清单引用」活体验证(2026-10-13)
 *
 * 为什么必须单独一支:subagent 恢复该功能后只到「编译 + 单测 + DB 元数据」一层,
 * 没有浏览器实测 —— 而这条链的失败点全在活体:按钮是否渲染在第 3 页、
 * 弹窗是否打得开、勾选导入后明细有没有真的多出行。
 *
 * 数据源已由前置实测确认:WLBOM 面板返回 list[0].detail.items(mate 的 5 行)。
 * 账套 YJ_TEST(硬断言);只读为主 —— 唯一写操作是点「导入」往草稿明细追加行(不保存)。
 * 用法:node tools/archive/_probe-spec-materialpick.cjs [单号]
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
const USER = process.env.PROBE_USER || 'admin'
const DOC = process.argv[2] || 'SD-2026-10-0001'
const TAB = process.argv[3] || '成品及包装运输'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9781
const SHOTS = path.join(__dirname, '_shots')

let PASS = 0, FAIL = 0
const check = (id, expect, ok, actual) => {
  if (ok) PASS++; else FAIL++
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}\n        期望: ${expect}\n        实际: ${actual}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n=== 规格书「从物料清单引用」活体验证(身份=${USER} / 页 ${PAGE} / 单=${DOC}) ===`)
  const lr = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: '123456', factory: FACTORY }),
  })).json()
  if (lr?.code !== 200) throw new Error('登录失败:' + JSON.stringify(lr).slice(0, 150))
  if (lr.data.user?.factory !== FACTORY) throw new Error('账套不是 YJ_TEST')
  console.log(`  ${USER} → ${lr.data.user.realName} isAdmin=${lr.data.user.isAdmin}`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-matpick-'))
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
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3400); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `spec-matpick-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const clickByText = (txt) => ev(`(function(){
      var el = [].slice.call(document.querySelectorAll('.el-tabs__item, .rs-tab, [class*="tab"], span, div, button'))
        .filter(function(e){ return e.offsetParent && (e.textContent||'').trim() === ${JSON.stringify(txt)} })
        .sort(function(a,b){ return a.textContent.length - b.textContent.length })[0];
      if (!el) return 'NOT_FOUND'; el.click(); return 'CLICKED:' + el.tagName + '.' + String(el.className||'').slice(0,40);
    })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1300, deviceScaleFactor: 1, mobile: false })
    await nav(`${PAGE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(lr.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${PAGE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(DOC)}`)
    await sleep(1500)

    // ① 切到目标页签
    console.log(`\n──────── ① 切到「${TAB}」页 ────────`)
    const tabRes = await clickByText(TAB)
    await sleep(1800)
    console.log(`  切页 = ${tabRes}`)
    const pageNow = await ev(`(function(){ var e=document.querySelector('.el-tabs__item.is-active, .rs-tab.active'); return e?(e.textContent||'').trim():'' })()`)
    check('1-tab', `当前页签 =「${TAB}」`, pageNow === TAB, `当前=「${pageNow}」`)

    // ② 按钮是否渲染
    console.log('\n──────── ② 「从物料清单引用」按钮 ────────')
    const btnInfo = await ev(`(function(){
      var hits = [].slice.call(document.querySelectorAll('.rs-lib-btn')).filter(function(e){
        return e.offsetParent && (e.textContent||'').indexOf('从物料清单引用') >= 0 });
      return JSON.stringify({ n: hits.length, txt: hits.length ? (hits[0].textContent||'').trim() : '' });
    })()`)
    console.log(`  按钮 = ${btnInfo}`)
    const nBtn = JSON.parse(btnInfo).n
    check('2-button', '第 3 页出现「从物料清单引用」按钮(≥1 个)', nBtn >= 1, `命中 ${nBtn} 个`)

    if (nBtn < 1) { console.log('\n按钮没有 ⇒ 后续无法验证'); const f = await shot('nobutton'); console.log('截图:' + f); return }
    const f1 = await shot('button')

    // ③ 点开弹窗
    console.log('\n──────── ③ 打开弹窗 ────────')
    await ev(`(function(){ var el=[].slice.call(document.querySelectorAll('.rs-lib-btn')).filter(function(e){
        return e.offsetParent && (e.textContent||'').indexOf('从物料清单引用')>=0 })[0]; if(el) el.click(); return 'ok' })()`)
    await sleep(2500)
    const dlg = await ev(`(function(){
      var ds = [].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.getBoundingClientRect().height>0 });
      var d = ds[ds.length-1]; if(!d) return JSON.stringify({open:false});
      return JSON.stringify({ open:true, title:(d.querySelector('.el-dialog__title')||{}).textContent||'',
        rows:d.querySelectorAll('.el-table__body tbody tr').length });
    })()`)
    console.log(`  弹窗 = ${dlg}`)
    const D = JSON.parse(dlg)
    check('3-dialog', '弹窗打开且标题含「从物料清单引用」', D.open && String(D.title).indexOf('从物料清单引用') >= 0, JSON.stringify(D))
    check('4-rows', '弹窗表格列出 mate 的 5 行', D.rows === 5, `行数=${D.rows}`)
    const f2 = await shot('dialog')

    // ④ 勾第一行 → 导入
    console.log('\n──────── ④ 勾选并导入 ────────')
    const before = await ev(`document.querySelectorAll('.rs-table tbody tr, table.rs-table tbody tr').length`)
    const picked = await ev(`(function(){
      var ds = [].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.getBoundingClientRect().height>0 });
      var d = ds[ds.length-1]; if(!d) return 'NO_DLG';
      var cb = d.querySelector('.el-table__body tbody tr .el-checkbox');
      if (!cb) return 'NO_CHECKBOX';
      cb.click(); return 'CHECKED';
    })()`)
    await sleep(700)
    // ★ 关键区分点:看弹窗底部「导入(N)」里的 N —— 它直接反映 matPickChecked 是否真的记到了勾选。
    //   N=0 ⇒ 是探针的点击方式没触发 el-table 的 selection(功能可能本来是好的);
    //   N≥1 而导入后表里仍无行 ⇒ 才是真 bug。
    const btnText = await ev(`(function(){
      var ds = [].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.getBoundingClientRect().height>0 });
      var d = ds[ds.length-1]; if(!d) return 'NO_DLG';
      var bs = [].slice.call(d.querySelectorAll('button')).map(function(b){ return (b.textContent||'').trim() });
      var cbs = d.querySelectorAll('.el-table__body tbody tr .el-checkbox.is-checked').length;
      return JSON.stringify({ buttons: bs, 已勾选行: cbs });
    })()`)
    console.log(`  弹窗底部按钮 & 勾选态 = ${btnText}`)
    const imported = await ev(`(function(){
      var ds = [].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.getBoundingClientRect().height>0 });
      var d = ds[ds.length-1]; if(!d) return 'NO_DLG';
      var btns = [].slice.call(d.querySelectorAll('button')).filter(function(b){ return (b.textContent||'').indexOf('导入') >= 0 });
      if (!btns.length) return 'NO_IMPORT_BTN:' + [].slice.call(d.querySelectorAll('button')).map(function(b){return (b.textContent||'').trim()}).join('|');
      btns[0].click(); return 'IMPORTED';
    })()`)
    console.log(`  勾选 = ${picked} / 导入 = ${imported}`)
    await sleep(1500)
    // 抓导入后弹出的成功提示原文(它会写明「已导入 N 行」—— N 直接暴露 for 循环跑了几次)
    const msg = await ev(`(function(){
      var ms = [].slice.call(document.querySelectorAll('.el-message')).filter(function(m){ return m.getBoundingClientRect().height>0 });
      return ms.length ? (ms[ms.length-1].textContent||'').replace(/\\s+/g,' ').trim() : '(无提示)';
    })()`)
    console.log(`  导入后的提示 = 「${msg}」`)

    // 关掉弹窗再查 —— 否则 body.innerText 里的「炭棒」只是弹窗自己那行的文字,会假通过
    await ev(`(function(){
      var ds = [].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.getBoundingClientRect().height>0 });
      var d = ds[ds.length-1];
      if (d) { var bs = [].slice.call(d.querySelectorAll('button')).filter(function(b){ return (b.textContent||'').trim()==='取消' }); if (bs.length) { bs[0].click(); return 'cancelled' } }
      return 'no-dialog';
    })()`)
    await sleep(1500)
    const dlgOpen = await ev(`[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.getBoundingClientRect().height>0 }).length`)
    console.log(`  关弹窗后可见弹窗数 = ${dlgOpen}`)

    const after = await ev(`(function(){
      // 规格书第3页那张表的行 —— 用多种选择器兜底,并排除弹窗内的表
      var rows = [].slice.call(document.querySelectorAll('table tbody tr')).filter(function(tr){
        return tr.offsetParent && !tr.closest('.el-dialog') && (tr.textContent||'').trim().length > 0;
      });
      return rows.length;
    })()`)
    check('5-import', '导入后目标表出现数据行', Number(after) >= 1, `关弹窗后表格数据行 = ${after}`)

    const hasMat = await ev(`(function(){
      var t = document.body.innerText || '';
      return JSON.stringify({ 'M-001': t.indexOf('M-001') >= 0, '炭棒': t.indexOf('炭棒') >= 0, 'T382': t.indexOf('T382') >= 0 });
    })()`)
    console.log(`  页面文本命中(弹窗已关) = ${hasMat}`)
    const H = JSON.parse(hasMat)
    check('6-mapped', '导入的物料编码 M-001 出现在规格书明细里', H['M-001'], hasMat)

    // 定位用:把当前可见的表格行文本全 dump 出来(看导入的行到底进没进 DOM)
    const dump = await ev(`(function(){
      var rows = [].slice.call(document.querySelectorAll('table tbody tr')).filter(function(tr){
        return tr.offsetParent && !tr.closest('.el-dialog') && (tr.textContent||'').trim().length > 0;
      });
      return rows.slice(0, 18).map(function(tr, i){
        return i + '|' + (tr.textContent||'').replace(/\\s+/g,' ').trim().slice(0, 70);
      }).join('\\n    ');
    })()`)
    console.log(`\n  可见表格行 dump:\n    ${dump}`)
    const tabs = await ev(`(function(){
      return [].slice.call(document.querySelectorAll('.el-tabs__item, [class*="rs-tab"], [class*="tab"]'))
        .filter(function(e){ return e.offsetParent && (e.textContent||'').trim().length < 20 })
        .map(function(e){ return (e.textContent||'').trim() + (e.className.indexOf('active')>=0 || e.className.indexOf('is-active')>=0 ? '(active)' : '') })
        .join(' | ');
    })()`)
    console.log(`  页签现状 = ${tabs}`)

    // ★ 对照实验:点表格自带的 ＋(= addRow,已在跑的功能,同样是 touch().push + emit('dirty'))。
    //   它若也不出行 ⇒ 问题不在这条导入逻辑,而在这张表整体没渲染 rowsOf(dt)(比如走了
    //   design 模板分支的 v-if,数据行 v-else 永不渲染);它若出行 ⇒ 才是导入逻辑的 push 目标不对。
    const cnt = () => ev(`[].slice.call(document.querySelectorAll('table tbody tr')).filter(function(tr){ return tr.offsetParent && !tr.closest('.el-dialog') }).length`)
    const beforeAdd = await cnt()
    const addRes = await ev(`(function(){ var el=document.querySelector('.rs-op-add'); if(!el) return 'NO_BTN'; el.click(); return 'CLICKED' })()`)
    await sleep(1600)
    const afterAdd = await cnt()
    console.log(`\n  对照实验:点 ＋ (addRow) = ${addRes} ⇒ ${beforeAdd} 行 → ${afterAdd} 行`)
    if (addRes === 'CLICKED' && Number(afterAdd) > Number(beforeAdd)) console.log('  ⇒ addRow 有效:这张表能渲染 items,问题在导入逻辑的 push 目标')
    else if (addRes === 'CLICKED') console.log('  ⇒ addRow 也无效:这张表整体不渲染 rowsOf(dt) —— 查 design 分支的 v-if / rowsOf 取值')
    else console.log('  ⇒ 表格里没有 ＋ 按钮(可能非 design 分支),换个判据')
    const f3 = await shot('imported')
    console.log(`\n  截图:${f1}\n        ${f2}\n        ${f3}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log(`\n════ 汇总:格子数=${PASS + FAIL} PASS=${PASS} FAIL=${FAIL} ════`)
  process.exit(FAIL ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
