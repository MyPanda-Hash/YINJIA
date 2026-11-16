// round-03.mjs — 数据契约 + 打包版(8090)验收
//   ①接口返回的 工序步骤[] 是否带 生产线/台账状态/已排产（带 Authorization 直打 /api）
//   ②8090（jar 内 static + 新 jar）上重跑两条主流程：点工序跳工单排产、点待检验跳检验单
const SPACE = 'wo-progress-click-20261113'
const SHOT = 'D:/workspace/yinjia/tools/archive/_wo-progress-click-20261113/ego'
const BOARD5173 = 'http://localhost:5173/#/prod/plan/workOrderProgress'
const BOARD8090 = 'http://127.0.0.1:8090/#/prod/plan/workOrderProgress'
const out = { round: 'round-03' }
const task = await taskSpace(SPACE)
const page = (await task.pages())[0] ?? (await task.newPage())

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(250)
  } catch { /* ignore */ }
}
async function autoLogin(BOARD) {
  const onLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'))
  if (!onLogin) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, 'admin')
    if (pwd) setVal(pwd, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
  await page.goto(BOARD, { timeout: 30000 })
  await page.reload()
  await page.waitForTimeout(4000)
  return true
}
async function openBoard(BOARD) {
  await page.goto(BOARD, { timeout: 30000 })
  await page.reload()
  await page.waitForTimeout(1500)
  await autoLogin(BOARD)
  await page.waitForSelector('.wpb-grid-row', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await restoreWindow()
}
async function readBoard() {
  return await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    return [...document.querySelectorAll('.wpb-grid-body .wpb-grid-row')].map((row) => {
      const lineLine = [...row.querySelectorAll('.wpb-meta-line')].map(txt).find((t) => t.startsWith('生产线')) || ''
      return {
        no: txt(row.querySelector('.wpb-no')),
        status: txt(row.querySelector('.wpb-status')),
        line: lineLine.replace(/^生产线\s*[:：]\s*/, ''),
        rings: [...row.querySelectorAll('.wpr')].map((w) => {
          const nums = txt(w.querySelector('.wpr-nums')).split('/')
          return {
            name: txt(w.querySelector('.wpr-name')), done: Number(nums[0] || 0),
            badge: txt(w.querySelector('.wpr-ins')),
            badgeTitle: w.querySelector('.wpr-ins')?.getAttribute('title') || '',
            hasBadge: !!w.querySelector('.wpr-ins'),
          }
        }),
      }
    })
  })
}
async function markIn(no, selector) {
  return await page.evaluate(({ no, selector }) => {
    const rows = [...document.querySelectorAll('.wpb-grid-body .wpb-grid-row')]
    const row = rows.find((el) => (el.querySelector('.wpb-no')?.textContent || '').trim() === no)
    if (!row) return { ok: false, why: 'row-not-found' }
    row.scrollIntoView({ block: 'center' })
    const el = row.querySelector(selector)
    if (!el) return { ok: false, why: 'el-not-found' }
    document.querySelectorAll('[data-e2e="target"]').forEach((x) => x.removeAttribute('data-e2e'))
    el.setAttribute('data-e2e', 'target')
    return { ok: true }
  }, { no, selector })
}
async function clickMarked(label) {
  await page.click('[data-e2e="target"]', { label: label || '点击目标', timeout: 8000 })
  await page.evaluate(() => document.querySelector('[data-e2e="target"]')?.removeAttribute('data-e2e'))
}

// ── ① 数据契约：直接看接口返回 ──────────────────────────────
try {
  await openBoard(BOARD5173)
  const api = await page.evaluate(async () => {
    const token = localStorage.getItem('mes_token') || ''
    const res = await fetch('/api/px/workOrderProgress/list', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ 状态: '未完工', limit: 300 }),
    })
    const json = await res.json()
    const rows = json?.data?.['行'] || []
    const samples = []
    let withLine = 0, withLedger = 0, schedTrue = 0, steps = 0, fallbackDiff = 0
    for (const r of rows) {
      for (const s of (r['工序步骤'] || [])) {
        steps++
        if (String(s['生产线'] || '') !== '') withLine++
        if (String(s['台账状态'] || '') !== '') withLedger++
        if (s['已排产'] === true) schedTrue++
        if (String(s['生产线'] || '') !== '' && String(s['生产线']) !== String(r['生产线'] || '')) fallbackDiff++
        if (samples.length < 6 && String(s['生产线'] || '') !== '') {
          samples.push({
            no: r['工单号'], rowLine: r['生产线'], op: s['工序'], stepLine: s['生产线'],
            ledger: s['台账状态'], sched: s['已排产'], done: s['完工量'],
          })
        }
      }
    }
    return { status: res.status, rows: rows.length, steps, withLine, withLedger, schedTrue, stepLineDiffersFromRowLine: fallbackDiff, samples }
  })
  out.contract = api
  console.log('[contract] ' + JSON.stringify(api))
} catch (e) { out.contractError = String(e.message || e) }

// ── ② 8090 打包版：点工序 → 工单排产；点待检验 → 检验单 ─────────
try {
  await openBoard(BOARD8090)
  const rows = await readBoard()
  const c1 = rows.find((r) => r.status !== '未排产' && r.line && r.rings.some((x) => x.done > 0))
  out.pkg8090 = { rows: rows.length, jumpPicked: c1 ? c1.no : null }
  if (c1) {
    const ring = c1.rings.find((x) => x.done > 0)
    await markIn(c1.no, '.wpr')
    // .wpr 中心点可能是环;点 ring 元素更稳
    await markIn(c1.no, '.wpr .wpr-ring')
    await clickMarked('8090 点工序环')
    await page.waitForTimeout(5500)
    out.pkg8090.jump = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      return {
        hash: location.hash,
        line: txt(document.querySelector('.wb-ctx-label b')),
        focusTip: txt(document.querySelector('.wb-focus-tip')),
        focusRows: document.querySelectorAll('.el-table__body tr.wb-focus-row').length,
        expanded: document.querySelectorAll('.el-table__expanded-cell').length,
        flowFocus: txt(document.querySelector('.wb-flow-tbl tr.is-focus')),
      }
    })
    console.log('[8090.jump] ' + JSON.stringify(out.pkg8090.jump))
    await page.screenshot({ path: SHOT + '/round-03-a-8090-jump.png' })
  }
  await openBoard(BOARD8090)
  const rows2 = await readBoard()
  const DOC_RE = /[A-Z]{2,}-\d{4}-\d{2}-\d{4,}/
  const c2 = rows2.map((r) => ({ r, ring: r.rings.find((x) => x.hasBadge && DOC_RE.test(x.badgeTitle)) })).find((x) => !!x.ring)
  out.pkg8090.inspPicked = c2 ? { no: c2.r.no, ring: c2.ring } : null
  if (c2) {
    const docNo = (c2.ring.badgeTitle.match(DOC_RE) || [''])[0]
    await markIn(c2.r.no, '.wpr .wpr-ins')
    await clickMarked('8090 点检验徽标')
    await page.waitForTimeout(6000)
    out.pkg8090.insp = await page.evaluate(({ docNo }) => {
      const body = document.body.innerText || ''
      return {
        hash: location.hash, docNo, docNoVisible: body.includes(docNo),
        rowCountText: (body.match(/共有数据[:：]\s*\d+\s*条/) || [''])[0],
      }
    }, { docNo })
    console.log('[8090.insp] ' + JSON.stringify(out.pkg8090.insp))
    await page.screenshot({ path: SHOT + '/round-03-b-8090-insp.png' })
  }
} catch (e) { out.pkg8090Error = String(e.message || e) }

console.log('=== FINAL ===')
console.log(JSON.stringify(out, null, 2))
