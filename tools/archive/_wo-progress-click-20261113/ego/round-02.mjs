// round-02.mjs — 5173 源码版补验：
//   ④检验单深链是否真的定位到那张单  ⑤行级「待品质检验」提示条可点  ⑥列表视图圆点/检验小点  ⑦整行点击回归（仍跳生产工单）
// 说明：本页在 keep-alive 里缓存「看板/列表」视图状态 ⇒ 每个用例前 openBoard() 用 goto+reload 回到干净首屏。
const SPACE = 'wo-progress-click-20261113'
const SHOT = 'D:/workspace/yinjia/tools/archive/_wo-progress-click-20261113/ego'
const BOARD = 'http://localhost:5173/#/prod/plan/workOrderProgress'
const out = { round: 'round-02', url: '5173-source', cases: {} }
const task = await taskSpace(SPACE)
const page = (await task.pages())[0] ?? (await task.newPage())
const log = (k, v) => { out.cases[k] = v; console.log('[' + k + '] ' + JSON.stringify(v)) }

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(250)
  } catch { /* ignore */ }
}
async function openBoard() {
  await page.goto(BOARD, { timeout: 30000 })
  await page.reload()
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
        hint: txt(row.querySelector('.wpb-qc-hint')),
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

// ── ④ 检验单深链：点徽标 → 面板定位到那张单 ─────────────────
try {
  await openBoard()
  const rows = await readBoard()
  const DOC_RE = /[A-Z]{2,}-\d{4}-\d{2}-\d{4,}/   // 例：SJ-2026-11-0006 / ZC-2026-11-0001
  const insp = rows.map((r) => ({ r, ring: r.rings.find((x) => x.hasBadge && DOC_RE.test(x.badgeTitle)) }))
    .find((x) => !!x.ring)
  log('inspLink', { picked: insp ? { no: insp.r.no, ring: insp.ring } : null })
  if (insp) {
    const docNo = (insp.ring.badgeTitle.match(DOC_RE) || [''])[0]
    const panel = /首件检验/.test(insp.ring.badgeTitle) ? 'QC_FIRST_INSP'
      : /制程检验/.test(insp.ring.badgeTitle) ? 'QC_PROC_INSP' : 'QC_ASM_INSP'
    await markIn(insp.r.no, '.wpr .wpr-ins')
    await clickMarked('点击检验徽标')
    await page.waitForTimeout(6000)
    const info = await page.evaluate(({ docNo }) => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const body = document.body.innerText || ''
      return {
        hash: location.hash,
        docNo,
        docNoVisible: docNo ? body.includes(docNo) : null,
        docChip: txt(document.querySelector('.doc-chip')),
        rowCountText: (body.match(/共有数据[:：]\s*\d+\s*条/) || [''])[0],
        bodySlice: body.replace(/\s+/g, ' ').slice(150, 800),
      }
    }, { docNo })
    out.cases.inspLink.after = { expectedPanel: panel, ...info }
    console.log('[inspLink.after] ' + JSON.stringify(out.cases.inspLink.after))
    await page.screenshot({ path: SHOT + '/round-02-a-insp-located.png' })
  }
} catch (e) { log('inspLinkError', { msg: String(e.message || e) }) }

// ── ⑤ 行级「待品质检验」提示条可点 ───────────────────────────
try {
  await openBoard()
  const rows5 = await readBoard()
  const c5 = rows5.find((r) => r.hint)
  const urlBefore = await page.url()
  const marked = c5 ? await markIn(c5.no, '.wpb-qc-hint') : { ok: false }
  log('hintClick', { picked: c5 ? { no: c5.no, hint: c5.hint } : null, marked, urlBefore })
  if (c5 && marked.ok) {
    await clickMarked('点击待品质检验提示条')
    await page.waitForTimeout(6000)
    const after = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const body = document.body.innerText || ''
      return {
        hash: location.hash,
        docChip: txt(document.querySelector('.doc-chip')),
        docNosInPage: (body.match(/[A-Z]{2,}-\d{4}-\d{2}-\d{4,}/g) || []).slice(0, 3),
        rowCountText: (body.match(/共有数据[:：]\s*\d+\s*条/) || [''])[0],
        bodyHead: body.replace(/\s+/g, ' ').slice(0, 240),
      }
    })
    out.cases.hintClick.after = after
    console.log('[hintClick.after] ' + JSON.stringify(after))
    await page.screenshot({ path: SHOT + '/round-02-b-hint-click.png' })
  }
} catch (e) { log('hintClickError', { msg: String(e.message || e) }) }

// ── ⑥ 列表视图：有进度的圆点 → 工单排产；检验小点 → 检验单 ────────
try {
  await openBoard()
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.el-radio-button__inner')].find((b) => (b.textContent || '').trim() === '列表')
    if (btn) btn.click()
  })
  await page.waitForTimeout(2500)
  const listMark = await page.evaluate(() => {
    const table = document.querySelector('.wpb-table .el-table__body')
    if (!table) return { ok: false, why: 'no-table' }
    // 有进度的工序链:st-doing(进行中)/ st-done(已完成);只取「非未排产行」里的点
    const dots = [...table.querySelectorAll('.wpc-step.st-doing .wpc-dot, .wpc-step.st-done .wpc-dot')]
    if (!dots.length) return { ok: false, why: 'no-progress-dot', allDots: table.querySelectorAll('.wpc-dot').length }
    const dot = dots[0]
    dot.closest('tr')?.scrollIntoView({ block: 'center' })
    dot.setAttribute('data-e2e', 'target')
    // 同时找同一行里的检验小点(另起一次用例)
    const insDot = [...table.querySelectorAll('.wpc-ins')].find((el) => el.closest('tr') === dot.closest('tr'))
    if (insDot) insDot.setAttribute('data-e2e', 'insp')
    return {
      ok: true,
      allDots: table.querySelectorAll('.wpc-dot').length,
      progressDots: dots.length,
      rowText: (dot.closest('tr')?.textContent || '').replace(/\s+/g, ' ').slice(0, 120),
      hasInspDot: !!insDot,
    }
  })
  log('listView', listMark)
  if (listMark.ok) {
    await clickMarked('点击列表圆点')
    await page.waitForTimeout(5000)
    const jump = await page.evaluate(() => {
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
    out.cases.listView.jump = jump
    console.log('[listView.jump] ' + JSON.stringify(jump))
    await page.screenshot({ path: SHOT + '/round-02-c-list-dot-jump.png' })
  }
  if (listMark.hasInspDot) {
    await openBoard()
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.el-radio-button__inner')].find((b) => (b.textContent || '').trim() === '列表')
      if (btn) btn.click()
    })
    await page.waitForTimeout(2500)
    const insMark = await page.evaluate(() => {
      const table = document.querySelector('.wpb-table .el-table__body')
      const ins = [...table.querySelectorAll('.wpc-ins')]
        .find((el) => el.closest('.wpc-step')?.classList.contains('st-doing') || el.closest('.wpc-step')?.classList.contains('st-done'))
        || table.querySelector('.wpc-ins')
      if (!ins) return { ok: false }
      ins.closest('tr')?.scrollIntoView({ block: 'center' })
      ins.setAttribute('data-e2e', 'target')
      return { ok: true }
    })
    out.cases.listView.inspMark = insMark
    if (insMark.ok) {
      await clickMarked('点击列表检验小点')
      await page.waitForTimeout(6000)
      const r = await page.evaluate(() => ({
        hash: location.hash,
        bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(120, 420),
      }))
      out.cases.listView.inspAfter = r
      console.log('[listView.inspAfter] ' + JSON.stringify(r))
      await page.screenshot({ path: SHOT + '/round-02-c2-list-insp-dot.png' })
    }
  }
} catch (e) { log('listViewError', { msg: String(e.message || e) }) }

// ── ⑦ 回归：整行点击仍跳「生产工单」并定位 ────────────────────
try {
  await openBoard()
  const rows7 = await readBoard()
  const c7 = rows7[0]
  const markedRow = await page.evaluate(({ no }) => {
    const rows = [...document.querySelectorAll('.wpb-grid-body .wpb-grid-row')]
    const row = rows.find((el) => (el.querySelector('.wpb-no')?.textContent || '').trim() === no)
    if (!row) return { ok: false }
    row.querySelector('.wpb-cell').setAttribute('data-e2e', 'row')
    return { ok: true }
  }, { no: c7.no })
  log('rowClick', { picked: c7.no, marked: markedRow })
  if (markedRow.ok) {
    await page.click('[data-e2e="row"]', { label: '点击整行空白处', timeout: 8000 })
    await page.waitForTimeout(5500)
    const after = await page.evaluate(() => ({
      hash: location.hash,
      hasTraceDialog: !!document.querySelector('.wb-trace-head'),
      traceNo: (document.querySelector('.wb-trace-no')?.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    out.cases.rowClick.after = after
    console.log('[rowClick.after] ' + JSON.stringify(after))
    await page.screenshot({ path: SHOT + '/round-02-d-row-click-regression.png' })
  }
} catch (e) { log('rowClickError', { msg: String(e.message || e) }) }

console.log('=== FINAL ===')
console.log(JSON.stringify(out, null, 2))
