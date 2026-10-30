/*
 * _shot-dialog.cjs — 2026-10-30 工单调拨弹窗排版验收(一次性探针)
 *
 * 做什么:headless Edge + CDP(项目里既有 e2e 的同一套写法,Node 22 自带 WebSocket)
 *   ① 用 8090 的 /api/auth/login 拿 token → 写 localStorage;② 打开 5173 的工单排产页;
 *   ③ 点左侧「2号车间」→ 勾第一行 → 点「调拨」→ 等候选接口回来;
 *   ④ 量一遍弹窗内每行"标签/控件的 left 与 width"(对齐用)+ 截弹窗图。
 *
 * 用法: node tools/archive/_transfer-scope-20261030/_shot-dialog.cjs [输出png]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FE = process.env.YJ_FE || 'http://localhost:5173'   // 8090 = 打包后的 jar(验证线上前端)
const OUT = process.argv[2] || path.join(__dirname, '_shot-transfer-dialog.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!login?.data?.token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shot-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

    await send('Page.navigate', { url: `${FE}/#/login` }); await sleep(2400)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
                    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
                    localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${FE}/#/prod/plan/workOrderBoard` }); await sleep(6500)

    // 选左侧产线
    const picked = await evaluate(`(() => {
      const lines = [...document.querySelectorAll('.wb-line')]
      const el = lines.find(e => (e.innerText||'').includes('2号车间')) || lines[0]
      if (!el) return { ok:false, why:'no .wb-line', lines: lines.length }
      el.click()
      return { ok:true, line: (el.querySelector('.wb-line-name')?.innerText||'').trim() }
    })()`)
    console.log('左侧选线:', JSON.stringify(picked))
    await sleep(2200)

    // 勾第一行(必须点 checkbox 的 input,点外层 div 不会触发选中) → 再点调拨
    const checked = await evaluate(`(() => {
      const inp = document.querySelector('.wb-main .el-table__body input.el-checkbox__original')
      if (!inp) return { ok:false, why:'no checkbox input' }
      inp.click()
      return { ok:true }
    })()`)
    console.log('勾行:', JSON.stringify(checked))
    await sleep(700)
    const clicked = await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.wb-actions button')].find(b => (b.innerText||'').includes('调拨'))
      if (!btn) return { ok:false, why:'no transfer button' }
      btn.click()
      return { ok:true, btnText: (btn.innerText||'').trim(), disabled: btn.disabled }
    })()`)
    console.log('点调拨:', JSON.stringify(clicked))
    // 等弹窗出现(候选接口回来才填下拉,这里只等 DOM)
    for (let i = 0; i < 20; i++) {
      const has = await evaluate(`!!document.querySelector('.el-dialog')`)
      if (has) break
      await sleep(400)
    }
    await sleep(1800)

    // 量弹窗内部对齐 + 文案
    const metrics = await evaluate(`(() => {
      const dlg = document.querySelector('.el-overlay-dialog .el-dialog, .el-dialog')
      if (!dlg) return { ok:false, why:'no dialog' }
      const drect = dlg.getBoundingClientRect()
      const rows = [...dlg.querySelectorAll('.ra-row')].map(r => {
        const lb = r.querySelector('.ra-label'), ct = r.querySelector('.el-select, .el-input, .ra-value, .ra-tip')
        const rr = r.getBoundingClientRect(), lr = lb && lb.getBoundingClientRect(), cr = ct && ct.getBoundingClientRect()
        return { rowH: Math.round(rr.height), label: (lb?.innerText||'').trim(), labelLeft: lr?Math.round(lr.left):null,
                 labelW: lr?Math.round(lr.width):null, ctlLeft: cr?Math.round(cr.left):null, ctlW: cr?Math.round(cr.width):null }
      })
      const ctlLefts = [...new Set(rows.filter(r=>r.ctlLeft!=null).map(r=>r.ctlLeft))]
      const values = [...dlg.querySelectorAll('.el-select .el-select__selected-item, .el-select input')].map(e=>e.value||e.innerText||'').filter(Boolean)
      return { ok:true, dialog: { left: Math.round(drect.left), top: Math.round(drect.top),
               width: Math.round(drect.width), height: Math.round(drect.height) },
               rows, ctlLeftAligned: ctlLefts.length === 1, ctlLefts, values: values.slice(0,6) }
    })()`)
    console.log('弹窗测量: ' + JSON.stringify(metrics, null, 1))

    // 截弹窗(留 16px 边)
    const clip = await evaluate(`(() => {
      const dlg = document.querySelector('.el-overlay-dialog .el-dialog, .el-dialog')
      const r = dlg.getBoundingClientRect()
      return { x: Math.max(0, r.left - 16), y: Math.max(0, r.top - 16), width: r.width + 32, height: r.height + 32 }
    })()`)
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true })
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
    console.log('截图:', OUT)
  } finally {
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('[异常]', e); process.exit(2) })
