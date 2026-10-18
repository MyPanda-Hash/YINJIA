/* 一次性探针(2026-10-18):核对左侧菜单栏改版是否真的生效 ——
 *   ① 智能供应链 只剩 销售管理 / 采购管理;
 *   ② 「库存管理」与「智能供应链」同级(一级目录,紧随其后),下含 库存核算/库存明细/库存统计/库存报表;
 *   ③ 「基础档案」已改名为「系统管理平台」。
 * 做法 = CDP 打开真实页面,读左栏 nav-group 顺序 + 逐个点开二级项读悬浮卡片(card-group 标题/条目)。
 * 用法:node tools/archive/_menu-inventory-split-20261018/_v-leftnav.cjs [前端地址,默认 5173]
 * 依赖:Edge 无头 + 账号 admin/123456(与 _probe-qc-insp-carry/_q-menu-entry.cjs 同款)。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9381
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const API = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = path.join(__dirname, '_leftnav-shot.png')

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!login?.data?.token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 300))
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-nav-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tabInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(1800); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    // 先在应用同源下写 localStorage(直接开 #/login 时可能还没到就跑脚本 ⇒ 之前空白页的成因)
    await nav(`${APP}/#/login`)
    await sleep(1500)
    const stored = await raw(`(() => {
      localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
      return localStorage.getItem('mes_token') ? 'ok' : 'missing'
    })()`)
    console.log('令牌写入:', stored)
    await nav('about:blank')
    await nav(`${APP}/#/dashboard`)
    await sleep(5000)
    console.log('落地页:', await raw('location.href'))
    const body = await raw(`document.body.innerText.replace(/\\s+/g,' ').slice(0, 200)`)
    console.log('页面文本:', body)

    // 一级目录顺序(左栏 nav-group)
    const groups = await raw(`[...document.querySelectorAll('.leftnav .nav-group')].map(e => e.innerText.trim())`)
    console.log('一级目录:', JSON.stringify(groups))

    // 点开分组 → 二级项 → 悬浮卡片内容
    async function open(groupTitle) {
      await raw(`(() => { const el = [...document.querySelectorAll('.leftnav .nav-group')].find(e => e.innerText.trim() === ${JSON.stringify(groupTitle)}); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!el })()`)
      await sleep(700)
      const mods = await raw(`[...document.querySelectorAll('.leftnav .nav-module')].map(e => e.innerText.trim())`)
      const cards = []
      for (const m of mods) {
        await raw(`(() => { const el = [...document.querySelectorAll('.leftnav .nav-module')].find(e => e.innerText.trim() === ${JSON.stringify(m)}); el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return !!el })()`)
        await sleep(450)
        const cols = await raw(`[...document.querySelectorAll('.fly-card .card-group')].map(g => ({ title: g.querySelector('.card-group-title')?.innerText.trim(), items: [...g.querySelectorAll('.card-item')].map(i => i.innerText.trim()) }))`)
        cards.push({ module: m, cols: cols || [] })
      }
      await raw(`(() => { const el = [...document.querySelectorAll('.leftnav .nav-group')].find(e => e.innerText.trim() === ${JSON.stringify(groupTitle)}); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!el })()`)
      await sleep(300)
      return { mods, cards }
    }

    for (const g of ['库存管理', '智能供应链', '系统管理平台']) {
      const r = await open(g)
      console.log(`\n== ${g} ==`)
      console.log('  二级:', JSON.stringify(r.mods))
      for (const c of r.cards) console.log(`  · ${c.module}: ` + c.cols.map((x) => `${x.title}[${x.items.length}] ${x.items.slice(0, 4).join(',')}${x.items.length > 4 ? '…' : ''}`).join(' | '))
    }

    // 截图留存(左栏 + 悬浮卡片)
    await raw(`(() => { const el = [...document.querySelectorAll('.leftnav .nav-group')].find(e => e.innerText.trim() === '库存管理'); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!el })()`)
    await sleep(500)
    await raw(`(() => { const el = [...document.querySelectorAll('.leftnav .nav-module')].find(e => e.innerText.trim() === '库存核算'); el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return !!el })()`)
    await sleep(900)
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 900, height: 640, scale: 1 } })
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
    console.log('\n截图:', OUT)
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
