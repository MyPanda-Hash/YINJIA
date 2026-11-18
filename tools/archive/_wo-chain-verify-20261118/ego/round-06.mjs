// round-06: 列设置「固定位置」三页验证(测试库):工单排产 备注→固定右侧;生产工单 产品名称→固定左侧;订单结转 客户→固定左侧
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
  const found = await page.evaluate((lb) => {
    const row = [...document.querySelectorAll('.csd-item')].find((r) => ((r.querySelector('.csd-label') || {}).textContent || '').trim() === lb)
    if (!row) return false
    const w = row.querySelector('.csd-pin .el-select__wrapper')
    if (!w) return false
    w.click()
    return true
  }, label)
  if (!found) { console.log('pin row not found: ' + label); return false }
  await sleep(700)
  const ok = await page.evaluate((txt) => {
    const o = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null)
      .find((x) => (x.textContent || '').trim() === txt)
    if (!o) return false
    o.click()
    return true
  }, optionText)
  await sleep(500)
  console.log(`pin ${label} -> ${optionText}: ${ok}`)
  return ok
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
async function thInfo(labelPrefix) {
  return page.evaluate((p) => {
    const ths = [...document.querySelectorAll('.el-table__header th')]
    const idx = ths.findIndex((t) => (t.textContent || '').replace(/\s+/g, ' ').trim().startsWith(p))
    if (idx < 0) return { idx: -1 }
    const th = ths[idx]
    return { idx, text: (th.textContent || '').trim().slice(0, 20), cls: th.className, style: th.getAttribute('style') }
  }, labelPrefix)
}

// ── A) 工单排产:备注 → 固定右侧 ─────────────────────────────────────────────
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(5500)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('切炭2(自动)'))
  if (line) line.click()
})
await sleep(4000)
await openSettings()
await pin('备注', '固定右侧')
await save()
console.log('BOARD saved=' + JSON.stringify(await saved('WORK_ORDER_BOARD')))
console.log('BOARD 备注 th=' + JSON.stringify(await thInfo('备注')))
// 再刷新一次:确认 init 后仍按保存的设置渲染(不是只存在草稿里)
await page.reload({ timeout: 60000 })
await sleep(5500)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('切炭2(自动)'))
  if (line) line.click()
})
await sleep(4500)
console.log('BOARD 备注 th(after reload)=' + JSON.stringify(await thInfo('备注')))
try { await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-06-board-pin.png' }) } catch (e) { console.log('shot skip: ' + e.message) }

// ── B) 生产工单:产品名称 → 固定左侧 ────────────────────────────────────────
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
await openSettings()
await pin('产品名称', '固定左侧')
await save()
console.log('LIST saved=' + JSON.stringify(await saved('WORK_ORDER_LIST')))
console.log('LIST 产品名称 th=' + JSON.stringify(await thInfo('产品名称')))
console.log('LIST first 6 th=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-table__header th')].slice(0, 6).map((t) => (t.textContent || '').trim().slice(0, 12)))))
try { await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-06-list-pin.png' }) } catch (e) { console.log('shot skip: ' + e.message) }

// ── C) 订单结转:客户 → 固定左侧 ────────────────────────────────────────────
await page.goto('http://127.0.0.1:8091/#/prod/plan/orderConvert', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
await openSettings()
await pin('客户', '固定左侧')
await save()
console.log('OC saved=' + JSON.stringify(await saved('ORDER_CONVERT')))
console.log('OC 客户 th=' + JSON.stringify(await thInfo('客户')))
try { await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-06-oc-pin.png' }) } catch (e) { console.log('shot skip: ' + e.message) }
