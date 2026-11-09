const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 电脑端纸面:标题右下角单号 + 表格里的「手机照片」列(逐行附件格)
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(10000)
const pc = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.rs-th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.rs-dt tbody tr')].slice(-3).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return {
    pager: document.querySelector('.as-side-pager .page-no')?.textContent?.trim(),
    titleDocNo: document.querySelector('.rsp-title-docno')?.textContent?.trim() || '',
    headers: th.slice(-6),
    fileCells: document.querySelectorAll('.rs-file-cell').length,
    chips: [...document.querySelectorAll('.rs-file-cell .fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    uploadBtns: document.querySelectorAll('.rs-file-cell .fac-upload-btn').length,
    lastRows: rows,
  }
})
console.log(JSON.stringify(pc, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-68-pc-rowphoto.png' })
