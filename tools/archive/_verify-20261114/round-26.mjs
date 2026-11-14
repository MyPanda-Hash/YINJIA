// round-26 — B3 增删块 + B4 填满一块 → 保存(测试库)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
const countBlocks = () => page.evaluate(() => ({
  blocks: document.querySelectorAll('.lp-grid tbody tr.is-block-first').length,
  rows: document.querySelectorAll('.lp-row').length,
  btnsPlus: document.querySelectorAll('.lp-btn:not(.is-del)').length,
  btnsDel: document.querySelectorAll('.lp-btn.is-del').length,
}))

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(7000)
const before = await page.evaluate(() => ({ hash: location.hash, factory: (document.querySelector('.factory-name')?.textContent || '').trim(), sheet: !!document.querySelector('.lp-sheet') }))
console.log('BEFORE=' + JSON.stringify(before))

const newClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '新增')
  if (b) b.click()
  return !!b
})
console.log('NEW=' + newClicked)
await page.waitForTimeout(7000)
const c0 = await countBlocks()
console.log('BLOCKS0=' + JSON.stringify(c0))

// —— B3: ＋ 多一块 ——
const add = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.lp-btn:not(.is-del)')][0]
  if (b) b.click()
  return !!b
})
await page.waitForTimeout(1200)
const c1 = await countBlocks()
console.log('ADD=' + JSON.stringify({ clicked: add, ...c1 }))

// —— B3: × 删掉最后一块 ——
const del = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.lp-btn.is-del')]
  const b = btns[btns.length - 1]
  if (b) b.click()
  return !!b
})
await page.waitForTimeout(1200)
const c2 = await countBlocks()
console.log('DEL=' + JSON.stringify({ clicked: del, ...c2 }))

// —— B4: 填满第一块 ——
const filled = await page.evaluate(() => {
  function setVal(el, v) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const out = {}
  const putBlock = (key, v) => {
    const cell = document.querySelector(`.lp-block[data-lp="${key}"]`)
    const inp = cell && cell.querySelector('input')
    if (!inp) { out[key] = 'NO_INPUT'; return }
    setVal(inp, v); out[key] = inp.value
  }
  const putProd = (field, v) => {
    const cell = document.querySelector(`.lp-prod[data-lp="${field}"]`)
    const inp = cell && cell.querySelector('input')
    if (!inp) { out[field] = 'NO_INPUT'; return }
    setVal(inp, v); out[field] = inp.value
  }
  putBlock('巡线时间', '08:30')
  putBlock('车间', '成型一车间')
  putBlock('两液密度', '1.02')
  putBlock('表面状态', '合格')
  putBlock('跌落强度', '合格')
  putBlock('抗压强度', '合格')
  putBlock('结果判定', '合格')
  putBlock('巡线人员', '张工')
  putProd('编号1', 'A001'); putProd('型号1', 'T410-63*40*193')
  putProd('长度标准1', '193'); putProd('长度实测1', '193.0')
  putProd('内径标准1', '40'); putProd('内径实测1', '40.0')
  putProd('重量标准1', '63'); putProd('重量实测1', '63.0')
  putProd('编号2', 'A002'); putProd('型号2', 'T410-63*40*193')
  putProd('长度标准2', '193'); putProd('长度实测2', '192.5')
  putProd('内径标准2', '40'); putProd('内径实测2', '39.8')
  putProd('重量标准2', '63'); putProd('重量实测2', '62.7')
  return out
})
console.log('FILLED=' + JSON.stringify(filled))
await page.waitForTimeout(1000)

// —— 保存 ——
await page.evaluate(() => {
  window.__msgs = []
  new MutationObserver(() => {
    document.querySelectorAll('.el-message').forEach((m) => {
      const t = (m.textContent || '').replace(/\s+/g, ' ').trim()
      if (t && !window.__msgs.includes(t)) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '保存')
  if (b) b.click()
})
await page.waitForTimeout(9000)
const afterSave = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    msgs: window.__msgs || [],
    docNos: (document.body.innerText || '').match(/XJ-\d{4}-\d{2}-\d{4}/g)?.slice(0, 5) || [],
    firstRail: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 3).map((x) => txt(x)),
    blocks: document.querySelectorAll('.lp-grid tbody tr.is-block-first').length,
  }
})
console.log('AFTER_SAVE=' + JSON.stringify(afterSave, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-26-patrol-saved.png', fullPage: true })
await fs.writeFile(OUT + '/b3b4-save.json', JSON.stringify({ before, newClicked, c0, c1, c2, filled, afterSave }, null, 1), 'utf8')
console.log('DONE round-26')
