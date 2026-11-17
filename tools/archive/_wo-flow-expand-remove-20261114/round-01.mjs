// 2026-11-14 验收:工单排产 / 生产工单 的「工序流转明细」展开大表已删除
//   ① 表格不再有 expand 列 / 展开箭头,页面不再有 .wb-flow-tbl / .wol-flow-tbl
//   ② 逐道数字改为「当前工序」格的悬停提示(title:▶ = 当前工序)
//   ③ 生产工序进度看板 → 工单排产 深链定位仍生效:行高亮 + 「已定位」提示 + 提示里定位工序打 ★
// 运行:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/wo-flow-expand-remove-20261114/round-01.mjs')"
const OUT = 'C:/Users/vigna/ego/wo-flow-expand-remove-20261114'
const task = await taskSpace('wo-flow-expand-remove-20261114')
const page = task.page('p1')
const BOARD = 'http://localhost:5173/#/prod/plan/workOrderBoard'
const LIST = 'http://localhost:5173/#/prod/plan/workOrderList'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
      await page.waitForTimeout(300)
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 0, top: 0, width: 1440, height: 900 } })
    }
    await page.waitForTimeout(900)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function ensureLogin(url) {
  await page.goto(url, { timeout: 40000 })
  await page.waitForTimeout(3500)
  const needLogin = await page.evaluate(() => !localStorage.getItem('mes_token'))
  if (needLogin) {
    await page.evaluate(() => {
      const setVal = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const ins = [...document.querySelectorAll('input')]
      const u = ins.find((i) => (i.placeholder || '').includes('账号'))
      const p = ins.find((i) => (i.placeholder || '').includes('密码'))
      if (u) setVal(u, 'admin')
      if (p) setVal(p, '123456')
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入'))
      if (btn) btn.click()
    })
    await page.waitForTimeout(5500)
    await page.goto(url, { timeout: 40000 })
    await page.waitForTimeout(4500)
  }
}
/** 表格层面:有没有 expand 列、有没有旧展开表、当前工序格有没有 title */
async function tableProbe(tableSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel)
    const heads = [...document.querySelectorAll(sel + ' .el-table__header-wrapper th')].map((th) => (th.textContent || '').trim())
    const idx = heads.findIndex((h) => h.startsWith('当前工序'))
    const rows = [...document.querySelectorAll(sel + ' .el-table__body tr')]
    const samples = []
    for (const tr of rows.slice(0, 6)) {
      const tds = tr.querySelectorAll('td')
      const td = idx >= 0 ? tds[idx] : null
      if (!td) continue
      const title = (td.querySelector('[title]')?.getAttribute('title') || td.getAttribute('title') || '').trim()
      samples.push({ text: (td.textContent || '').trim(), title })
    }
    return {
      hasTable: !!root,
      expandIcons: document.querySelectorAll(sel + ' .el-table__expand-icon').length,
      expandColumns: document.querySelectorAll(sel + ' .el-table__expand-column').length,
      flowTables: document.querySelectorAll('.wb-flow-tbl, .wol-flow-tbl').length,
      flowBoxes: document.querySelectorAll('.wb-flow-box, .wol-flow-box').length,
      headerHasCurrentOp: idx >= 0,
      headFirst5: heads.slice(0, 6),
      rows: rows.length,
      rowsWithTitle: samples.filter((s) => s.title).length,
      samples,
    }
  }, tableSel)
}

// ═══ ① 工单排产:选一条有工单的线,看表格 ═══
await ensureLogin(BOARD)
await restoreWindow()
// 左侧产线骨架:优先点「3号机」(截图里那条),没有就点第一条
const picked = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')]
  const hit = lines.find((el) => (el.textContent || '').includes('3号机')) || lines[0]
  if (!hit) return null
  hit.click()
  return (hit.textContent || '').replace(/\s+/g, ' ').trim()
})
await page.waitForTimeout(4500)
const board = await tableProbe('.wb-block .el-table')
console.log('=== 工单排产 line=' + picked + ' ===')
console.log(JSON.stringify(board, null, 2))
await page.screenshot({ path: OUT + '/round-01-board.png' })

// ═══ ② 深链定位(模拟从生产工序进度看板点某道工序跳来)═══
const wo = (board.samples || []).map((s) => s.text).length ? 'GD-2026-11-0021' : ''
const deep = BOARD + '?line=' + encodeURIComponent('3号机') + '&wo=' + encodeURIComponent(wo) + '&op=' + encodeURIComponent('成型')
await page.goto(deep, { timeout: 40000 })
await page.waitForTimeout(6000)
const focusProbe = await page.evaluate(() => {
  const tip = document.querySelector('.wb-focus-tip')
  const tr = document.querySelector('.el-table__body tr.wb-focus-row')
  let curTitle = ''
  if (tr) {
    const tds = [...tr.querySelectorAll('td')]
    const t = tds.map((td) => td.querySelector('[title]')?.getAttribute('title') || '').find((v) => v.includes('计划量'))
    curTitle = t || ''
  }
  return {
    tip: tip ? (tip.textContent || '').trim() : '',
    focusedRows: document.querySelectorAll('.el-table__body tr.wb-focus-row').length,
    curTitleHasStar: curTitle.includes('★'),
    curTitle: curTitle,
    urlQueryCleared: location.hash.includes('?line=') === false,
  }
})
console.log('=== 深链定位 ===')
console.log(JSON.stringify(focusProbe, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-02-deeplink.png' })

// ═══ ③ 生产工单页:同一套删除 + 悬停提示 ═══
await page.goto(LIST, { timeout: 40000 })
await page.waitForTimeout(7000)
const list = await tableProbe('.wol-table')
console.log('=== 生产工单 ===')
console.log(JSON.stringify(list, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-list.png' })

// ═══ 结论 ═══
const verdict = {
  '工单排产_无展开列': board.expandIcons === 0 && board.expandColumns === 0,
  '工单排产_无旧展开表': board.flowTables === 0 && board.flowBoxes === 0,
  '工单排产_当前工序有悬停提示': board.rowsWithTitle > 0,
  '生产工单_无展开列': list.expandIcons === 0 && list.expandColumns === 0,
  '生产工单_无旧展开表': list.flowTables === 0 && list.flowBoxes === 0,
  '生产工单_当前工序有悬停提示': list.rowsWithTitle > 0,
  '深链定位_已定位提示': focusProbe.tip.length > 0,
  '深链定位_行高亮': focusProbe.focusedRows === 1,
  '深链定位_提示里定位工序有星标': focusProbe.curTitleHasStar,
}
console.log('=== VERDICT ===')
console.log(JSON.stringify(verdict, null, 2))
console.log(verdict && Object.values(verdict).every(Boolean) ? 'RESULT: PASS' : 'RESULT: FAIL')
