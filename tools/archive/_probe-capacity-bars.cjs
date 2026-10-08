/* _probe-capacity-bars.cjs — 产能对比(竖向双柱 + 周期 tab)界面验收探针
 *
 * 背景:2026-10-08 用户需求「日产能对比可以 tap 切换周/月/年,柱状图竖向排列」。
 * 这条探针**在真实浏览器里**读渲染结果,不是读源码:
 *   · 四档 tab 存在且第一档默认选中;
 *   · 柱是**竖向**的(高度由 style.height 百分比驱动,且分组列在 X 轴上并排);
 *   · 每条产线一组两根柱(实际 + 上限),轴刻度与上限折算随周期变化;
 *   · 点「周产能」后数据与区间真的换了(不是只换高亮)。
 * 用法: node tools/archive/_probe-capacity-bars.cjs [前端地址,默认 http://localhost:5173]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const API = 'http://localhost:8090'
const PORT = 9337
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT_DIR = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  // 后端可能刚重启(冷启动要几秒到几十秒)—— 登录重试,别让探针因为「没等后端」而假失败
  let login = null
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: 'admin', password: '123456' }),
      })
      const j = await r.json()
      if (j.data?.token) { login = j; break }
    } catch { /* 后端还没起来,继续等 */ }
    await sleep(2000)
  }
  if (!login) throw new Error('登录失败(等了 60s,后端未就绪?)')
  console.log(`[login] ok admin=${login.data.user.isAdmin}`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-edge-cap-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)

  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const consoleLogs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      // 收页面 console(组件里 catch 到请求失败会 console.error —— 空图时说清是「失败」还是「没数据」)
      if (m.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push((m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' '))
      }
    }
    const send = (method, params = {}) => new Promise((res) => {
      const id = ++seq
      pending.set(id, res)
      ws.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
      return r.result?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) {
        await sleep(300)
        if ((await evaluate('document.readyState')) === 'complete') { await sleep(800); return }
      }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      const p = path.join(SHOT_DIR, name)
      fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'))
      console.log(`  📷 ${p}`)
    }
    /** 轮询等条件成立(固定 sleep 会漂:切到生产 tab 时组件才挂载、才发请求) */
    const waitFor = async (expr, ms = 20000) => {
      for (let i = 0; i < Math.ceil(ms / 400); i++) {
        if (await evaluate(expr)) return true
        await sleep(400)
      }
      return false
    }

    await send('Page.enable')
    await send('Runtime.enable')

    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
localStorage.setItem('mes_login_date', '2026-10-08'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${FRONT}/#/dashboard`)
    await sleep(2500)

    // 切到「生产」模块
    await evaluate(`(() => {
      const t = [...document.querySelectorAll('.mod-tab')].find(b => b.textContent.includes('生产'))
      t?.click(); return !!t
    })()`)
    // 等**数据**到位,不是等标签:载荷带自己的 period,组件把它挂在 data-period/data-loading 上,
    // 否则「点完 tab 标签立刻变、数据还没回来」的那一瞬间会被当成结果读走
    const settled = (p) => `(() => { const e = document.querySelector('.scapbars'); return !!e && e.dataset.period === '${p}' && e.dataset.loading === '0' && e.dataset.err === '0' })()`
    const barsShown = await waitFor(`${settled('day')} && document.querySelectorAll('.cap-group').length > 0`)
    if (!barsShown) {
      console.log('  ⚠ 等了 20s 仍未出现柱组,自诊断:')
      const diag = await evaluate(`(async () => {
        const tok = localStorage.getItem('mes_token') || ''
        let out = { tokenLen: tok.length, hasUser: !!localStorage.getItem('mes_user') }
        try {
          const r = await fetch('/api/dashboard/capacity?period=day', { headers: { Authorization: 'Bearer ' + tok } })
          out.status = r.status
          out.body = (await r.text()).slice(0, 200)
        } catch (e) { out.fetchError = String(e) }
        out.emptyText = document.querySelector('.scapbars .chart-empty')?.textContent?.trim()
        out.sub = document.querySelector('.cap-sub')?.textContent?.trim()
        out.cardCount = document.querySelectorAll('.cap-head').length
        return out
      })()`)
      console.log('  [diag]', JSON.stringify(diag))
      console.log('  [console]', JSON.stringify(consoleLogs.slice(-6)))
    }

    const readState = () => evaluate(`(() => {
      const tabs = [...document.querySelectorAll('.cap-tab')].map(b => ({
        label: b.textContent.trim(), on: b.classList.contains('on'), selected: b.getAttribute('aria-selected'),
      }))
      const groups = [...document.querySelectorAll('.cap-group')].map(g => {
        const a = g.querySelector('.cap-bar.actual')
        const l = g.querySelector('.cap-bar.limit')
        return {
          name: g.querySelector('.cap-name')?.textContent?.trim(),
          actualH: a ? a.style.height : null,
          actualPx: a ? Math.round(a.getBoundingClientRect().height) : 0,
          limitH: l ? l.style.height : null,
          limitPx: l ? Math.round(l.getBoundingClientRect().height) : 0,
          tone: a ? [...a.classList].find(c => c.startsWith('tone-')) : null,
          num: g.querySelector('.bar-num')?.textContent?.trim(),
          title: g.getAttribute('title'),
        }
      })
      const gRect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) } }
      const plot = document.querySelector('.cap-plot')
      const gEls = [...document.querySelectorAll('.cap-group')]
      return {
        tabs,
        groups,
        sub: document.querySelector('.cap-sub')?.textContent?.trim(),
        ticks: [...document.querySelectorAll('.grid-num')].map(e => e.textContent.trim()),
        plot: plot ? gRect(plot) : null,
        // 竖向判定:组与组沿 X 轴横向排开(第一个与第二个的 x 不同、y 相同)
        groupBoxes: gEls.slice(0, 3).map(gRect),
        empty: !!document.querySelector('.scapbars .chart-empty'),
      }
    })()`)

    const day = await readState()
    console.log('\n[日产能]')
    check('四档 tab 齐全', day.tabs.map(t => t.label).join('/') === '日产能/周产能/月产能/年产能', day.tabs.map(t => t.label).join('/'))
    check('默认选中第一档(日产能)', day.tabs[0]?.on === true && day.tabs[0]?.selected === 'true')
    check('有柱组渲染', day.groups.length > 0, `${day.groups.length} 组`)
    check('每组两根柱(实际 + 上限)', day.groups.every(g => g.actualH !== null && g.limitH !== null))
    check('柱高按百分比驱动(不等于全程高度)', day.groups.some(g => g.actualH !== null && g.actualH !== ''), day.groups[0]?.actualH)
    check('组沿 X 轴并排 = 竖向柱', day.groupBoxes.length >= 2 && day.groupBoxes[1].x > day.groupBoxes[0].x && day.groupBoxes[0].h > 0,
      day.groupBoxes.map(b => `x=${b.x},h=${b.h}`).join(' | '))
    check('纵轴刻度 5 档', day.ticks.length === 5, day.ticks.join('/'))
    check('区间与上限口径有标注', !!day.sub && day.sub.includes('×'), day.sub)
    console.log('  rows:', JSON.stringify(day.groups.slice(0, 3)))

    // 视觉闭环的**可测量替代**(本机未配 vision key,人眼看不了 —— 改量几何):
    // 柱不越出画布、柱顶数值不互相重叠、产线名不溢出、页面无横向滚动、卡片不裁切
    const layout = await evaluate(`(() => {
      const plot = document.querySelector('.cap-plot'); const pr = plot.getBoundingClientRect()
      const bars = [...document.querySelectorAll('.cap-bar')]
      let overflowTop = 0, overflowSide = 0
      for (const b of bars) {
        const r = b.getBoundingClientRect()
        if (r.top < pr.top - 1) overflowTop++
        if (r.left < pr.left - 1 || r.right > pr.right + 1) overflowSide++
      }
      const nums = [...document.querySelectorAll('.bar-num')].map(e => e.getBoundingClientRect())
      let numOverlap = 0
      for (let i = 1; i < nums.length; i++) if (nums[i].left < nums[i-1].right - 0.5) numOverlap++
      const names = [...document.querySelectorAll('.cap-name')].map(e => ({ t: e.textContent.trim(), w: e.scrollWidth, c: Math.round(e.clientWidth) }))
      const clippedNames = names.filter(n => n.w > n.c + 1).length
      const doc = document.documentElement
      const card = document.querySelector('.cap-plot').closest('.card')
      return {
        bars: bars.length, overflowTop, overflowSide, numOverlap, clippedNames,
        hScroll: doc.scrollWidth - doc.clientWidth,
        cardClipped: card ? card.scrollHeight - card.clientHeight : 0,
        plotH: Math.round(pr.height), plotW: Math.round(pr.width),
      }
    })()`)
    console.log('  [layout]', JSON.stringify(layout))
    check('柱不越出画布', layout.overflowTop === 0 && layout.overflowSide === 0, `top=${layout.overflowTop} side=${layout.overflowSide}`)
    check('柱顶数值互不重叠', layout.numOverlap === 0, `重叠 ${layout.numOverlap} 处`)
    check('产线名未被截断', layout.clippedNames === 0, `截断 ${layout.clippedNames} 个`)
    check('页面无横向滚动', layout.hScroll <= 1, `scrollWidth-clientWidth=${layout.hScroll}`)
    check('卡片内容未被裁切', layout.cardClipped <= 1, `scrollHeight-clientHeight=${layout.cardClipped}`)
    await shot('capacity-bars-day.png')

    // 切周产能
    await evaluate(`(() => {
      const t = [...document.querySelectorAll('.cap-tab')].find(b => b.textContent.includes('周产能'))
      t?.click(); return !!t
    })()`)
    await waitFor(settled('week'))
    const week = await readState()
    console.log('\n[周产能]')
    check('周档被选中', week.tabs.find(t => t.label === '周产能')?.on === true)
    check('上限折算随周期变化(周 = 日 × 7)', week.sub !== day.sub, `${day.sub} → ${week.sub}`)
    check('仍为竖向双柱', week.groups.length > 0 && week.groups.every(g => g.limitH !== null))
    check('刻度随数据放大', week.ticks.join('/') !== day.ticks.join('/'), `${day.ticks.join('/')} → ${week.ticks.join('/')}`)
    await shot('capacity-bars-week.png')

    // 年产能 也点一次,确认四档都能取到数(不报错/不空)
    await evaluate(`(() => {
      const t = [...document.querySelectorAll('.cap-tab')].find(b => b.textContent.includes('年产能'))
      t?.click(); return !!t
    })()`)
    await waitFor(settled('year'))
    const year = await readState()
    console.log('\n[年产能]')
    check('年档有数据(非空态)', year.empty === false && year.groups.length > 0, `${year.groups.length} 组`)
    check('年档上限标注为 × 365', year.sub.includes('365'), year.sub)

    ws.close()
  } finally {
    edge.kill()
  }
  console.log(`\n结果: pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
