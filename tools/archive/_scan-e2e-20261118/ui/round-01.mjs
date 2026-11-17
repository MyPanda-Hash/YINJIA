const task = await taskSpace('scan-e2e-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  url: location.href,
  title: document.title,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  inputs: [...document.querySelectorAll('input')].slice(0, 8).map((i) => ({ ph: i.placeholder, type: i.type })),
  buttons: [...document.querySelectorAll('button')].slice(0, 12).map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  focusTag: (document.activeElement && document.activeElement.tagName) || '',
  focusPh: (document.activeElement && document.activeElement.placeholder) || '',
})), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/round-01.png' })
