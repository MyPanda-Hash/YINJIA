// round-17:精确坐标把 ego 浏览器切回正式账套
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

const f = await page.evaluate(() => {
  const el = document.querySelector('.factory')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), name: (el.textContent || '').trim() }
})
console.log('工厂元素:', JSON.stringify(f))
if (f) {
  await page.mouse.click(f.x, f.y, { label: '打开账套下拉' })
  await page.waitForTimeout(1500)
  const items = await page.evaluate(() => [...document.querySelectorAll('.factory-item')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { t: (el.textContent || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    }))
  console.log('可见下拉项:', JSON.stringify(items))
  const t = items.find((i) => i.t === 'YINJIA-MES')
  if (t) {
    await page.mouse.click(t.x, t.y, { label: '选择正式账套' })
    await page.waitForTimeout(1800)
    await page.evaluate(() => {
      const setVal = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const inp = document.querySelector('.el-dialog input')
      if (inp) setVal(inp, '123456')
      const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('切换'))
      if (btn) btn.click()
    })
    await page.waitForTimeout(7000)
  }
}
const after = await page.evaluate(() => ({ factory: (document.querySelector('.factory .factory-name') || {}).textContent || '', hash: location.hash }))
console.log('切回后:', JSON.stringify(after))
