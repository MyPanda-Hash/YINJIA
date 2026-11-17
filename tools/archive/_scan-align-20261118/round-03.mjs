const task = await taskSpace('scan-align-20261118')
const page = task.page('p1')
const shots = 'C:/Users/Lenovo/ego/scan-align-20261118/'
const out = {}

async function shot(code, file) {
  await page.goto('http://localhost:5173/#/panelx/list/' + code, { timeout: 30000 })
  await page.waitForTimeout(3500)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { /* skip */ }
  const info = await page.evaluate(() => {
    const bar = document.querySelector('.mp-top, .mr-top, .mm-top, .mo-top')
    const ae = document.activeElement
    return {
      topBar: bar ? (bar.innerText || '').replace(/\s+/g, ' ').trim() : '(无顶栏)',
      scanInput: !!([...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('扫'))),
      focusPh: ae ? ae.placeholder || ae.tagName : '',
    }
  })
  await page.screenshot({ path: shots + file })
  return info
}

out.pick = await shot('MOBILE_PICK', 'round-03-pick.png')
out.ret = await shot('MOBILE_RETURN', 'round-03-return.png')
out.otherPick = await shot('MOBILE_OTHER_PICK', 'round-03-other-pick.png')
out.otherRet = await shot('MOBILE_OTHER_RET', 'round-03-other-ret.png')
out.mix = await shot('MOBILE_MIX_SCAN', 'round-03-mix.png')
out.report = await shot('MOBILE_REPORT', 'round-03-report.png')
console.log(JSON.stringify(out, null, 2))
