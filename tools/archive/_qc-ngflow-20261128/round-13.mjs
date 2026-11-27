const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
const before = await page.evaluate(() => location.hash)
// 点「不合格品处理单 TCI-2026-11-0007」链接,验证真的跳得过去
await page.click('a.qr-nglink', { label: '点检验结论旁的处理单链接' })
await page.waitForTimeout(4500)
const after = await page.evaluate(() => ({
  hash: location.hash,
  paperTitle: [...document.querySelectorAll('[class*="as-title"]')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 3),
  hasDocNo: document.body.innerText.includes('TCI-2026-11-0007'),
}))
console.log('NAV', JSON.stringify({ before, ...after }, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-13-link-nav.png' })
