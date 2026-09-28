/* 流畅度与帧率探针(CDP):面板切换 / 弹窗开关 / 宽表滚动的逐帧采样
   用法: node tools/archive/_fps-probe.cjs [baseUrl]
   量什么:
     - 每个场景用 rAF 逐帧采样,算 平均帧间隔/等效FPS/p95帧间隔/最大帧间隔/掉帧数(>50ms,>100ms)
     - PerformanceObserver 'long-animation-frame'(LoAF)统计长帧数与阻塞时长
   口径诚实声明:headless 下绝对 FPS ≠ 真显示器帧率(无真实 vsync);
     但帧间隔抖动/掉帧/LoAF 直接反映主线程阻塞,是"卡不卡"的有效判据。
   场景:
     A 面板切换:TEAM→INV(宽表)/ INV→SO_ORDER(单据)/ SO_ORDER→TEAM(轻)
     B 弹窗(在 PARTNER 上):查询弹窗、字段管理(开+关)、表格调整(开+关)
     C 滚动:INV 表格横向滚动(56 列) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = 'http://localhost:8090'
const PORT = 9453
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const H = { Authorization: `Bearer ${token}` }

  // 预期列数(就绪判据,口径同 _ux-weight/_render-weight,已标定)
  const expect = {}
  for (const p of ['INV', 'SO_ORDER', 'TEAM', 'PARTNER']) {
    const j = await fetch(`${API}/api/px/getPanelConfig?panelCode=${p}`, { headers: H }).then((r) => r.json())
    expect[p] = (j.data?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).length
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fps-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const rows = []
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    // 帧采样器 + LoAF 观测(每个会话注入一次)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__fps = { frames: [], run: false };
      window.__loaf = [];
      window.__fpsLoop = function (t) { if (!window.__fps.run) return; window.__fps.frames.push(t); requestAnimationFrame(window.__fpsLoop) };
      window.__fpsStart = function () { window.__fps.frames = []; window.__fps.run = true; requestAnimationFrame(window.__fpsLoop) };
      window.__fpsStop = function () { window.__fps.run = false; return window.__fps.frames.slice() };
      try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { window.__loaf.push(Math.round(e.duration)) }) }).observe({ type: 'long-animation-frame', buffered: false }) } catch (e) {}
    ` })

    // 会话准备(E6:注入后必须经 about:blank 强制真加载)
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1200)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/TEAM` }); await sleep(5000)

    const fpsStats = (frames) => {
      if (!frames || frames.length < 2) return null
      const dts = []
      for (let i = 1; i < frames.length; i++) dts.push(frames[i] - frames[i - 1])
      const s = dts.slice().sort((a, b) => a - b); const n = s.length
      const avg = s.reduce((a, b) => a + b, 0) / n
      return {
        frames: frames.length, ms: Math.round(frames[frames.length - 1] - frames[0]),
        avgDt: Math.round(avg * 10) / 10, fps: Math.round(1000 / avg),
        p95dt: Math.round(s[Math.floor(n * 0.95)]), maxDt: s[n - 1],
        d50: dts.filter((d) => d > 50).length, d100: dts.filter((d) => d > 100).length,
      }
    }
    const loafNow = async () => JSON.parse(await evaluate(`JSON.stringify(window.__loaf||[])`))
    const report = (name, st, loaf, note = '') => {
      rows.push({ name, ...st, loaf: loaf.length })
      console.log(`  ${name.padEnd(26)} ${String(st.ms).padStart(5)}ms ${String(st.frames).padStart(4)}帧 均FPS=${String(st.fps).padStart(3)} p95帧距=${String(st.p95dt).padStart(4)}ms 最大=${String(st.maxDt).padStart(5)}ms 掉帧>50ms=${String(st.d50).padStart(3)} >100ms=${String(st.d100).padStart(2)} LoAF=${String(loaf.length).padStart(2)}个${note ? '  ' + note : ''}`)
    }
    const waitPanel = async (p, ms = 15000) => {
      // 列级虚拟化(2026-09-28)后,宽表面板 DOM 里只有可见列+左右占位列,表头数 ≠ 配置列数
      // ⇒ 宽表(>16 列)就绪判据放宽为「遮罩消失且有表头」;窄面板仍用精确列数
      const lazy = expect[p] > 16
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        const th = await evaluate(`document.querySelectorAll('.el-table__header th').length`)
        const mask = await evaluate(`!!document.querySelector('.el-loading-mask')`)
        const okReady = lazy ? (th >= 4 && !mask) : (Math.abs(th - expect[p]) <= 2 && !mask)
        if (okReady) return Date.now() - t0
        await sleep(100)
      }
      return -1
    }
    const switchTo = async (from, to) => {
      await evaluate(`location.hash='#/panelx/list/${from}'; 'ok'`); await waitPanel(from); await sleep(1800)
      const l0 = await loafNow()
      await evaluate(`window.__loaf=[]; window.__fpsStart(); location.hash='#/panelx/list/${to}'; 'ok'`)
      const took = await waitPanel(to)
      const frames = JSON.parse(await evaluate(`JSON.stringify(window.__fpsStop())`))
      const st = fpsStats(frames); if (!st) return console.log(`  ${from}→${to}: 帧采样不足`)
      report(`${from} → ${to}`, st, (await loafNow()).slice(0, 200), `就绪${took}ms`)
    }

    console.log('\n==== A. 面板切换(逐帧) ====')
    if (!process.env.SKIP_AB) {
      await switchTo('TEAM', 'INV')
      await switchTo('INV', 'SO_ORDER')
      await switchTo('SO_ORDER', 'TEAM')
    } else console.log('  (SKIP_AB=1,跳过 —— A 段数据另行取自上一轮)')

    // ---- B. 弹窗(在 PARTNER 上) ----
    console.log('\n==== B. 弹窗开/关(逐帧,PARTNER 上) ====')
    await evaluate(`location.hash='#/panelx/list/PARTNER'; 'ok'`); await waitPanel('PARTNER'); await sleep(2500)
    const dialogVisible = (title) => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('${title}'));if(!d)return false;const r=d.getBoundingClientRect();return r.height>0&&r.width>0})()`)
    const noToast = () => evaluate(`document.querySelectorAll('.el-message').length===0?'CLEAR':'BUSY'`)
    const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await fn()) === true) return true; await sleep(120) } return false }
    const openGroup = async (action) => {
      for (let i = 0; i < 10 && (await noToast()) !== 'CLEAR'; i++) await sleep(200)
      const r = await evaluate(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_GRP';const c=grp.querySelector('.tb-caret');if(!c)return 'NO_CARET';if(!c.parentElement.querySelector('.tb-menu'))c.click();return 'OK'})()`)
      await sleep(500)
      return evaluate(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/${action}/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
    }
    const dlgOpen = async (name, title, trigger) => {
      const c = await trigger()
      const frames = JSON.parse(await evaluate(`JSON.stringify(window.__fpsStop())`))
      const st = fpsStats(frames)
      const vis = await dialogVisible(title)
      if (st) report(`开:${name}`, st, (await loafNow()), `触发=${c} 可见=${vis}`)
      else console.log(`  开:${name} 触发=${c} 可见=${vis}(帧采样不足)`)
      return vis
    }
    const dlgClose = async (name, title, closer) => {
      const c = await closer()
      await wait(() => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('${title}'));if(!d)return true;const r=d.getBoundingClientRect();return !(r.height>0&&r.width>0)})()`), 4000)
      const frames = JSON.parse(await evaluate(`JSON.stringify(window.__fpsStop())`))
      const st = fpsStats(frames)
      if (st) report(`关:${name}`, st, (await loafNow()), `触发=${c}`)
      else console.log(`  关:${name} 触发=${c}(帧采样不足)`)
    }
    const closeByX = (title) => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('${title}'));if(!d)return 'NO_DLG';const b=d.querySelector('.el-dialog__headerbtn');if(!b)return 'NO_X';b.click();return 'CLICKED'})()`)
    const closeByFooter = (title, text) => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('${title}'));if(!d)return 'NO_DLG';const f=d.querySelector('.el-dialog__footer')||d;const b=[...f.querySelectorAll('button')].find(x=>/${text}/.test(x.textContent||''));if(!b)return 'NO_BTN';b.click();return 'CLICKED'})()`)

    // B1 查询弹窗(工具栏独立「查询」按钮;与其它弹窗一致:先布防,再在 trigger 里点)
    await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
    await dlgOpen('查询弹窗', '查询', () => evaluate(`(()=>{const b=document.querySelector('.toolbar-query-btn');if(!b)return 'NO_BTN';b.click();return 'CLICKED'})()`))
    await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
    await dlgClose('查询弹窗', '查询', () => closeByFooter('查询', '取消|关闭') === 'CLICKED' ? 'CLICKED(页脚)' : closeByX('查询'))
    await sleep(800)

    // B2 字段管理(更多 ▼ → 字段管理;关闭按钮是刚修的缺陷回归点)
    await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
    const fmOpened = await dlgOpen('字段管理', '字段管理', () => openGroup('字段管理'))
    if (fmOpened) {
      await sleep(600)
      await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
      await dlgClose('字段管理', '字段管理', () => closeByFooter('字段管理', '关闭'))
      await sleep(800)
    }

    // B3 表格调整
    await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
    const cpOpened = await dlgOpen('表格调整', '表格调整', () => openGroup('表格调整'))
    if (cpOpened) {
      await sleep(600)
      await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
      await dlgClose('表格调整', '表格调整', () => closeByX('表格调整'))
    }

    // ---- C. 滚动(INV 宽表) ----
    console.log('\n==== C. INV 宽表横向滚动(逐帧) ====')
    await evaluate(`location.hash='#/panelx/list/INV'; 'ok'`); await waitPanel('INV'); await sleep(2500)
    // EP 2.x 表格滚动容器在 .el-scrollbar__wrap(旧 .el-table__body-wrapper 兜底)
    // ⚠ 滚动不做 rAF Promise(实测会挂死整个 evaluate)——每步独立 evaluate + 固定间隔,帧采样跨全序列
    const WRAP = `(document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')||document.querySelector('.el-table__body-wrapper'))`
    const scrollInfo = await evaluate(`(()=>{const c=${WRAP};if(!c)return null;return JSON.stringify({dx:Math.round(c.scrollWidth-c.clientWidth),dy:Math.round(c.scrollHeight-c.clientHeight)})})()`)
    const si = JSON.parse(scrollInfo || 'null')
    if (si && si.dx > 100) {
      await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
      for (let k = 0; k < 45; k++) { await evaluate(`${WRAP} && (${WRAP}.scrollLeft += 100, 'ok')`); await sleep(33) }
      await sleep(400)
      const frames = JSON.parse(await evaluate(`JSON.stringify(window.__fpsStop())`))
      const st = fpsStats(frames)
      if (st) report('INV 横向滚动45步', st, (await loafNow()), `可滚宽${si.dx}px`)
    } else console.log(`  (无可横向滚动宽度: ${si ? si.dx : '?'}px)`)
    if (si && si.dy > 100) {
      await evaluate(`window.__loaf=[]; window.__fpsStart(); 'armed'`)
      for (let k = 0; k < 30; k++) { await evaluate(`${WRAP} && (${WRAP}.scrollTop += 80, 'ok')`); await sleep(33) }
      await sleep(400)
      const frames = JSON.parse(await evaluate(`JSON.stringify(window.__fpsStop())`))
      const st = fpsStats(frames)
      if (st) report('INV 纵向滚动30步', st, (await loafNow()), `可滚高${si.dy}px`)
    } else console.log(`  (无可纵向滚动高度: ${si ? si.dy : '?'}px —— 单页 25 行未超视口)`)

    // 汇总
    const bad = rows.filter((r) => r.d50 > 0 || r.maxDt > 200)
    console.log(`\n==== 汇总:${rows.length} 个场景;其中掉帧(>50ms)或最大帧距>200ms 的 ${bad.length} 个 ====`)
    for (const b of bad) console.log(`  ${b.name}: 掉帧${b.d50} 最大${b.maxDt}ms`)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
