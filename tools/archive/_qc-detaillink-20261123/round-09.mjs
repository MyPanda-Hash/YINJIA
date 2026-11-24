// round-09.mjs —— 深链兜底「只用一次」的反向验证:落地后用户自己切左栏页签,不能被兜底抢回「全部」
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const ASM = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP_DETAIL'
await page.goto(ASM, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(ASM, { timeout: 30000 })
}
for (let i = 0; i < 25; i++) {
  const n = await page.evaluate(() => document.querySelectorAll('.report-table .el-table__body tr').length)
  if (n > 0) break
  await page.waitForTimeout(1000)
}
// 点「单据编号」跳一张已审核单(会触发「退回全部」兜底)
const picked = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const tr = table.querySelectorAll('.el-table__body tr')[0]
  const cell = tr.children[heads.indexOf('单据编号')]
  const no = (cell.innerText || '').trim()
  cell.querySelector('.doc-no-link').click()
  return no
})
await page.waitForTimeout(9000)
const landed = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.as-side-nav .doc-status, .doc-status')].map((el) => ({ t: (el.innerText || '').trim(), on: el.classList.contains('on') }))
  return { hash: location.hash, activeTab: tabs.find((x) => x.on)?.t || '', tabs: tabs.slice(0, 5) }
})
// 手动切到「未完成」
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-status')].find((x) => (x.innerText || '').trim() === '未完成')
  el?.click()
})
await page.waitForTimeout(5000)
const afterSwitch = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.doc-status')].map((el) => ({ t: (el.innerText || '').trim(), on: el.classList.contains('on') }))
  const cnt = (document.body.innerText.match(/共有数据\s*(\d+)\s*条/) || [])[1] || ''
  return { activeTab: tabs.find((x) => x.on)?.t || '', count: cnt }
})
console.log(JSON.stringify({ picked, landed, afterSwitch, hijacked: afterSwitch.activeTab !== '未完成' }, null, 2))
await task.finish({ keep: [] })
