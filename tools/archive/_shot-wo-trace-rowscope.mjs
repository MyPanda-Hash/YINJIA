/*
 * _shot-wo-trace-rowscope.mjs — 工单追溯行级口径「看效果」取证(2026-10-15,一次性)
 *
 * 用 CDP 打开生产工单页 → 对行7(工单行)点追溯 → 截「口径说明 + 分段胶囊 + 入库段(批次号/工单行号/收敛口径)」。
 * 断言(在页面上直接读 DOM,不依赖后端返回值):
 *   ① 弹窗里出现「追溯口径:按工单行」与行号/批次胶囊;
 *   ② 每段标题旁有口径胶囊(按工单行 / 整单);
 *   ③ 入库段表头含 批次号 / 工单行号 / 收敛口径 三列。
 * ⚠ 只读:不点任何写操作按钮。
 * 用法: node tools/archive/_shot-wo-trace-rowscope.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../tools/node_modules/ws/index.js'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9346
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = 'tools/archive/_shot-wo-trace-rowscope.png'

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shot-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1200',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1200); return } } }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${BASE}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale', 'zh-CN');
    localStorage.setItem('mes_init_done', '1'); 'ok'`)
  await navigate('about:blank')
  await navigate(`${BASE}/#/prod/plan/workOrderList`)
  await sleep(6000)

  // 关掉可能弹出的「MES 初始化配置」向导(否则挡住整页;只关,不点任何配置)
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button, .el-dialog__headerbtn')]
    const skip = btns.find(b => (b.innerText||'').trim() === '下次再说')
    if (skip) { skip.click(); return 'skipped' }
    const x = document.querySelector('.el-dialog__headerbtn')
    if (x) { x.click(); return 'closed' }
    return 'none'
  })()`)
  await sleep(1500)

  // 找到工单 GD-2026-10-0002 的**行7**那一行,点行上的工单号链接(= openTrace(row),会带上 行id)
  const clicked = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.el-table__body tr')]
    const target = rows.find(tr => {
      const tds = [...tr.querySelectorAll('td')].map(td => (td.innerText||'').trim())
      // 列序:选择框 / 公司代码 / 工单号 / 工单行号 / ...
      return tds.includes('GD-2026-10-0002') && tds.includes('7')
    })
    if (!target) return 'no-row:' + rows.length
    const link = target.querySelector('a, .el-link')
    if (link) { link.click(); return 'clicked-link' }
    target.click(); return 'clicked-row'
  })()`)
  console.log('行7 选择:', clicked)
  await sleep(6000)

  const info = await evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog__body')
    if (!dlg) return { err: 'no-dialog' }
    const scopeLine = (dlg.querySelector('.wb-trace-scope-line')||{}).innerText || ''
    const head = (dlg.querySelector('.wb-trace-head')||{}).innerText || ''
    const caps = [...dlg.querySelectorAll('.wb-scope-cap')].map(c => c.innerText.trim())
    const titles = [...dlg.querySelectorAll('.wb-block-title')].map(t => t.innerText.trim().replace(/\\s+/g,' '))
    // 入库段表头
    const blocks = [...dlg.querySelectorAll('.wb-trace-block')]
    const finBlock = blocks.find(b => (b.querySelector('.wb-block-title')||{}).innerText?.includes('完工数据'))
    const finHead = finBlock ? [...finBlock.querySelectorAll('.el-table__header th')].map(th=>th.innerText.trim()) : []
    return { head, scopeLine, caps, titles, finHead }
  })()`)
  console.log('\n== 弹窗头部 ==\n' + (info.head || '').replace(/\n/g, ' | '))
  console.log('\n== 口径说明 ==\n' + info.scopeLine)
  console.log('\n== 分段胶囊 ==\n' + JSON.stringify(info.caps))
  console.log('\n== 段标题 ==\n' + JSON.stringify(info.titles))
  console.log('\n== 完工/入库段表头 ==\n' + JSON.stringify(info.finHead))

  // 滚到入库段截图
  await evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog__body')
    const blocks = [...dlg.querySelectorAll('.wb-trace-block')]
    const finBlock = blocks.find(b => (b.querySelector('.wb-block-title')||{}).innerText?.includes('完工数据'))
    if (finBlock) finBlock.scrollIntoView({ block: 'start' })
    return 'ok'
  })()`)
  await sleep(1200)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  if (shot.result?.data) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
    console.log(`\n截图: ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`)
  } else { console.log('截图失败:', JSON.stringify(shot).slice(0, 200)) }

  const okCaps = (info.caps || []).includes('按工单行') && (info.caps || []).includes('整单')
  const okFin = (info.finHead || []).includes('批次号') && (info.finHead || []).includes('工单行号') && (info.finHead || []).includes('收敛口径')
  const okScope = String(info.scopeLine || '').includes('按工单行')
  console.log(`\n[结果] 口径说明按工单行=${okScope} 分段胶囊齐=${okCaps} 入库段三列齐=${okFin}`)
  ws.close()
  process.exit(okScope && okCaps && okFin ? 0 : 1)
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
