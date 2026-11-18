const task = await taskSpace(17)
const page = task.page('p1')
const items = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return [...document.querySelectorAll('.factory-item')].map((el) => {
    const r = el.getBoundingClientRect()
    return { text: txt(el), x: r.x, y: r.y, w: r.width, h: r.height }
  })
})
const target = items.find((i) => i.text.includes('测试库'))
console.log('TARGET ' + JSON.stringify(target))
if (target) await page.mouse.click(target.x + target.w / 2, target.y + target.h / 2, { label: 'switch to test factory' })
await page.waitForTimeout(6000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const f = document.querySelector('.factory-name')
  return {
    hash: location.hash,
    factory: txt(f),
    badge: txt(document.querySelector('.topbar')),
    body: txt(document.body).slice(0, 200),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-08-test-factory.png' })
