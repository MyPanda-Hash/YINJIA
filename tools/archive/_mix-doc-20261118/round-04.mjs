/**
 * round-04:两项物料**逐个解锁 → 手输秤值 → 确认**,看进度与提交闸门。
 *
 * 现场口径:「再扫其他的物料解锁,根据电子秤再确认。全部物料确认完毕后,才可以提交。」
 * 本机没有电子秤硬件(读数一直「等待称重」)⇒ 数量走手输,与现场"秤离线时手输"同一条兜底。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)

const state = async () => page.evaluate(() => ({
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('混料进度')) || '',
  rows: [...document.querySelectorAll('.mp-line')].map((el) => {
    const q = [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())
    return {
      name: (el.querySelector('.mp-line-name') || {}).innerText || '',
      qty: q,
      highlighted: el.classList.contains('is-cur'),
    }
  }),
  footNote: (document.querySelector('.mp-foot-note') || {}).innerText || '',
  submit: (() => {
    const b = [...document.querySelectorAll('.mp-foot button')].map((x) => ({ text: (x.textContent || '').trim(), disabled: !!x.disabled }))
    return b
  })(),
  unlockedStill: !!document.querySelector('.mp-mat'),
}))

// ① 第 1 项:扫 → 数量 86.172 → 确认
await page.fill('input[placeholder*="扫物料码"]', 'YJ-TJHZ-001|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
await page.fill('.mp-qty input', '86.172')
await page.waitForTimeout(300)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(2000)
console.log('== 第 1 项确认后 ==')
console.log(JSON.stringify(await state(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-04-first-confirm.png' })

// ② 第 2 项:扫 → 数量 21.042 → 确认 → 两项都齐了
await page.fill('input[placeholder*="扫物料码"]', 'YJ-YKRS-005|20261118002')
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
await page.fill('.mp-qty input', '21.042')
await page.waitForTimeout(300)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(2000)
console.log('== 第 2 项确认后 ==')
console.log(JSON.stringify(await state(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-04-all-confirmed.png' })
