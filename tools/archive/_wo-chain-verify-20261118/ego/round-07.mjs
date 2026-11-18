// round-07: 取消固定(三页各回「不固定」,同时验证取消固定能保存生效)
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function openSettings() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '列设置')
    if (b) b.click()
  })
  await sleep(1200)
}
async function pin(label, optionText) {
  await page.evaluate((lb) => {
    const row = [...document.querySelectorAll('.csd-item')].find((r) => ((r.querySelector('.csd-label') || {}).textContent || '').trim() === lb)
    if (row) row.querySelector('.csd-pin .el-select__wrapper').click()
  }, label)
  await sleep(700)
  await page.evaluate((txt) => {
    const o = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null)
      .find((x) => (x.textContent || '').trim() === txt)
    if (o) o.click()
  }, optionText)
  await sleep(500)
}
async function save() {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const b = [...(d ? d.querySelectorAll('button') : [])].find((x) => (x.textContent || '').trim() === '保存')
    if (b) b.click()
  })
  await sleep(2200)
}
async function saved(panel) {
  return page.evaluate(async (code) => {
    const t = localStorage.getItem('mes_token')
    const r = await fetch('/api/px/reportColumnSettings?panelCode=' + code, { headers: { Authorization: 'Bearer ' + t } })
    const j = await r.json()
    const cols = (j && (j.data || j).columns) || []
    return cols.filter((c) => c.pin).map((c) => ({ prop: c.prop, pin: c.pin }))
  }, panel)
}
async function thInfo(p) {
  return page.evaluate((prefix) => {
    const ths = [...document.querySelectorAll('.el-table__header th')]
    const th = ths.find((t) => (t.textContent || '').replace(/\s+/g, ' ').trim().startsWith(prefix))
    return th ? { cls: th.className, style: th.getAttribute('style') } : null
  }, p)
}

await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(5500)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('切炭2(自动)'))
  if (line) line.click()
})
await sleep(4000)
await openSettings()
await pin('备注', '不固定')
await save()
console.log('BOARD saved=' + JSON.stringify(await saved('WORK_ORDER_BOARD')) + ' th=' + JSON.stringify(await thInfo('备注')))

await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
await openSettings()
await pin('产品名称', '不固定')
await save()
console.log('LIST saved=' + JSON.stringify(await saved('WORK_ORDER_LIST')) + ' th=' + JSON.stringify(await thInfo('产品名称')))

await page.goto('http://127.0.0.1:8091/#/prod/plan/orderConvert', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
await openSettings()
await pin('客户', '不固定')
await save()
console.log('OC saved=' + JSON.stringify(await saved('ORDER_CONVERT')) + ' th=' + JSON.stringify(await thInfo('客户')))
