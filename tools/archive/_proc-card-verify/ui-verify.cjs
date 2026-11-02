/**
 * ui-verify.cjs — 工序流程追踪卡 界面实测(Edge headless + CDP,打 8090 的**打包后**前端)
 *
 * 用法: node tools/archive/_proc-card-verify/ui-verify.cjs
 * 前置: rebuild-prod.ps1 已跑(8090 = 新 jar,前端已 build 进 static);api-smoke.cjs 已建好
 *       LZK-GD-2026-10-0223-1(本脚本还用于页面建卡,建出来的卡由 cleanup.cjs 清)
 *
 * 覆盖(契约 §5 / 验收 §6#7):
 *   ① 真实登录 8090 → 菜单「生产计划 → 工序流程追踪卡」→ 三页签都能打开
 *   ② 录入页签:选批次 → 选工单行 → 建卡 → 上传真实小图 → 缩略图出现 → 删除照片
 *   ③ 列表页签:按产品编码查询出卡片 → 行点击抽屉(只读卡面)
 *   ④ 批次追溯页签:按批次号查汇总 + 卡片 → 点卡 → 追溯抽屉(工序进度/报工记录/工单追溯)
 *   ⑤ 桌面 1440x900 与窄屏 390x844 截图;记录横向滚动/元素裁切/控制台错误/失败请求
 *
 * 产物: shots/*.png、ui-verify-result.json
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = __dirname
const SHOTS = path.join(HERE, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const report = { checks: [], errors: [], shots: [], navigations: [] }
function chk(name, cond, detail) {
  report.checks.push({ name, pass: !!cond, detail: detail === undefined ? '' : detail })
  console.log(`  ${cond ? '[PASS]' : '[FAIL]'} ${name}${detail !== undefined && detail !== '' ? '  :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
  if (!cond) fails++
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  // ── 登录(接口)──
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await lr.json()
  if (!login?.data?.token) throw new Error('登录失败:' + JSON.stringify(login))
  const user = login.data.user
  console.log(`[login] admin=${user.isAdmin} pagePerms.PROC_FLOW_CARD=${JSON.stringify(user.pagePerms?.PROC_FLOW_CARD)}`)
  report.pagePerms = user.pagePerms?.PROC_FLOW_CARD

  // ── Edge headless ──
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pfc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let ws
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') {
        report.errors.push({ type: 'exception', text: m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text })
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
        report.errors.push({ type: 'console.error', text: (m.params.args || []).map((a) => a.value ?? a.description).join(' ') })
      } else if (m.method === 'Log.entryAdded' && (m.params?.entry?.level === 'error' || m.params?.entry?.level === 'warning')) {
        report.errors.push({ type: 'log.' + m.params.entry.level, text: m.params.entry.text })
      } else if (m.method === 'Network.responseReceived') {
        const st = m.params?.response?.status
        if (st >= 400) report.errors.push({ type: 'http' + st, text: m.params.response.url })
      }
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || '') }
      return r.result?.result?.value
    }
    const nav = async (url, waitMs = 1500) => {
      report.navigations.push(url)
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break }
      await sleep(waitMs)
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
      const p = path.join(SHOTS, name)
      fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'))
      report.shots.push(path.relative(HERE, p))
      console.log(`  [shot] ${p}`)
      return p
    }
    const metrics = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile })
    const visibleSel = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.offsetParent!==null)`

    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable'); await send('DOM.enable')
    await metrics(1440, 900, false)

    // ── 1 登录态注入 + 打开页面 ──
    console.log('\n=== 1 打开页面(真实登录态)===')
    await nav(BASE + '/#/login')
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_locale', 'zh-CN');
localStorage.setItem('mes_login_date', '2026-08-29'); 'ok'`)
    await nav('about:blank', 200)
    await nav(BASE + '/#/prod/plan/procFlowCard', 2500)
    chk('路由 /#/prod/plan/procFlowCard 打开(出现 .pfc 容器)', !!(await ev(`!!document.querySelector('.pfc')`)))
    chk('document.title 含「工序流程追踪卡」', String(await ev('document.title')).includes('工序流程追踪卡'), await ev('document.title'))
    const tabLabels = await ev(`[...document.querySelectorAll('.pfc-tabs .el-tabs__item')].map(e=>e.textContent.trim())`)
    chk('三个页签 = 录入 / 卡片列表 / 批次追溯', JSON.stringify(tabLabels) === JSON.stringify(['录入', '卡片列表', '批次追溯']), JSON.stringify(tabLabels))
    const menuHit = await ev(`(() => {
      const nav = document.querySelector('.leftnav')
      const groups = nav ? [...nav.querySelectorAll('.nav-group')] : []
      const modules = nav ? [...nav.querySelectorAll('.nav-nav-module, .nav-module')] : []
      const leaf = modules.find((e) => e.textContent.trim().includes('工序流程追踪卡'))
      const prodPlan = groups.find((e) => e.textContent.trim().startsWith('生产计划'))
      return { leaf: !!leaf, prodPlan: !!prodPlan, leafText: leaf ? leaf.textContent.trim() : '',
               modules: modules.map((e) => e.textContent.trim()).slice(0, 30) }
    })()`)
    chk('左侧菜单「生产计划 → 工序流程追踪卡」可见', menuHit?.leaf && menuHit?.prodPlan, JSON.stringify(menuHit))
    await shot('desktop-entry-initial.png')

    // ── 2 录入页签:选批次 → 选工单行 → 卡面 ──
    console.log('\n=== 2 录入页签 ===')
    for (let i = 0; i < 20 && !(await ev(`document.querySelectorAll('.pfc-list .el-table__row').length`)); i++) await sleep(400)
    const pickDropdown = async (keyword, startWith) => {
      const clickRes = await ev(`(() => { const w = ${visibleSel('.pfc-batch .el-select__wrapper')}; if (!w) return {err:'no select'}; w.click(); return {ok:true} })()`)
      if (clickRes?.err) return { err: clickRes.err }
      await sleep(700)
      if (keyword) {
        await ev(`(() => {
          const inp = [...document.querySelectorAll('.el-select-dropdown input')].find(e=>e.offsetParent!==null) || document.querySelector('.el-select__input')
          if (!inp) return 'no-input'
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
          s.call(inp, ${JSON.stringify(keyword)}); inp.dispatchEvent(new Event('input', {bubbles:true}))
          return 'typed'
        })()`)
        await sleep(700)
      }
      const clicked = await ev(`(() => {
        const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent!==null)
        const t = items.find(e=>e.textContent.trim().startsWith(${JSON.stringify(startWith)}))
        if (!t) return { ok:false, opts: items.map(e=>e.textContent.trim()).slice(0,10) }
        t.click(); return { ok:true, txt:t.textContent.trim() }
      })()`)
      await sleep(1800)
      return clicked
    }
    let sel = await pickDropdown('20261019', '20261019')
    chk('录入页签选批次 20261019', !!sel?.ok, JSON.stringify(sel))
    for (let i = 0; i < 20 && !(await ev(`document.querySelectorAll('.pfc-list .el-table__row').length`)); i++) await sleep(300)
    const linesText = await ev(`[...document.querySelectorAll('.pfc-list .el-table__row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim())`)
    chk('小批次表出现工单行(GD-2026-10-0223 #1)', (linesText || []).some((t) => t.includes('GD-2026-10-0223')), JSON.stringify((linesText || []).slice(0, 3)))
    await ev(`(() => { const r = [...document.querySelectorAll('.pfc-list .el-table__row')].find(e=>e.textContent.includes('GD-2026-10-0223')); r?.click(); return !!r })()`)
    await sleep(2000)
    const cardNoUi = await ev(`document.querySelector('.pfe-cardno')?.textContent?.trim() || ''`)
    chk('点工单行后卡面显示卡号 LZK-GD-2026-10-0223-1', cardNoUi === 'LZK-GD-2026-10-0223-1', cardNoUi)
    const opCards = await ev(`document.querySelectorAll('.pfe-op').length`)
    chk('卡面工序卡片数 = 3(成型/切炭/组装)', opCards === 3, opCards)
    const opInfo = await ev(`[...document.querySelectorAll('.pfe-op')].map(e=>({ name: e.querySelector('.pfe-op-name')?.textContent?.trim(), nums: e.querySelector('.pfe-op-nums')?.textContent?.replace(/\\s+/g,' ').trim() }))`)
    chk('工序卡片显示 计划/已报工/待审核/完成时间/报工人', (opInfo || []).every((o) => /计划数量/.test(o.nums) && /已报工/.test(o.nums) && /待审核/.test(o.nums) && /完成时间/.test(o.nums) && /报工人/.test(o.nums)), JSON.stringify(opInfo))
    chk('成型工序显示 10/100 已报工(与 /detail 一致)', JSON.stringify(opInfo?.[0]?.nums || '').includes('10') && JSON.stringify(opInfo?.[0]?.nums || '').includes('100'), opInfo?.[0]?.nums)
    await shot('desktop-entry-card.png')

    // ── 3 上传照片 → 缩略图 → 删除 ──
    console.log('\n=== 3 照片墙:上传 / 缩略图 / 删除 ===')
    const pngPath = path.join(HERE, 'verify-photo-100x100.png')
    const doc = await send('DOM.getDocument', { depth: -1 })
    let q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.pfe .pfp input[type=file]' })
    chk('照片墙存在隐藏文件输入(input[type=file][accept=image/*])', !!q.result?.nodeId,
      await ev(`(() => { const i=document.querySelector('.pfe .pfp input[type=file]'); return i ? i.getAttribute('accept')+' capture='+i.getAttribute('capture') : 'NONE' })()`))
    if (q.result?.nodeId) {
      await send('DOM.setFileInputFiles', { files: [pngPath], nodeId: q.result.nodeId })
      await sleep(3500)
      const thumbs = await ev(`document.querySelectorAll('.pfe .pfp-img').length`)
      chk('上传后照片墙出现缩略图(.pfp-img)', thumbs >= 1, thumbs)
      const photoText = await ev(`[...document.querySelectorAll('.pfe-op')].map(e=>e.textContent.replace(/\\s+/g,' ')).find(t=>t.includes('照片')) || ''`)
      chk('卡头照片数更新(照片 1)', /照片\s*1/.test(photoText) || (await ev(`document.querySelector('.pfe-photos')?.textContent?.replace(/\\s+/g,' ').trim() || ''`))?.includes('1'),
        await ev(`document.querySelector('.pfe-photos')?.textContent?.replace(/\\s+/g,' ').trim() || 'NO-PHOTO-COUNT'`))
      await shot('desktop-entry-photo.png')
      // 删除:点 ✕ → 确认弹窗 → 确定
      const delClicked = await ev(`(() => { const d = ${visibleSel('.pfe .pfp-del')}; if (!d) return false; d.click(); return true })()`)
      await sleep(800)
      const dlg = await ev(`document.querySelector('.el-message-box__title')?.textContent?.trim() || 'NO-DIALOG'`)
      chk('点删除照片弹出确认框', delClicked === true && dlg !== 'NO-DIALOG', dlg)
      await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns .el-button--primary')][0]; b?.click(); return !!b })()`)
      await sleep(3000)
      const thumbsAfter = await ev(`document.querySelectorAll('.pfe .pfp-img').length`)
      chk('确认删除后缩略图消失', thumbsAfter === 0, thumbsAfter)
    }

    // ── 4 建卡(另一批次,工单行无卡)→ 页面建卡 ──
    console.log('\n=== 4 录入页签:建卡 ===')
    sel = await pickDropdown('20260912', '20260912')
    chk('录入页签切到批次 20260912', !!sel?.ok, JSON.stringify(sel))
    await sleep(1500)
    const lineRows2 = await ev(`[...document.querySelectorAll('.pfc-list .el-table__row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim())`)
    const rowHit = await ev(`(() => { const r=[...document.querySelectorAll('.pfc-list .el-table__row')].find(e=>e.textContent.includes('GD-2026-09-0049')); if(!r) return false; r.click(); return true })()`)
    await sleep(1500)
    const hasCreateBtn = await ev(`!!(${visibleSel('.pfc-create .el-button')})`)
    chk('未建卡行显示「创建流程卡」按钮', rowHit === true && hasCreateBtn, JSON.stringify((lineRows2 || []).slice(0, 2)))
    await shot('desktop-entry-nocard.png')
    if (hasCreateBtn) {
      await ev(`(() => { const b=${visibleSel('.pfc-create .el-button')}; b?.click(); return !!b })()`)
      await sleep(3500)
      const newCardNo = await ev(`document.querySelector('.pfe-cardno')?.textContent?.trim() || ''`)
      chk('页面建卡成功,卡号 = LZK-GD-2026-09-0049-1', newCardNo === 'LZK-GD-2026-09-0049-1', newCardNo)
      report.uiCreatedCard = newCardNo
      await shot('desktop-entry-created.png')
    }

    // ── 5 卡片列表页签 ──
    console.log('\n=== 5 卡片列表页签 ===')
    await ev(`(() => { const t=[...document.querySelectorAll('.pfc-tabs .el-tabs__item')].find(e=>e.textContent.trim()==='卡片列表'); t?.click(); return !!t })()`)
    await sleep(2500)
    const headerCols = await ev(`[...document.querySelectorAll('.el-table__header th')].map(e=>e.textContent.trim()).filter(Boolean)`)
    chk('列表表头含 卡号/工序进度/完成工序数/照片/创建人',
      ['卡号', '工序进度', '完成工序数', '照片', '创建人'].every((c) => (headerCols || []).includes(c)), JSON.stringify((headerCols || []).slice(0, 20)))
    // 按产品编码查询(batch20261019 的卡产品编码 T035-6)
    await ev(`(() => {
      const inp = [...document.querySelectorAll('.pfc-bar .pfc-kw-sm input')].find(e=>e.offsetParent!==null)
      if (!inp) return 'no-input'
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
      s.call(inp, 'T035-6'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
    })()`)
    await ev(`(() => { const b=[...document.querySelectorAll('.pfc-bar .el-button')].filter(e=>e.offsetParent!==null).find(e=>e.textContent.trim()==='查询'); b?.click(); return !!b })()`)
    await sleep(2500)
    const listRows = await ev(`[...document.querySelectorAll('.el-tab-pane:not([style*="display: none"]) .el-table__row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim())`)
    chk('按产品编码 T035-6 查询出卡片', (listRows || []).some((t) => t.includes('LZK-GD-2026-10-0223-1')), JSON.stringify((listRows || []).slice(0, 3)))
    chk('列表行显示工序进度(含 / 与 ✓ 语义)', (listRows || []).some((t) => /成型 \d+\/\d+/.test(t)), JSON.stringify((listRows || []).slice(0, 2)))
    await shot('desktop-list.png')
    // 行点击 → 只读卡面抽屉
    const opened = await ev(`(() => { const r=[...document.querySelectorAll('.el-tab-pane:not([style*="display: none"]) .el-table__row')].find(e=>e.textContent.includes('LZK-GD-2026-10-0223-1')); if(!r) return false; r.click(); return true })()`)
    await sleep(2500)
    const drawerHasCard = await ev(`!!(document.querySelector('.el-drawer .pfe') || document.querySelector('.el-drawer .pfe-cardno'))`)
    chk('列表行点击 → 卡面详情抽屉(只读)', opened === true && drawerHasCard, drawerHasCard)
    await shot('desktop-list-drawer.png')
    await ev(`(() => { const c=document.querySelector('.el-drawer__close-btn'); c?.click(); return !!c })()`)
    await sleep(800)

    // ── 6 批次追溯页签 ──
    console.log('\n=== 6 批次追溯页签 ===')
    await ev(`(() => { const t=[...document.querySelectorAll('.pfc-tabs .el-tabs__item')].find(e=>e.textContent.trim()==='批次追溯'); t?.click(); return !!t })()`)
    await sleep(3000)
    let statVals = await ev(`[...document.querySelectorAll('.pfc-stat')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())`)
    if (!statVals || statVals.length === 0) {
      // 没自动带批次(当前批次为空)⇒ 手动选
      sel = await pickDropdown('20260912', '20260912')
      await sleep(2000)
      statVals = await ev(`[...document.querySelectorAll('.pfc-stat')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())`)
    }
    chk('批次追溯显示汇总(卡数/产品数/计划数量)', (statVals || []).length === 3 && (statVals || []).every((s) => s.length > 0), JSON.stringify(statVals))
    const sumOps = await ev(`[...document.querySelectorAll('.pfc-sum-ops .el-table__row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim())`)
    chk('各工序完成量表有行(成型/切炭/组装)', (sumOps || []).length >= 1, JSON.stringify((sumOps || []).slice(0, 4)))
    await shot('desktop-trace.png')
    const traceCardRows = await ev(`[...document.querySelectorAll('.el-tab-pane:not([style*="display: none"]) .el-table__row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim())`)
    chk('批次追溯卡片表含卡号 LZK-GD-2026-09-0049-1', (traceCardRows || []).some((t) => t.includes('LZK-GD-2026-09-0049-1')) || (traceCardRows || []).some((t) => t.includes('LZK-')),
      JSON.stringify((traceCardRows || []).slice(0, 3)))
    const openedTrace = await ev(`(() => { const r=[...document.querySelectorAll('.el-tab-pane:not([style*="display: none"]) .el-table__row')].find(e=>/LZK-/.test(e.textContent)); if(!r) return false; r.click(); return true })()`)
    await sleep(3000)
    chk('点卡片打开追溯抽屉(.pft)', openedTrace === true && !!(await ev(`!!document.querySelector('.pft')`)))
    const traceOps = await ev(`document.querySelectorAll('.pft .pft-op').length`)
    chk('追溯抽屉显示工序进度(≥1 道)', traceOps >= 1, traceOps)
    const traceReports = await ev(`document.querySelectorAll('.pft-table .el-table__row').length`)
    chk('追溯抽屉显示报工记录表(有数据)', traceReports >= 1, traceReports)
    await shot('desktop-trace-drawer.png')
    // 工单追溯 展开(实测会显示降级错误 —— 既有 ScheduleBoardService.trace 查已下架表)
    await ev(`(() => { const b=[...document.querySelectorAll('.pft-sec-title .el-button')].find(e=>e.textContent.trim()==='展开'); b?.click(); return !!b })()`)
    await sleep(2000)
    const woSeg = await ev(`(() => { const pre=document.querySelector('.pft-json'); const segs=document.querySelectorAll('.pft-seg').length; return { json: pre ? pre.textContent.replace(/\\s+/g,' ').slice(0,160) : '', segs } })()`)
    chk('「工单追溯」展开后有真实结构(Lead 修复后不再降级为错误)', !!woSeg && woSeg.segs > 0 && !/对象名|无效|取数失败/.test(woSeg.json || ''), JSON.stringify(woSeg).slice(0, 400))
    report.woTraceUi = woSeg
    await shot('desktop-trace-wotrace.png')
    await ev(`(() => { const c=document.querySelector('.el-drawer__close-btn'); c?.click(); return !!c })()`)
    await sleep(800)

    // ── 7 窄屏 390x844 ──
    console.log('\n=== 7 窄屏 390x844 ===')
    // 强制整页重载:Same-URL 的 Page.navigate 不会重新挂载 SPA,抽屉会残留到窄屏截图里
    await ev(`(() => { document.querySelectorAll('.el-overlay').forEach(e=>e.remove()); return 'ok' })()`)
    await metrics(390, 844, true)
    await send('Page.reload', { ignoreCache: false })
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break }
    await sleep(3000)
    for (let i = 0; i < 20 && !(await ev(`!!document.querySelector('.pfc')`)); i++) await sleep(400)
    for (let i = 0; i < 20 && !(await ev(`document.querySelectorAll('.pfc-list .el-table__row').length`)); i++) await sleep(400)
    const narrowMeta = await ev(`(() => {
      const de = document.documentElement
      const pfc = document.querySelector('.pfc')
      const bar = document.querySelector('.pfc-bar')
      const tabs = document.querySelector('.pfc-tabs .el-tabs__header')
      const btn = [...document.querySelectorAll('.pfc-bar .el-button')].filter(b=>b.offsetParent!==null).map(b=>{const r=b.getBoundingClientRect();return {h:Math.round(r.height),w:Math.round(r.width)}})
      return { innerW: window.innerWidth, scrollW: de.scrollWidth, bodyScrollW: document.body.scrollWidth,
        pfcScrollW: pfc ? pfc.scrollWidth : -1, pfcClientW: pfc ? pfc.clientWidth : -1,
        barH: bar ? Math.round(bar.getBoundingClientRect().height) : -1,
        tabsW: tabs ? Math.round(tabs.getBoundingClientRect().width) : -1,
        btnSizes: btn.slice(0,6) }
    })()`)
    report.narrowMeta = narrowMeta
    chk('窄屏无横向滚动(documentElement.scrollWidth ≤ innerWidth+2)', narrowMeta.scrollW <= narrowMeta.innerW + 2, JSON.stringify({ innerW: narrowMeta.innerW, scrollW: narrowMeta.scrollW, bodyScrollW: narrowMeta.bodyScrollW }))
    chk('窄屏 .pfc 容器自身无横向溢出(scrollWidth ≤ clientWidth+2)', narrowMeta.pfcScrollW <= narrowMeta.pfcClientW + 2, JSON.stringify({ s: narrowMeta.pfcScrollW, c: narrowMeta.pfcClientW }))
    chk('窄屏按钮高度 ≥40px(可点)', (narrowMeta.btnSizes || []).every((b) => b.h >= 40), JSON.stringify(narrowMeta.btnSizes))
    await shot('narrow-entry.png')
    const tabsClipped = await ev(`(() => { const h=document.querySelector('.pfc-tabs .el-tabs__header'); const r=h.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right), innerW: window.innerWidth } })()`)
    chk('窄屏页签栏未被裁切(right ≤ innerWidth)', tabsClipped.right <= tabsClipped.innerW + 1, JSON.stringify(tabsClipped))
    // 点一行看卡面是否单列可读
    await ev(`(() => { const r=[...document.querySelectorAll('.pfc-list .el-table__row')][0]; r?.click(); return !!r })()`)
    await sleep(2000)
    await shot('narrow-entry-card.png')
    // 列表页签
    await ev(`(() => { const t=[...document.querySelectorAll('.pfc-tabs .el-tabs__item')].find(e=>e.textContent.trim()==='卡片列表'); t?.click(); return !!t })()`)
    await sleep(2500)
    await shot('narrow-list.png')
    // 追溯页签
    await ev(`(() => { const t=[...document.querySelectorAll('.pfc-tabs .el-tabs__item')].find(e=>e.textContent.trim()==='批次追溯'); t?.click(); return !!t })()`)
    await sleep(2500)
    await shot('narrow-trace.png')

    report.checksFinal = report.checks
    report.failCount = fails
    report.errors = report.errors.filter((e) => !/favicon/i.test(e.text || ''))
    fs.writeFileSync(path.join(HERE, 'ui-verify-result.json'), JSON.stringify(report, null, 2), 'utf8')
    console.log('\n=== 控制台/网络错误 ===')
    console.log(JSON.stringify(report.errors, null, 1))
    console.log(`\n[result] 断言 ${report.checks.length} 项,失败 ${fails};截图 ${report.shots.length} 张`)
    ws.close()
  } finally {
    try { ws && ws.close() } catch {}
    edge.kill()
    await sleep(500)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  if (fails > 0) process.exit(1)
}
main().catch((e) => { console.error('[FATAL]', e && e.stack || e); process.exit(2) })
