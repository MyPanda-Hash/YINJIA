/**
 * i18n-verify.cjs — 工序流程追踪卡 多语言**动态走查**(en / ja,真实 8090 页面)
 *
 * 用法: node tools/archive/_proc-card-verify/i18n-verify.cjs
 * 前置: 8090 新 jar;卡片 LZK-GD-2026-10-0223-1 存在(api-smoke 建)
 *
 * 口径(AGENTS ADR-0001):
 *   · 显示层文案(页签/列头/按钮/空态/提示/占位符/页面标题/菜单名)必须为目标语言;
 *   · 数据键(批次号/卡号/产品编码/产品名称/规格/工序名/报工人/文件名)保持原样 —— 是**正确行为**;
 *   · 判定:en 模式下仍含 CJK 的「UI 文案」= 残留;ja 模式下与 zh-CN 逐项完全相同 = 未翻译。
 *
 * 产物: i18n-result.json、shots/i18n-{en,ja}-*.png
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const PORT = 9348
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = __dirname
const SHOTS = path.join(HERE, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CJK = /[\u4e00-\u9fff]/

/** 采集"UI 文案"用的选择器:只取显示层(不取表格数据行/卡号/产品名等事实数据) */
const CAPTURE_JS = `(() => {
  const vis = (e) => e && e.offsetParent !== null
  const txt = (arr) => [...arr].map((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)
  const q = (sel) => [...document.querySelectorAll(sel)].filter(vis)
  const activePane = () => [...document.querySelectorAll('.el-tab-pane')].find((p) => vis(p))
  const out = {}
  out.title = document.title
  out.workspaceTab = txt(q('.tabsbar .tab')).slice(0, 6)
  out.menuGroup = txt(q('.leftnav .nav-group')).slice(0, 4)
  out.menuLeaf = txt(q('.leftnav .nav-module')).filter((t) => !/^订单结转|生产工单|快速排产|工单排产|生产领料|工序报工|产线排产负荷/.test(t) || true).slice(0, 12)
  out.tabs = txt(q('.pfc-tabs .el-tabs__item'))
  out.barLabels = txt(q('.pfc-bar .pfc-lb'))
  out.barButtons = txt(q('.pfc-bar .el-button'))
  out.placeholders = q('.pfc input, .pfc textarea').map((e) => e.getAttribute('placeholder')).filter(Boolean)
  out.emptyTexts = txt(q('.pfc-empty'))
  out.sectionTitles = txt(q('.pfc-sec-title'))
  out.statLabels = txt(q('.pfc-stat span'))
  out.paneTableHeaders = txt((activePane() || document).querySelectorAll('.el-table__header th')).filter(Boolean)
  out.cardLabels = txt(q('.pfe-kv span'))
  out.cardButtons = txt(q('.pfe-foot .el-button'))
  out.opLabels = txt(q('.pfe-op-nums span')).map((t) => t.replace(/[\\d.,\\-\\s]+$/g, '').trim())
  out.opNoteLabel = txt(q('.pfe-note-label'))
  out.photosHint = txt(q('.pfp-hint'))
  const drawer = [...document.querySelectorAll('.el-drawer')].filter(vis)[0]
  if (drawer) {
    out.drawerTitle = txt(drawer.querySelectorAll('.el-drawer__header, .el-drawer__title')).slice(0, 2)
    out.drawerSections = txt(drawer.querySelectorAll('.pft-sec-title'))
    out.drawerLabels = txt(drawer.querySelectorAll('.pft-kv span, .pft-op-meta span, .pft-empty'))
    out.drawerButtons = txt(drawer.querySelectorAll('.el-button'))
    out.drawerTableHeaders = txt(drawer.querySelectorAll('.el-table__header th')).filter(Boolean).slice(0, 30)
  }
  return out
})()`

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pfc-i18n-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let ws
  const result = { locales: {}, errors: [] }
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') result.errors.push(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text)
      if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') result.errors.push((m.params.args || []).map((a) => a.value ?? a.description).join(' '))
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) {
        console.log('  [eval-error] ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text || '').slice(0, 300))
        return undefined
      }
      return r.result?.result?.value
    }
    const nav = async (url, wait = 2000) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break }
      await sleep(wait)
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
      fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64'))
      return name
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('DOM.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    const pickBatch = async (kw) => {
      await ev(`(() => { const w=[...document.querySelectorAll('.pfc-batch .el-select__wrapper')].find(e=>e.offsetParent!==null); w?.click(); return !!w })()`)
      await sleep(700)
      await ev(`(() => {
        const inp=[...document.querySelectorAll('.el-select-dropdown input')].find(e=>e.offsetParent!==null)
        if(!inp) return 'no'
        const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
        s.call(inp, ${JSON.stringify(kw)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
      })()`)
      await sleep(700)
      await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent!==null).find(e=>e.textContent.trim().startsWith(${JSON.stringify(kw)})); it?.click(); return !!it })()`)
      await sleep(2000)
    }

    for (const locale of ['zh-CN', 'en', 'ja']) {
      console.log(`\n=== locale ${locale} ===`)
      await nav(BASE + '/#/login', 800)
      await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_locale', ${JSON.stringify(locale)});
localStorage.setItem('mes_login_date', '2026-08-29'); 'ok'`)
      await nav('about:blank', 200)
      await nav(BASE + '/#/prod/plan/procFlowCard', 3000)
      for (let i = 0; i < 25 && !(await ev(`!!document.querySelector('.pfc-list .el-table__row')`)); i++) await sleep(400)
      const snap = { initial: await ev(CAPTURE_JS) }
      await shot(`i18n-${locale}-entry.png`)
      // 选批次 20261019 → 点行 → 卡面
      await pickBatch('20261019')
      await ev(`(() => { const r=[...document.querySelectorAll('.pfc-list .el-table__row')].find(e=>e.textContent.includes('GD-2026-10-0223')); r?.click(); return !!r })()`)
      await sleep(2000)
      snap.card = await ev(CAPTURE_JS)
      await shot(`i18n-${locale}-card.png`)
      // 列表页签(按索引切,避免依赖文案)
      await ev(`(() => { const t=[...document.querySelectorAll('.pfc-tabs .el-tabs__item')][1]; t?.click(); return !!t })()`)
      await sleep(2500)
      snap.list = await ev(CAPTURE_JS)
      await shot(`i18n-${locale}-list.png`)
      // 批次追溯页签 + 点卡开抽屉
      await ev(`(() => { const t=[...document.querySelectorAll('.pfc-tabs .el-tabs__item')][2]; t?.click(); return !!t })()`)
      await sleep(3000)
      snap.trace = await ev(CAPTURE_JS)
      await ev(`(() => { const r=[...document.querySelectorAll('.el-tab-pane')].find(p=>p.offsetParent!==null)?.querySelectorAll('.el-table__row'); const row=r?[...r].find(e=>/LZK-/.test(e.textContent)):null; row?.click(); return !!row })()`)
      await sleep(3000)
      snap.drawer = await ev(CAPTURE_JS)
      await shot(`i18n-${locale}-drawer.png`)
      // 工单追溯 展开(取按钮文案)
      await ev(`(() => { const b=[...document.querySelectorAll('.pft-sec-title .el-button')][0]; b?.click(); return !!b })()`)
      await sleep(1200)
      snap.drawerExpanded = await ev(CAPTURE_JS)
      result.locales[locale] = snap
      await ev(`(() => { document.querySelectorAll('.el-overlay').forEach(e=>e.remove()); return 'ok' })()`)
    }

    // ── 判定 ──
    const zh = result.locales['zh-CN']
    const flat = (snap) => {
      const out = {}
      for (const [phase, obj] of Object.entries(snap || {})) {
        for (const [k, v] of Object.entries(obj || {})) {
          if (Array.isArray(v)) v.forEach((s, i) => { if (s) out[`${phase}.${k}[${i}]`] = s })
          else if (v) out[`${phase}.${k}`] = v
        }
      }
      return out
    }
    const flatZh = flat(zh)
    const verdict = { en: { residualChinese: [], pass: 0, fail: 0 }, ja: { sameAsZh: [], pass: 0, fail: 0 } }
    for (const locale of ['en', 'ja']) {
      const f = flat(result.locales[locale])
      for (const [k, v] of Object.entries(f)) {
        const isUiText = !!v && typeof v === 'string'
        if (!isUiText) continue
        if (locale === 'en') {
          if (CJK.test(v)) { verdict.en.residualChinese.push({ key: k, text: v }); verdict.en.fail++ } else verdict.en.pass++
        } else {
          const zhv = flatZh[k]
          if (zhv && zhv === v && CJK.test(v)) { verdict.ja.sameAsZh.push({ key: k, zh: zhv, ja: v }); verdict.ja.fail++ } else verdict.ja.pass++
        }
      }
    }
    result.verdict = verdict
    console.log('\n=== en:仍含中文的 UI 文案 ===')
    console.log(JSON.stringify(verdict.en.residualChinese, null, 1))
    console.log('\n=== ja:与 zh-CN 完全相同的 UI 文案(疑似未翻译)===')
    console.log(JSON.stringify(verdict.ja.sameAsZh, null, 1))
    console.log(`\n[en] 非中文 UI 文案 ${verdict.en.pass} 条 / 中文残留 ${verdict.en.fail} 条`)
    console.log(`[ja] 已本地化 ${verdict.ja.pass} 条 / 与中文相同 ${verdict.ja.fail} 条`)
    console.log('[errors] ' + JSON.stringify(result.errors.slice(0, 5)))
    fs.writeFileSync(path.join(HERE, 'i18n-result.json'), JSON.stringify(result, null, 2), 'utf8')
    ws.close()
  } finally {
    try { ws && ws.close() } catch {}
    edge.kill()
    await sleep(400)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  if (result.verdict?.en?.fail > 0) process.exit(1)
}
main().catch((e) => { console.error('[FATAL]', e && e.stack || e); process.exit(2) })
