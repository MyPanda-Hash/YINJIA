// round-25:测试库草稿上验证「底层合并格 = 全表共用」:两行 + 合并格文本 → 保存
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
// 两行
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
  await page.waitForTimeout(700)
}
// 填两行的「检验项目」+ 合并格
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('table.rs-dt tbody tr')].filter((tr) => tr.querySelectorAll('td.rs-td').length >= 6)
  const marks = ['外观-验证A', '尺寸-验证B']
  const out = []
  rows.slice(-2).forEach((tr, i) => {
    const tds = [...tr.querySelectorAll('td.rs-td')]
    const ta = tds[1] && tds[1].querySelector('textarea')
    if (ta) { setVal(ta, marks[i]); out.push(marks[i]) }
  })
  const ff = document.querySelector('.rsp-footer-field textarea')
  if (ff) {
    setVal(ff, '【合并格验证】1. 暂停该批次继续生产 2. 100% 全检并隔离 3. 复核检验方法')
    out.push('footer-filled')
  }
  return { out, rows: rows.length, footer: ff ? ff.value.slice(0, 40) : null }
})
console.log('filled:', JSON.stringify(filled))
await page.waitForTimeout(800)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-25-before-save.png' })
// 保存
const saved = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.as-side-btn')]
  const b = btns.find((e) => (e.textContent || '').trim() === '保存')
  if (b) { b.click(); return true }
  return btns.map((e) => (e.textContent || '').trim())
})
console.log('save clicked:', JSON.stringify(saved))
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message, .el-message__content')].map((e) => (e.textContent || '').trim()),
  msgboxes: [...document.querySelectorAll('.el-message-box')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').slice(0, 200)),
  docNoInPage: (document.body.innerText.match(/IP-\d{4}-\d{2}-\d{2}-\d{4}/) || [])[0] || null,
  sideStatus: [...document.querySelectorAll('.as-side-status, .as-status')].map((e) => (e.textContent || '').trim()),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-25-after-save.png' })
