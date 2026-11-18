// round-03 诊断:检验委托单纸面为何找不到「选择检验项目」按钮
const TASK = 'sample-catalog-rev-20261117'
const task = await taskSpace(TASK)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(4500)
const st = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet="INSP_COMMISSION"]')
  const btn = document.querySelector('.ic-pick-btn')
  const rows = [...document.querySelectorAll('tbody tr')].length
  return {
    hash: location.hash,
    hasSheet: !!sheet,
    sheetClass: sheet ? sheet.className : null,
    hasPickBtn: !!btn,
    pickBtnDisplay: btn ? getComputedStyle(btn).display : null,
    toolbar: [...document.querySelectorAll('.func-zone button, .topbar button, .toolbar button')].map((b) => (b.textContent || '').trim()).slice(0, 40),
    bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
  }
})
console.log(JSON.stringify(st, null, 2))
