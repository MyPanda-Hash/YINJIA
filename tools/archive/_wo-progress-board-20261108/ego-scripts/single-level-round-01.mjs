// 2026-11-09 单级审批 UI 验收:首件/制程 侧栏按钮 → 提交审批 → 审批通过(一次) → 弃审(测试账套)
const OUT = 'C:/Users/vigna/ego/insp-single-level-20261109'
const task = await taskSpace('insp-single-level-20261109')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8090/api'

async function apiLogin(factory) {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory }) })
  const j = await r.json()
  return j?.data?.token
}
async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
const txt = `(el) => (el?.textContent || '').replace(/\\s+/g, ' ').trim()`

// 测试库 token(显式注入,避免界面重登录串到正式库)
const token = await apiLogin('YJ_TEST')
await page.evaluate((t) => { localStorage.setItem('mes_token', t); localStorage.setItem('mes_locale', 'zh-CN') }, token)

// 打开首件检验单(直接带单号? 列表页默认最新单;用 ?focus= 若支持)
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)

// 找目标草稿单 SJ-2026-10-0153 并点开:列表里按单号搜索
async function openDocByNo(no) {
  await page.evaluate((target) => {
    const inputs = [...document.querySelectorAll('input')]
    const box = inputs.find((i) => (i.placeholder || '').includes('搜索') || (i.placeholder || '').includes('单据') || (i.placeholder || '').includes('模糊'))
    if (box) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(box, target)
      box.dispatchEvent(new Event('input', { bubbles: true }))
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
    }
  }, no)
  await page.waitForTimeout(2000)
  await page.evaluate((target) => {
    const cells = [...document.querySelectorAll('.el-table__body td')]
    const hit = cells.find((c) => (c.textContent || '').includes(target))
    if (hit) {
      const row = hit.closest('tr')
      const link = row?.querySelector('.doc-no-link, a, .el-link, [class*="doc-no"]')
      if (link) link.click(); else if (row) row.click()
    }
  }, no)
  await page.waitForTimeout(3000)
}
await openDocByNo('SJ-2026-10-0153')

async function sideButtons() {
  return page.evaluate(() => {
    const txtv = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const btns = [...document.querySelectorAll('.as-side-btn')].map((b) => ({ text: txtv(b), disabled: b.className.includes('disabled') }))
    const status = txtv(document.querySelector('.as-status, [class*="status"]'))
    return { hash: location.hash, btns, status, titles: [...document.querySelectorAll('.as-side-title')].map(txtv) }
  })
}
async function clickSide(label) {
  const ok = await page.evaluate((lab) => {
    const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === lab)
    if (b) { b.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(2500)
  // 可能弹确认框
  await page.evaluate(() => {
    const okBtn = [...document.querySelectorAll('.el-message-box__btns .el-button--primary, .el-dialog__footer .el-button--primary')].find((b) => b.offsetParent !== null)
    if (okBtn) okBtn.click()
  })
  await page.waitForTimeout(2500)
  return ok
}
async function currentStatusFromApi() {
  const r = await fetch(BASE + '/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ panelCode: 'QC_FIRST_INSP', keyword: 'SJ-2026-10-0153', pageNo: 1, pageSize: 5, condition: {} }) })
  const j = await r.json()
  const d = (j?.data?.list || [])[0] || {}
  return { 单据状态: d['单据状态'], 审核人: d['审核人'] || '', 审批人: d['审批人'] || '', 检验员: d['检验员'] || '' }
}

console.log('BEFORE:', JSON.stringify(await sideButtons(), null, 2), JSON.stringify(await currentStatusFromApi()))
await shot('round-01-draft.png')

console.log('click 提交审批 =', await clickSide('提交审批'))
await shot('round-02-submitted.png')
console.log('AFTER_SUBMIT:', JSON.stringify(await sideButtons(), null, 2), JSON.stringify(await currentStatusFromApi()))

console.log('click 审批通过 =', await clickSide('审批通过'))
await shot('round-03-approved.png')
console.log('AFTER_APPROVE:', JSON.stringify(await sideButtons(), null, 2), JSON.stringify(await currentStatusFromApi()))

console.log('click 弃审 =', await clickSide('弃审'))
await shot('round-04-unaudited.png')
console.log('AFTER_UNAUDIT:', JSON.stringify(await sideButtons(), null, 2), JSON.stringify(await currentStatusFromApi()))

// 制程面板同理(只看入口按钮,不再走一遍全流程)
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4000)
await openDocByNo('ZC-2026-10-0126')
console.log('PROC:', JSON.stringify(await sideButtons(), null, 2))
await shot('round-05-proc-draft.png')
console.log('ROUND_DONE')
