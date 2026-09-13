// _probe-asm-swap.cjs — 组装工艺清单页签调换 + BOM 报告头对齐 验收:
//   ① 页签顺序:第 1 个=组装BOM表,第 2 个=组装工艺清单
//   ② 打开面板默认落在 BOM 页:报告头大标题跨全宽(≈1040px,不再挤 130px),无右侧默认信息块(密级等)
//   ③ BOM 页有 产品基本信息/物料清单/修订记录;切到工艺页有 21 道工序表(plain 标题条)
//   ④ 两页左右边界均 1040 整齐
// 用法: node tools/_probe-asm-swap.cjs [BASE] [截图目录]
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9384
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const OUTDIR = process.argv[3] || 'C:\\INCER\\YINJIA-MES\\tools'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sw-'))
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
    const shot = async (file) => { const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(file, Buffer.from(s.result.data, 'base64')); console.log('shot →', file) }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_ASM_PROC`)
    await sleep(2600)
    // 关掉可能的初始化配置弹窗(新 profile 首次进入)
    await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog__footer .el-button, .el-message-box__btns .el-button'));
      for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').trim();if(t==='下次再说'||t==='跳过'||t==='取消'||t==='暂不'){bs[i].click();return 1}}return 0})()`)
    await sleep(600)
    // ① 页签顺序
    const tabs = await ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return (t.textContent||'').trim()})`)
    ok(Array.isArray(tabs) && tabs[0] === '组装BOM表' && tabs[1] === '组装工艺清单', `① 页签顺序 BOM 在前(${JSON.stringify(tabs)})`)
    // ② 默认页 = BOM,标题跨全宽,无默认信息块
    const topic = await ev(`(function(){var t=document.querySelector('.rs-topic-cell');if(!t)return 'none';
      return JSON.stringify({col:t.colSpan,w:Math.round(t.getBoundingClientRect().width),txt:(t.textContent||'').trim().slice(0,12)})})()`)
    const tp = JSON.parse(topic === 'none' ? '{"col":0}' : topic || '{}')
    ok(tp.col === 4 && (tp.w || 0) >= 1000, `②-1 大标题跨全宽(col=${tp.col}, w=${tp.w}px)`)
    const infoLabels = await ev(`[].slice.call(document.querySelectorAll('.rs-info-label')).map(function(x){return (x.textContent||'').trim()})`)
    ok((infoLabels || []).length === 0, `②-2 无默认信息块(${JSON.stringify(infoLabels)})`)
    // ③ BOM 页内容
    const bomBars = await ev(`[].slice.call(document.querySelectorAll('.rs-sectionbar, .rs-dt .rs-lib-btn')).filter(function(x){return x.offsetParent}).map(function(x){return (x.textContent||'').trim().slice(0,18)})`)
    ok((bomBars || []).some((b) => b.indexOf('产品基本信息') >= 0), `③-1 BOM 页含产品基本信息(${JSON.stringify((bomBars||[]).slice(0,3))})`)
    const dtsBom = await ev(`document.querySelectorAll('.rs-dt').length`)
    ok(dtsBom >= 2, `③-2 BOM 页两张表(物料清单/修订记录,=${dtsBom})`)
    // ④ BOM 页宽(趁还在 BOM 页量)
    const wBom = await ev(`(function(){var t=document.querySelector('.rs-head-t');return t?Math.round(t.getBoundingClientRect().width):0})()`)
    ok(Math.abs((wBom || 0) - 1040) <= 4, `④ BOM 页宽 1040 整齐(=${wBom})`)
    await shot(path.join(OUTDIR, '_asmbom-fixed.png'))
    // 切到工艺页
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.rsp-page-tab'));for(var i=0;i<t.length;i++){if((t[i].textContent||'').indexOf('工艺')>=0){t[i].click();return 1}}return 0})()`)
    await sleep(1000)
    const procTitle = await ev(`(function(){var p=document.querySelector('.rsp-plain-title');return p?(p.textContent||'').trim().slice(0,20):''})()`)
    ok(String(procTitle).indexOf('关键工序控制清单') >= 0, `③-3 工艺页 plain 标题条(${procTitle})`)
    // 工序表存在且结构完整(表头含 工序/工序控制内容/管控要求/检查比例;行数随单据数据,不强求 21)
    const procHead = await ev(`(function(){var ths=[].slice.call(document.querySelectorAll('.rs-dt th')).filter(function(x){return x.offsetParent});
      return ths.map(function(x){return (x.textContent||'').trim()}).join('|')})()`)
    ok(String(procHead).indexOf('工序') >= 0 && String(procHead).indexOf('检查比例') >= 0, `③-4 工序表表头齐(${procHead})`)
    await shot(path.join(OUTDIR, '_asmproc-page.png'))
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
