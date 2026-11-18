/**
 * round-04:第二项确认 → 「清空本次」验闸门 → 重新录两项,准备提交。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

const state = () => page.evaluate(() => ({
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('本次退料')) || '',
  thisReturn: [...document.querySelectorAll('.mp-line')].map((el) => {
    const rows = [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())
    return { name: (el.querySelector('.mp-line-name') || {}).innerText || '', this: rows[2] || '' }
  }),
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
}))

const scanAndConfirm = async (code, qty) => {
  await page.fill('input[placeholder*="扫物料码"]', code)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1600)
  await page.fill('.mp-qty input', String(qty))
  await page.waitForTimeout(250)
  await page.click('.mp-qty button:first-of-type')
  await page.waitForTimeout(1200)
}

// ① 两项:热缩袋 4 + 标签 2
await scanAndConfirm('YJ-KBL-003', 4)
await scanAndConfirm('YJ-TBRW-001', 2)
console.log('== ① 两项都确认(合计 6) ==')
console.log(JSON.stringify(await state(), null, 2))

// ② 清空本次 ⇒ 合计 0、提交置灰
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.mp-foot button')].find((x) => (x.textContent || '').includes('清空本次'))
  if (b) b.click()
})
await page.waitForTimeout(800)
console.log('== ② 清空本次之后 ==')
console.log(JSON.stringify(await state(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-04-cleared.png' })

// ③ 重新录两项,准备提交
await scanAndConfirm('YJ-KBL-003', 4)
await scanAndConfirm('YJ-TBRW-001', 2)
console.log('== ③ 重新录入(合计 6,可提交) ==')
console.log(JSON.stringify(await state(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-04-ready.png' })
