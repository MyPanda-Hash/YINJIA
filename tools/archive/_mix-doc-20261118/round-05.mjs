/**
 * round-05:全部确认后**提交并打印** → 生成混料单(PL…)+ 自动打印 + 跳到只读明细。
 *
 * ⚠ 本机没有打印机/打印代理,`window.print()` 会弹系统打印对话框把自动化卡住 ⇒
 * 这里把它替换成空函数(只影响本次验证的"出纸"这一步,单据落库与跳转照常走真实链路)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)

// 断言前置:两项已确认、提交按钮可点(上一轮确认过的记录还在库里)
const before = await page.evaluate(() => ({
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('混料进度')) || '',
  submitDisabled: (() => { const b = document.querySelector('.mp-foot button'); return b ? !!b.disabled : null })(),
}))
console.log('== 提交前 ==')
console.log(JSON.stringify(before, null, 2))
if (before.submitDisabled !== false) {
  console.log('!! 提交按钮不可点,停止(说明确认没落库)')
  process.exit(0)
}

await page.evaluate(() => { window.print = () => { window.__yjPrintStubbed = true } })
await page.click('.mp-foot button')
await page.waitForTimeout(1200)
// 提交确认框(与生产领料同一道 ElMessageBox)
const boxText = await page.evaluate(() => (document.querySelector('.el-message-box') || {}).innerText || '')
console.log('== 提交确认框 ==')
console.log(JSON.stringify(boxText.replace(/\s+/g, ' ').trim(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-05-confirm-box.png' })

await page.click('.el-message-box__btns button.el-button--primary')
await page.waitForTimeout(4000)

const after = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  readonly: !!document.querySelector('.mp-ro'),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  footButtons: [...document.querySelectorAll('.mp-foot button')].map((b) => (b.textContent || '').trim()),
  scanAreaGone: !document.querySelector('.mp-qty') && !document.querySelector('input[placeholder*="扫物料码"]'),
}))
console.log('== 提交后(只读) ==')
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-05-submitted.png' })
