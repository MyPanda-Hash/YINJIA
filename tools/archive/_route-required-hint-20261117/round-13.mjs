const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')

const info = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  return {
    msgBox: box ? (box.querySelector('.el-message-box__title')?.textContent || '').trim() : null,
    msg: box ? (box.querySelector('.el-message-box__message')?.textContent || '').replace(/\s+/g, ' ').trim() : null,
    btns: box ? [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) : [],
    doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
    rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
  }
})
console.log(JSON.stringify(info, null, 2))

// 选「不保存」继续(只是把弹出的未保存守卫关掉,后面重新走一次加行)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  const b = box ? [...box.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '不保存') : null
  if (b) b.click()
})
await page.waitForTimeout(2500)
console.log('after:', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
}))))
