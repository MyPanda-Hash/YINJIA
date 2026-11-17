// round-01.mjs — 5173 源码版验收（DOM 驱动）：
//   ①点工序 → 跳「工单排产」并定位/高亮/展开 ②未排产/未到达提示 ③点「待检验」检验徽标 → 跳对应检验单
const SPACE = 'wo-progress-click-20261113'
const SHOT = 'D:/workspace/yinjia/tools/archive/_wo-progress-click-20261113/ego'
const BOARD = 'http://localhost:5173/#/prod/plan/workOrderProgress'
const SCHED = 'http://localhost:5173/#/prod/plan/workOrderBoard'

const out = { round: 'round-01', url: '5173-source', cases: {} }
const task = await taskSpace(SPACE)
const page = (await task.pages())[0] ?? (await task.newPage())
console.log({ space: task.spaceId, page: page.label })

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch { /* ignore */ }
}
async function autoLogin() {
  const onLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'))
  if (!onLogin) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    if (ins.find((i) => (i.placeholder || '').includes('账号'))) setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    if (ins.find((i) => (i.placeholder || '').includes('密码'))) setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  return true
}
/** 把看板行读成结构化（DOM 是唯一真源：接口需 token，page.fetch 不带 Authorization） */
async function readBoard() {
  return await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    return [...document.querySelectorAll('.wpb-grid-body .wpb-grid-row')].map((row, idx) => {
      const metaLines = [...row.querySelectorAll('.wpb-meta-line')].map(txt)
      const lineLine = metaLines.find((t) => t.startsWith('生产线')) || ''
      const rings = [...row.querySelectorAll('.wpr')].map((w) => {
        const nums = txt(w.querySelector('.wpr-nums')).split('/')
        return {
          name: txt(w.querySelector('.wpr-name')),
          done: Number(nums[0] || 0),
          plan: Number(nums[1] || 0),
          pct: txt(w.querySelector('.wpr-center')),
          badge: txt(w.querySelector('.wpr-ins')),
          ringTitle: w.getAttribute('title') || '',
          badgeTitle: w.querySelector('.wpr-ins')?.getAttribute('title') || '',
          hasBadge: !!w.querySelector('.wpr-ins'),
        }
      })
      return {
        idx,
        no: txt(row.querySelector('.wpb-no')),
        status: txt(row.querySelector('.wpb-status')),
        line: lineLine.replace(/^生产线\s*[:：]\s*/, ''),
        hint: txt(row.querySelector('.wpb-qc-hint')),
        rings,
      }
    })
  })
}
/** 依次尝试：给目标子元素打 data-e2e，再用真实指针点击 */
async function mark(no, kind, op) {
  return await page.evaluate(({ no, kind, op }) => {
    const rows = [...document.querySelectorAll('.wpb-grid-body .wpb-grid-row')]
    const row = rows.find((el) => (el.querySelector('.wpb-no')?.textContent || '').trim() === no)
    if (!row) return { ok: false, why: 'row-not-found' }
    row.scrollIntoView({ block: 'center' })
    const rings = [...row.querySelectorAll('.wpr')]
    const ring = op ? rings.find((x) => (x.querySelector('.wpr-name')?.textContent || '').trim() === op) : rings[0]
    if (!ring) return { ok: false, why: 'ring-not-found' }
    const target = kind === 'insp' ? ring.querySelector('.wpr-ins') : ring.querySelector('.wpr-ring')
    if (!target) return { ok: false, why: 'target-not-found' }
    document.querySelectorAll('[data-e2e="target"]').forEach((el) => el.removeAttribute('data-e2e'))
    target.setAttribute('data-e2e', 'target')
    return { ok: true }
  }, { no, kind, op })
}
async function clickMarked() {
  await page.click('[data-e2e="target"]', { label: '点击目标元素', timeout: 8000 })
  await page.evaluate(() => document.querySelector('[data-e2e="target"]')?.removeAttribute('data-e2e'))
}
async function readToasts() {
  return await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => ({
    type: [...el.classList].find((c) => c.startsWith('el-message--')) || '',
    text: (el.querySelector('.el-message__content')?.textContent || el.textContent || '').replace(/\s+/g, ' ').trim(),
  })))
}
async function clearToasts() { await page.waitForTimeout(3400) }
async function openBoard() {
  await page.goto(BOARD, { timeout: 30000 })
  await page.waitForTimeout(2500)
  if (await autoLogin()) { await page.goto(BOARD, { timeout: 30000 }) }
  await page.waitForSelector('.wpb-grid-row', { timeout: 30000 })
  await page.waitForTimeout(1200)
  await restoreWindow()
}

await openBoard()
await page.screenshot({ path: SHOT + '/round-01-a-board.png' })
const rows = await readBoard()
out.rows = { count: rows.length, first: rows[0] }

// ── 用例 1：点有进度的工序 → 工单排产定位 ─────────────────
const c1 = rows.find((r) => r.status !== '未排产' && r.line && r.rings.some((x) => x.done > 0 || x.ringTitle.includes('待审')))
out.cases.jump = { picked: c1 ? { no: c1.no, status: c1.status, line: c1.line } : null }
if (c1) {
  const ring = c1.rings.find((x) => x.done > 0 || x.ringTitle.includes('待审'))
  out.cases.jump.ring = ring
  const marked = await mark(c1.no, 'ring', ring.name)
  out.cases.jump.marked = marked
  if (marked.ok) {
    await page.screenshot({ path: SHOT + '/round-01-b-before-click.png' })
    await clickMarked()
    await page.waitForTimeout(5000)
    const url = await page.url()
    const info = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const focusRow = document.querySelector('.el-table__body tr.wb-focus-row')
      const flowFocus = document.querySelector('.wb-flow-tbl tr.is-focus')
      return {
        hash: location.hash,
        line: txt(document.querySelector('.wb-ctx-label b')),
        focusRowText: focusRow ? txt(focusRow).slice(0, 120) : '',
        focusTip: txt(document.querySelector('.wb-focus-tip')),
        flowFocusText: flowFocus ? txt(flowFocus) : '',
        expandedCells: document.querySelectorAll('.el-table__expanded-cell').length,
      }
    })
    out.cases.jump.after = { url, ...info }
    await page.screenshot({ path: SHOT + '/round-01-c-jump-to-schedule.png' })
  }
}

// ── 用例 2：点「进度 0」的工序（已排产行）→ 提示「该工序未到达」 ──
await openBoard()
const rows2 = await readBoard()
const c2 = rows2.find((r) => r.status !== '未排产' && r.line && r.rings.some((x) => x.done <= 0 && !x.ringTitle.includes('待审')))
out.cases.notReached = { picked: c2 ? { no: c2.no, line: c2.line } : null }
if (c2) {
  const ring = c2.rings.find((x) => x.done <= 0 && !x.ringTitle.includes('待审'))
  out.cases.notReached.ring = ring
  const urlBefore = await page.url()
  const marked = await mark(c2.no, 'ring', ring.name)
  if (marked.ok) {
    await clickMarked()
    await page.waitForTimeout(900)
    out.cases.notReached.result = { urlBefore, urlAfter: await page.url(), toasts: await readToasts() }
    await page.screenshot({ path: SHOT + '/round-01-d-not-reached-toast.png' })
  } else out.cases.notReached.marked = marked
  await clearToasts()
}

// ── 用例 3：未排产工单点工序 → 提示「该工单未进行排产」 ──────────
const rows3 = await readBoard()
const c3 = rows3.find((r) => r.status === '未排产' || !r.line)
out.cases.unscheduled = { picked: c3 ? { no: c3.no, status: c3.status, line: c3.line } : null }
if (c3 && c3.rings.length) {
  const urlBefore = await page.url()
  const marked = await mark(c3.no, 'ring', c3.rings[0].name)
  if (marked.ok) {
    await clickMarked()
    await page.waitForTimeout(900)
    out.cases.unscheduled.result = { urlBefore, urlAfter: await page.url(), toasts: await readToasts() }
    await page.screenshot({ path: SHOT + '/round-01-e-unscheduled-toast.png' })
  } else out.cases.unscheduled.marked = marked
  await clearToasts()
}

// ── 用例 4：点「待检验」检验徽标 → 跳对应检验单并定位 ────────────
await openBoard()
const rows4 = await readBoard()
const inspRows = rows4.map((r) => ({ r, ring: r.rings.find((x) => x.hasBadge && /[A-Z]{2,}-\d|\d{4}-\d{2}-\d{3}/.test(x.badgeTitle)) }))
const c4 = inspRows.find((x) => !!x.ring)
out.cases.insp = { picked: c4 ? { no: c4.r.no, ring: c4.ring } : null }
if (c4) {
  const docNo = (c4.ring.badgeTitle.match(/([A-Z]{2,}-\d{4}-\d{4,}|\d{4}-\d{5,})/g) || [])[0] || ''
  const marked = await mark(c4.r.no, 'insp', c4.ring.name)
  out.cases.insp.marked = marked
  if (marked.ok) {
    await clickMarked()
    await page.waitForTimeout(6000)
    const info = await page.evaluate((docNo) => {
      const body = document.body.innerText || ''
      return {
        hash: location.hash,
        docNo,
        hasDocNoInPage: docNo ? body.includes(docNo) : null,
        title: (document.querySelector('.doc-chip, .as-title, .pl-title, .panel-title, h2, h3')?.textContent || '').replace(/\s+/g, ' ').trim(),
        bodyHead: body.replace(/\s+/g, ' ').slice(0, 240),
      }
    }, docNo)
    out.cases.insp.after = info
    await page.screenshot({ path: SHOT + '/round-01-f-insp-doc.png' })
  }
}

// ── 用例 5：行级「待品质检验: …」提示条可点 ────────────────────
const c5 = rows4.find((r) => r.hint)
out.cases.hint = { picked: c5 ? { no: c5.no, hint: c5.hint } : null }
if (c5) {
  const markedHint = await page.evaluate(({ no }) => {
    const rows = [...document.querySelectorAll('.wpb-grid-body .wpb-grid-row')]
    const row = rows.find((el) => (el.querySelector('.wpb-no')?.textContent || '').trim() === no)
    const hint = row?.querySelector('.wpb-qc-hint')
    if (!hint) return { ok: false }
    hint.setAttribute('data-e2e', 'target')
    return { ok: true }
  }, { no: c5.no })
  if (markedHint.ok) {
    await clickMarked()
    await page.waitForTimeout(5500)
    out.cases.hint.after = await page.evaluate(() => ({
      hash: location.hash,
      bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
    }))
    await page.screenshot({ path: SHOT + '/round-01-g-hint-click.png' })
  }
}

console.log(JSON.stringify(out, null, 2))
