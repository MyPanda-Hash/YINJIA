// round-02: 顶栏「账套」切到测试库(YJ_TEST),需要密码重登
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(4000)

const cur = await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim())
console.log('当前账套 =', cur)
if (cur.includes('测试库')) { console.log('已经是测试库,跳过切换'); }
else {
  // 点顶栏账套下拉
  await page.evaluate(() => {
    const t = document.querySelector('.factory .el-dropdown, .factory')
    if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(800)
  const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')].map((el) => (el.textContent || '').trim()))
  console.log('下拉项 =', JSON.stringify(items))
  // 悬停展开(el-dropdown trigger=hover):用 mouse.move 更稳 —— 先试点击后再看;仍无项则 hover
  if (!items.length) {
    const box = await page.evaluate(() => {
      const r = document.querySelector('.factory').getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.move(box.x, box.y)
    await page.waitForTimeout(800)
    console.log('hover 后下拉项 =', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')].map((el) => (el.textContent || '').trim()))))
  }
  const clicked = await page.evaluate(() => {
    const it = [...document.querySelectorAll('.el-dropdown-menu__item')].find((el) => (el.textContent || '').includes('测试库'))
    if (it) { it.click(); return (it.textContent || '').trim() }
    return null
  })
  console.log('点击目标 =', clicked)
  await page.waitForTimeout(1200)
  const dlg = await page.evaluate(() => document.querySelector('.el-dialog')?.textContent?.replace(/\s+/g, ' ').trim() || null)
  console.log('弹窗 =', dlg)
  if (dlg && dlg.includes('切换账套')) {
    await page.evaluate(() => {
      const setVal = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const inp = [...document.querySelectorAll('.el-dialog input')].find((i) => (i.placeholder || '').includes('密码'))
      if (inp) setVal(inp, '123456')
    })
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.el-dialog button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
      if (btn) btn.click()
    })
    await page.waitForTimeout(6000)
  }
  console.log('切换后账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-02-factory.png' })
console.log('done round-02')
