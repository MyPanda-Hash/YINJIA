const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
const st = await page.evaluate(() => ({
  hash: location.hash,
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  pageNo: (document.querySelector('.page-no')?.textContent || '').trim(),
  msgBox: [...document.querySelectorAll('.el-message-box')].filter((b) => b.offsetParent !== null).map((b) => (b.querySelector('.el-message-box__title')?.textContent || '').trim()),
}))
console.log(JSON.stringify(st, null, 2))
