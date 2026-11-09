const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const out = {}

// ① 加标水手机页(测试库无单据 → 新建态):应有一行明细 + 「本行照片」区
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_SPIKE_WATER', { timeout: 30000 })
await page.waitForTimeout(5000)
out.mobileSpike = await page.evaluate(() => ({
  title: document.querySelector('.labm-title')?.textContent?.trim(),
  rows: document.querySelectorAll('.labm-drow').length,
  rowPhotoHeads: [...document.querySelectorAll('.labm-rowphoto-title')].map((e) => e.textContent.trim()),
  rowPhotoHint: [...document.querySelectorAll('.labm-rowphoto-hint')].map((e) => e.textContent.trim()),
  detailFields: [...document.querySelectorAll('.labm-drow .labm-field > label')].map((e) => e.textContent.trim()).slice(0, 5),
}))

// ② 加标水电脑端纸面:数据表末尾应自动多出「手机照片」列(加标水的列集来自标准库模版,配置里没写这列)
await page.goto('http://localhost:5173/#/panelx/list/RD_SPIKE_WATER', { timeout: 30000 })
await page.waitForTimeout(9000)
out.pcSpike = await page.evaluate(() => ({
  titleDocNo: document.querySelector('.rsp-title-docno')?.textContent?.trim() || '',
  headers: [...document.querySelectorAll('.rs-th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(-4),
  fileColHead: [...document.querySelectorAll('.rs-th')].some((e) => (e.textContent || '').trim() === '手机照片'),
  fileCells: document.querySelectorAll('.rs-file-cell').length,
}))
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-69-spikewater.png' })
