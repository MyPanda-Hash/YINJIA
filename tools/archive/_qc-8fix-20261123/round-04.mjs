// round-04: 找「新增」入口 & 当前单据状态
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
const info = await page.evaluate(() => ({
  hash: location.hash,
  btns: [...document.querySelectorAll('button, .el-button, .op-btn, [class*="btn"]')].map((b) => ({
    t: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24),
    c: b.className && String(b.className).slice(0, 60),
  })).filter((x) => x.t).slice(0, 80),
  statusText: [...document.querySelectorAll('.el-tag')].map((x) => (x.innerText || '').trim()).slice(0, 10),
  rightBar: (document.querySelector('.panelx-list')?.innerText || '').split('本单操作')[1]?.slice(0, 400),
}))
console.log(JSON.stringify(info, null, 1))
