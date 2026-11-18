const task = await taskSpace(17)
const page = task.page('p1')
const before = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return [...document.querySelectorAll('[class*="factory"]')].map((el) => ({
    cls: el.className, tag: el.tagName, text: txt(el).slice(0, 60),
    visible: !!(el.offsetWidth || el.offsetHeight),
  }))
})
console.log('BEFORE ' + JSON.stringify(before, null, 2))
// 点顶部「登录工厂」徽标,展开下拉
const clicked = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const cands = [...document.querySelectorAll('[class*="factory"]')].filter((el) => !/factory-item/.test(el.className))
  const target = cands.find((el) => /登录工厂|YINJIA-MES/.test(txt(el)) && txt(el).length < 30) || cands[0]
  if (!target) return null
  target.click()
  return { cls: target.className, text: txt(target).slice(0, 40) }
})
console.log('CLICKED ' + JSON.stringify(clicked))
await page.waitForTimeout(1200)
const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return [...document.querySelectorAll('.factory-item, [class*="factory-item"], [class*="factory"]')].map((el) => ({
    cls: el.className, text: txt(el).slice(0, 50), visible: !!(el.offsetWidth || el.offsetHeight),
  })).slice(0, 12)
})
console.log('AFTER ' + JSON.stringify(after, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-06-factory-menu.png' })
