/**
 * _shot-docentry.mjs — 桌面「单据入口」卡片活体验证(2026-10-18)
 *
 * 做三件事:
 *   1) 真实登录本地实例 → 打开 /#/dashboard → 抓 1440/768/375 三档截图(看布局与换行);
 *   2) 逐张卡片 dump 文案(面板数 / 单据行),核对「最近 7 张单据」是否渲染;
 *   3) 点第一张单据,确认跳转到对应单据面板(路由带 panelCode + docNo 参数)。
 *
 * 用法(仓库根):
 *   node tools/archive/_module-docs-20261018/_shot-docentry.mjs
 *   node tools/archive/_module-docs-20261018/_shot-docentry.mjs http://127.0.0.1:8091
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9423
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const ADMIN = { userName: 'admin', password: '123456', factory: 'YINJIA-MES' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-docentry-'))
  spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)
  let cdp = null
  try {
    // 记录接口真实状态:卡片显示「暂无单据」也可能是 401/500 被静默吃掉,不采集就无法区分
    const netLog = []
    cdp = await attachCdp(PORT, undefined, (m) => {
      if (m.method === 'Network.responseReceived' && /module-docs/.test(m.params.response.url)) {
        netLog.push(m.params.response.status + ' ' + m.params.response.url.replace(/^https?:\/\/[^/]+/, ''))
      }
      if (m.method === 'Network.loadingFailed' && m.params.errorText) netLog.push('FAIL ' + m.params.errorText + ' ' + (m.params.requestId || ''))
    })
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Network.enable')
    const ev = cdp.ev
    const waitFor = async (expr, ms = 25000) => {
      for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) }
      return false
    }
    const shot = async (name, w, h) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
      await sleep(900)
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const f = path.join(OUT, name + '.png')
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      console.log('   截图', path.basename(f))
      return f
    }

    const shotEl = async (sel, name, w, h) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
      await sleep(600)
      await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'center' }); return 1 })()`)
      await sleep(500)
      const raw = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'null'; const r = e.getBoundingClientRect(); return JSON.stringify({ x: r.left, y: r.top + window.scrollY, width: r.width, height: r.height }) })()`)
      if (!raw || raw === 'null') return null
      const rect = JSON.parse(raw)
      const r2 = await cdp.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, fromSurface: true,
        clip: { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height, scale: 1 },
      })
      const f2 = path.join(OUT, name + '.png')
      fs.writeFileSync(f2, Buffer.from(r2.result.data, 'base64'))
      console.log('   截图', path.basename(f2), Math.round(rect.width) + 'x' + Math.round(rect.height))
      return f2
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
    await waitFor(`document.querySelectorAll('.login-form input').length >= 2`, 25000)
    await ev(`(() => {
      const ins = [...document.querySelectorAll('.login-form input')]
      const set = (el, v) => {
        el.focus(); el.value = v
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      set(ins[0], ${JSON.stringify(ADMIN.userName)}); set(ins[1], ${JSON.stringify(ADMIN.password)})
      return ins.length
    })()`)
    await ev(`(() => { const s = document.querySelector('.login-form .el-select'); if (!s) return 'no-select'; s.click(); return 'opened' })()`)
    await sleep(700)
    await ev(`(() => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.offsetParent)
      const t = items.find((i) => i.textContent.trim() === ${JSON.stringify(ADMIN.factory)})
      if (!t) return 'not-found'
      t.click(); return t.textContent.trim()
    })()`)
    await sleep(500)
    await ev(`(() => { const b = document.querySelector('.login-submit'); if (b) b.click(); return 1 })()`)
    const ok = await waitFor(`location.hash.indexOf('/login') < 0`, 30000)
    console.log('[login]', ok ? 'OK' : 'FAIL 仍在登录页')
    if (!ok) process.exit(1)

    await ev(`(location.hash = '#/dashboard', 'ok')`)
    await waitFor(`document.querySelectorAll('.mod-tab').length > 0`, 25000)
    await sleep(1500)

    // 桌面是 tab 切换渲染,默认只挂「概览」那一支 —— 必须逐模块点 tab 才能看到各模块的 .doc-entry
    const MODULES = [
      { key: 'prod', tab: '生产', expect: true, empty: true },   // 生产制造 13 张单据头表全空 ⇒ 正确表现是「暂无单据」
      { key: 'stock', tab: '库存', expect: true },
      { key: 'sales', tab: '销售', expect: true },
      { key: 'quality', tab: '质量', expect: true },
      // 研发页(2026-10-18 补):原「最新单据」卡换成本模块单据入口(compact 单列),与其它四模块同一口径
      { key: 'rd', tab: '研发管理', expect: true, empty: false },
    ]
    const results = []
    for (const m2 of MODULES) {
      const clicked = await ev(`(() => {
        const tabs = [...document.querySelectorAll('.mod-tab')]
        const t = tabs.find((b) => b.textContent.replace(/\s+/g, '').indexOf(${JSON.stringify(m2.tab)}) >= 0)
        if (!t) return 'no-tab'
        t.click(); return 'ok'
      })()`)
      if (clicked !== 'ok') { console.log('[tab]', m2.key, clicked); results.push({ m: m2, ok: false }); continue }
      const t0 = Date.now()
      const settled = await waitFor(`(() => {
        const c = document.querySelector('.doc-entry'); if (!c) return false
        if (c.querySelector('.doc-item')) return true
        const e = c.querySelector('.doc-empty')
        return !!e && e.textContent.indexOf('暂无单据') >= 0
      })()`, 25000)
      console.log('    加载耗时 ' + (Date.now() - t0) + 'ms settled=' + settled)
      const cardsRaw = await ev(`JSON.stringify([...document.querySelectorAll('.doc-entry')].map((c) => ({
        title: (c.querySelector('h3') || {}).textContent || '',
        sub: (c.querySelector('.doc-sub') || {}).textContent || '',
        count: (c.querySelector('.doc-count') || {}).textContent || '',
        rows: [...c.querySelectorAll('.doc-item')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
        empty: (c.querySelector('.doc-empty') || {}).textContent || '',
        width: Math.round(c.getBoundingClientRect().width),
        overflow: c.scrollWidth > c.clientWidth + 1,
      })))`)
      const cards = JSON.parse(cardsRaw || '[]')
      const rows = cards.reduce((n, c) => n + c.rows.length, 0)
      const has = cards.length > 0
      console.log('[' + m2.key + '] cards=' + cards.length + ' rows=' + rows + ' ' +
        (cards[0] ? (cards[0].title.trim() + ' / ' + cards[0].sub.trim() + ' / ' + cards[0].count.trim()) : '(无卡片)') +
        (cards[0] && cards[0].empty ? ' 空态=' + cards[0].empty.trim() : ''))
      if (cards[0] && cards[0].rows.length) console.log('    前 2 行: ' + JSON.stringify(cards[0].rows.slice(0, 2)))
      await ev(`(() => { const c = document.querySelector('.doc-entry'); if (c) c.scrollIntoView({ block: 'center' }); return 1 })()`)
      await shot('docentry-' + m2.key + '-1440', 1440, 1000)
      await shotEl('.doc-entry', 'card-' + m2.key + '-1440', 1440, 1000)
      // 768(平板)也过一遍:研发页栅格 2026-10-18 由写死 3 栏改为随屏宽收栏,这里留证据
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1000, deviceScaleFactor: 1, mobile: false })
      await sleep(700)
      await ev(`(() => { const c = document.querySelector('.doc-entry'); if (c) c.scrollIntoView({ block: 'center' }); return 1 })()`)
      await sleep(400)
      await shot('docentry-' + m2.key + '-768', 768, 1000)
      const of768 = await ev(`(() => {
        const c = document.querySelector('.doc-entry'); const de = document.documentElement
        return { card: c ? c.scrollWidth > c.clientWidth + 1 : null, s: de.scrollWidth, cw: de.clientWidth }
      })()`)
      console.log('    [768] ' + JSON.stringify(of768))
      await shot('docentry-' + m2.key + '-375', 375, 1400)
      await shotEl('.doc-entry', 'card-' + m2.key + '-375', 375, 1400)
      const of375 = await ev(`(() => {
        const c = document.querySelector('.doc-entry'); const de = document.documentElement
        return { card: c ? c.scrollWidth > c.clientWidth + 1 : null, s: de.scrollWidth, cw: de.clientWidth }
      })()`)
      if (of375 && of375.s > of375.cw + 1) {
        console.log('    超宽元素: ' + await ev(`JSON.stringify([...document.querySelectorAll('body *')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 })
          .slice(0, 6).map((e) => e.tagName.toLowerCase() + '.' + (e.className || '').toString().split(' ').slice(0, 2).join('.') + '@' + Math.round(e.getBoundingClientRect().right)))`))
      }
      console.log('    [375] ' + JSON.stringify(of375))
      const okRow = m2.empty ? (has && rows === 0) : (has && rows > 0)
      results.push({ m: m2, ok: m2.expect ? okRow : !has, cards, rows, of375, of768 })
    }

    // ── 可选面板筛选(2026-10-18 用户口径):库存卡选「销售出库单」→ 请求带 panel=SALE_OUT、
    //    列表只剩该面板、面板总数不变。默认列表恰好全是「其他出库单」,故选一张不同的面板才验得出筛选生效。
    //    ⚠ Element Plus 2.x 的点开热区是 .el-select__wrapper(点根节点 .doc-filter 不展开);
    //      下拉项在 teleport 到 body 的 popper 里,offsetParent 为 null,不能拿它筛可见项。
    await ev(`(location.hash = '#/dashboard', 'ok')`)
    await waitFor(`document.querySelectorAll('.mod-tab').length > 0`, 15000)
    await sleep(700)
    await ev(`(() => { const tabs = [...document.querySelectorAll('.mod-tab')]
      const t = tabs.find((b) => b.textContent.replace(/\\s+/g, '').indexOf('库存') >= 0)
      if (t) t.click(); return 1 })()`)
    await waitFor(`document.querySelectorAll('.doc-entry .doc-item').length > 0`, 12000)
    await sleep(400)
    const countBefore = await ev(`(() => { const c = document.querySelector('.doc-entry'); const n = c && c.querySelector('.doc-count'); return n ? n.textContent.trim() : '' })()`)
    await ev(`(() => { const c = document.querySelector('.doc-entry'); if (c) c.scrollIntoView({ block: 'center' })
      const w = document.querySelector('.doc-entry .doc-filter .el-select__wrapper') || document.querySelector('.doc-entry .doc-filter')
      if (!w) return 'no-select'; w.click(); return 'ok' })()`)
    await sleep(700)
    const pickLabel = await ev(`(() => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')]
        .filter((e) => e.getBoundingClientRect().width > 0)
      const t = items.find((e) => e.textContent.trim() === '销售出库单')
      if (!t) return 'not-found:' + items.map((e) => e.textContent.trim()).join('|')
      t.click(); return t.textContent.trim()
    })()`)
    console.log('[panel] 选择面板=' + pickLabel)
    let panelUrl = ''
    for (let i = 0; i < 40; i++) {
      panelUrl = netLog.filter((x) => x.indexOf('panel=') >= 0).slice(-1)[0] || ''
      if (/panel=SALE_OUT/.test(panelUrl)) break
      await sleep(250)
    }
    await sleep(1200)
    const ap = JSON.parse(await ev(`JSON.stringify({
      rows: [...document.querySelectorAll('.doc-entry .doc-item')].length,
      badges: [...new Set([...document.querySelectorAll('.doc-entry .doc-badge')].map((e) => e.textContent.trim()))],
      count: (document.querySelector('.doc-entry .doc-count') || {}).textContent || ''
    })`) || '{}')
    const panelOk = !!panelUrl && /panel=SALE_OUT/.test(panelUrl) &&
      ap.rows > 0 && ap.rows <= 7 &&
      (ap.badges || []).length === 1 && ap.badges[0] === '销售出库单' &&
      String(ap.count).trim() === String(countBefore).trim()
    console.log('[panel] ' + (panelUrl || '(无请求)') + ' rows=' + ap.rows +
      ' badges=' + JSON.stringify(ap.badges) + ' count=' + ap.count + (panelOk ? '' : '  ← FAIL'))
    await shot('docentry-panel-filter', 1440, 1000)

    // 点击验证(2026-10-18 补):五个模块逐个点第一张单据 → 必须跳到 /panelx/list/<panelCode>
    // 生产当前无单据 ⇒ 该模块记录 skipped(空态由上面的 empty 断言覆盖),不算失败。
    const clickResults = []
    for (const m2 of MODULES) {
      await ev(`(location.hash = '#/dashboard', 'ok')`)
      await waitFor(`document.querySelectorAll('.mod-tab').length > 0`, 15000)
      await sleep(700)
      await ev(`(() => { const tabs = [...document.querySelectorAll('.mod-tab')]
        const t = tabs.find((b) => b.textContent.replace(/\\s+/g, '').indexOf(${JSON.stringify(m2.tab)}) >= 0)
        if (t) t.click(); return 1 })()`)
      const hasRow = await waitFor(`document.querySelectorAll('.doc-entry .doc-item').length > 0`, 12000)
      if (!hasRow) {
        console.log('[click] ' + m2.key + ' 无单据行 ⇒ skipped')
        clickResults.push({ key: m2.key, ok: m2.empty === true, skipped: true })
        continue
      }
      await sleep(400)
      const before = await ev('location.hash')
      const firstNo = await ev(`(() => { const b = document.querySelector('.doc-entry .doc-item'); return b ? b.textContent.replace(/\\s+/g, ' ').trim() : '' })()`)
      await ev(`(() => { const b = document.querySelector('.doc-entry .doc-item'); if (!b) return 0; b.click(); return 1 })()`)
      const routed = await waitFor(`location.hash.indexOf('/panelx/list/') >= 0`, 9000)
      await sleep(1600)
      const after = await ev('location.hash')
      const ok = routed && after !== before
      console.log('[click] ' + m2.key + ' 「' + firstNo.split('›')[0].trim() + '」 → ' + after + (ok ? '' : '  ← FAIL'))
      await shot('docentry-click-' + m2.key, 1440, 1000)
      clickResults.push({ key: m2.key, ok })
    }
    const clickedOk = clickResults.filter((r) => !r.skipped).every((r) => r.ok)

    console.log('[net] ' + JSON.stringify(netLog))
    const bad = results.filter((r) => !r.ok)
    console.log('[summary] ' + results.map((r) => r.m.key + '=' + (r.ok ? 'OK' : 'FAIL')).join(' ') +
      ' click=' + (clickedOk ? 'OK' : 'FAIL'))
    const pass = bad.length === 0 && clickedOk && panelOk &&
      !results.some((r) => (r.of375 && r.of375.card) || (r.of768 && r.of768.card))
    console.log(pass ? '[PASS] 五模块单据入口渲染 + 可选面板筛选 + 最近 7 张单据 + 点击跳转 + 卡片无横向溢出' : '[FAIL] 见上面各项')
  } finally {
    try { cdp && cdp.close() } catch { /* ignore */ }
    try { cdp && cdp.close() } catch { /* ignore */ }
    spawn('taskkill', ['/F', '/T', '/FI', 'WINDOWTITLE eq about:blank'], { stdio: 'ignore' })
  }
}
main().catch((e) => { console.error('[ERROR]', e); process.exit(1) })