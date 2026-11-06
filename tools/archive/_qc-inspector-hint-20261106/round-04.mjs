const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 45000 })
await page.waitForTimeout(9000)

function readSign() {
  return page.evaluate(() => {
    const signRow = [...document.querySelectorAll('table tr')].find((r) => (r.innerText || '').includes('检验人'))
    const span = signRow && signRow.querySelector('.qr-sign')
    const mat = (document.querySelectorAll('.qr-value-code .qr-ref-text')[0]?.innerText || '').trim()
    return { text: span ? (span.innerText || '').trim() : null, title: span ? span.getAttribute('title') : null, mat }
  })
}

let found = null
for (let i = 0; i < 40; i++) {
  const s = await readSign()
  if (s.text && s.text !== 'admin' && !/^[\u4e00-\u9fa5A-Za-z]{1,6}$/.test(s.text)) {
    found = s
    break
  }
  // 空值时 text = 提示语(中文长句),先按"是否等于提示语"判
  if (s.text === '新增时按登录人生成') { found = s; break }
  await page.evaluate(() => {
    const next = [...document.querySelectorAll('.page-btn')].find((b) => b.getAttribute('title') === '下一张')
    if (next) next.click()
  })
  await page.waitForTimeout(900)
  if (i % 10 === 0) console.log('step ' + i + ': ' + JSON.stringify(s))
}
console.log('命中: ' + JSON.stringify(found))

// 再往前翻几张,确认提示语文字与 title
for (let i = 0; i < 3; i++) {
  console.log('  ' + JSON.stringify(await readSign()))
  await page.evaluate(() => {
    const next = [...document.querySelectorAll('.page-btn')].find((b) => b.getAttribute('title') === '下一张')
    if (next) next.click()
  })
  await page.waitForTimeout(900)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-inspector-hint-20261106/round-04.png' })
