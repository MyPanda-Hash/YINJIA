const task = await taskSpace('scan-align-20261118')
const page = task.page('p1')
const shots = 'C:/Users/Lenovo/ego/scan-align-20261118/'
const out = {}

async function clickOpen() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '打开单据')
    if (b) b.click()
  })
  await page.waitForTimeout(3200)
}

// ① 领料:扫「工单码」(三段)⇒ 弹窗选 组装/混料
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.fill('input[placeholder*="扫工单号"]', '0@GD-2026-11-0010@1003')
await page.waitForTimeout(300)
await clickOpen()
out.pickDialog = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  return {
    hasDialog: !!dlg,
    title: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : '',
    items: [...document.querySelectorAll('.pk-item')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  }
})
await page.screenshot({ path: shots + 'round-02-pick-dialog.png' })

// ② 点「混料」那一条 ⇒ 应打开混料单(id 857 / LL-…0048)
if (out.pickDialog.items.length) {
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.pk-item')]
    const mix = items.find((x) => (x.innerText || '').includes('混料'))
    if (mix) mix.click()
  })
  await page.waitForTimeout(3500)
  out.pickAfterChoose = await page.evaluate(() => ({
    hash: location.hash,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
  }))
}

// ③ 退料:扫一张**已审核可退**的领料单码(LL-2026-11-0006 = GD-2026-10-0217 #10)⇒ 直接选中并可退料
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.fill('input[placeholder*="扫领料单码"]', '0@GD-2026-10-0217@1010@A')
await page.waitForTimeout(300)
await clickOpen()
await page.waitForTimeout(2500)
out.returnScan = await page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 460),
  workArea: !!document.querySelector('.mr-lines'),
  curNo: (document.querySelector('.mr-cur-no')?.textContent || '').trim(),
}))
await page.screenshot({ path: shots + 'round-02-return-selected.png' })

console.log(JSON.stringify(out, null, 2))
