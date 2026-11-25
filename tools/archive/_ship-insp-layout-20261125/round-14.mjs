// 第 14 轮:先看页面状态,再点「已完成」并选单据
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const st = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    title: document.title,
    tabs: [...document.querySelectorAll('.rail-status-tabs *, [class*="status-tab"], .doc-rail-tab')].map(txt).filter(Boolean).slice(0, 12),
    bodyHead: txt(document.body).slice(0, 160),
    sheet: !!document.querySelector('.qr-sheet'),
    login: !!document.querySelector('input[placeholder*="账号"]'),
  }
})
console.log(JSON.stringify(st, null, 1))
