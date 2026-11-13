const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// ① 不填父目录直接点「添加」→ 应被拦下
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const add = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  if (add) add.click()
})
const warn = []
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(350)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) warn.push(...m)
}
console.log('warn=' + JSON.stringify([...new Set(warn)]))

// ② 用真实键盘在「父字段」下拉里输入新分组名并回车
const box = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const it = [...d.querySelectorAll('.el-form-item')].find((x) => (x.querySelector('.el-form-item__label')?.textContent || '').includes('父字段'))
  const w = it?.querySelector('.el-select__wrapper')
  if (!w) return null
  const r = w.getBoundingClientRect()
  return { x: Math.round(r.x + 40), y: Math.round(r.y + r.height / 2) }
})
console.log('box=' + JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(600)
  await page.keyboard.type('可靠性')
  await page.waitForTimeout(600)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
}
console.log('state=' + JSON.stringify(await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const items = [...d.querySelectorAll('.el-form-item')]
  const val = (t) => {
    const it = items.find((x) => (x.querySelector('.el-form-item__label')?.textContent || '').includes(t))
    const sel = it?.querySelector('.el-select__selected-item')
    const inp = it?.querySelector('input')
    return sel ? (sel.textContent || '').trim() : (inp ? inp.value : null)
  }
  const add = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  return { parent: val('父字段'), name: val('字段名'), sub2: val('子目录2'), addDisabled: add ? add.disabled : null }
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-82-parent-typed.png' })

// ③ 点添加
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const add = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  if (add && !add.disabled) add.click()
})
const msgs = []
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('addMsgs=' + JSON.stringify([...new Set(msgs)]))
await page.waitForTimeout(1500)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-82-added.png' })
