const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
// ① 点「保存」看必填拦截:应一次点亮多个缺失格 + 汇总提示
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn, button')].find((x) => (x.textContent || '').trim() === '保存')
  if (!b) return 'NO_BTN'
  b.click(); return 'CLICKED'
})
console.log('保存点击 =', clicked)
await page.waitForTimeout(2500)
const res = await page.evaluate(() => ({
  msg: [...document.querySelectorAll('.el-message, .el-message__content')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 3),
  focusCount: document.querySelectorAll('.rs-focus').length,
  focusLabels: [...document.querySelectorAll('.rs-focus')].slice(0, 8).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)),
}))
console.log('拦截结果 =', JSON.stringify(res, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-required-highlight.png' })
console.log('shot =', shot)
