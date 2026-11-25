// 第 12 轮:验「手动换行」—— 新建草稿,在检验项目格按 Enter 看是否换行/是否触发别的动作
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const clickText = async (label, sel = 'span,div,button,a') => {
  const ok = await page.evaluate(([t, s]) => {
    const el = [...document.querySelectorAll(s)].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === t)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    if (!el) return false
    el.click()
    return true
  }, [label, sel])
  await page.waitForTimeout(1800)
  return ok
}
console.log('tab 未完成: ' + (await clickText('未完成')))
console.log('新增: ' + (await clickText('新增', '.as-side-btns .as-side-btn')))
await page.waitForTimeout(1500)
const add = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act')].find((e) => (e.textContent || '').includes('新增检验项'))
  if (!el) return false
  el.click(); return true
})
console.log('新增检验项: ' + add)
await page.waitForTimeout(1500)

// 聚焦检验项目格,输入两段文字并用 Enter 换行
const res = await page.evaluate(async () => {
  const ta = document.querySelector('.qr-grid tbody tr .c-item textarea')
  if (!ta) return { err: 'no textarea' }
  ta.focus()
  return { ok: true, cls: ta.className }
})
console.log('focus: ' + JSON.stringify(res))
await page.keyboard.type('第一行文字')
await page.keyboard.press('Enter')
await page.keyboard.type('第二行文字')
await page.waitForTimeout(800)
const after = await page.evaluate(() => {
  const tr = document.querySelector('.qr-grid tbody tr')
  const ta = tr?.querySelector('.c-item textarea')
  return {
    value: ta?.value,
    rowH: Math.round(tr?.getBoundingClientRect().height || 0),
    taH: Math.round(ta?.getBoundingClientRect().height || 0),
    dialogs: [...document.querySelectorAll('.el-message, .el-message-box, .el-dialog')].map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
  }
})
console.log('after enter: ' + JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-12.png' })
