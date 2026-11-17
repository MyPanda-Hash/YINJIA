const task = await taskSpace('purin-whcalc')
const page = task.page('p1')

const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  carets[0].click(); await sleep(600); carets[0].click(); await sleep(700)

  const allocs = () => [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const setQty = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.blur()
  }
  const a = allocs()
  setQty(a[0].querySelector('.el-input-number input'), '3700')
  await sleep(600)
  const after = allocs()
  const q1 = after[0].querySelector('.el-input-number input')
  const q2 = after[1].querySelector('.el-input-number input')
  return {
    autoQ2: q2?.value,
    q2Disabled: q2?.disabled,
    q1: q1?.value,
    q1Disabled: q1?.disabled,
  }
})
console.log('CALC=' + JSON.stringify(res))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whcalc/c1-autocalc.png' })
