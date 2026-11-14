// round-16:把 ego 浏览器切回正式账套(YINJIA-MES)——之前的取证把它切到了测试库,不能留给用户
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

const before = await page.evaluate(() => (document.querySelector('.factory .factory-name') || {}).textContent || '')
console.log('当前工厂:', before)

if (String(before).includes('测试')) {
  await page.mouse.click(100, 18, { label: '打开账套下拉' }) // 左上角工厂名
  await page.waitForTimeout(1200)
  const items = await page.evaluate(() => [...document.querySelectorAll('.factory-item')]
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { t: (el.textContent || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    }))
  console.log('下拉项:', JSON.stringify(items))
  const target = items.find((i) => i.t === 'YINJIA-MES')
  if (target) {
    await page.mouse.click(target.x, target.y, { label: '选择正式账套' })
    await page.waitForTimeout(1500)
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
    await page.waitForTimeout(6000)
  }
}

const after = await page.evaluate(() => ({
  factory: (document.querySelector('.factory .factory-name') || {}).textContent || '',
  hash: location.hash,
}))
console.log('切回后:', JSON.stringify(after))
