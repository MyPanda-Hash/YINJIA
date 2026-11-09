const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const probe = await page.evaluate(() => ({
  sheets: document.querySelectorAll('.rsp-sheet').length,
  recordSheet: document.querySelectorAll('.record-sheet').length,
  plainTitle: [...document.querySelectorAll('.rsp-plain-title, .rsp-title, .rsp-subtitle')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 5),
  hasPhoneText: (document.body.innerText || '').includes('手机照片'),
  attachEls: document.querySelectorAll('[class*=attach]').length,
  attachClasses: [...document.querySelectorAll('[class*=attach]')].map((e) => e.className).slice(0, 10),
  headPairs: [...document.querySelectorAll('.rs-label')].map((e) => (e.textContent || '').trim()).slice(0, 12),
}))
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-17.png' })
