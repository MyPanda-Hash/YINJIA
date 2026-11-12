// round-04 — 英文界面:新弹窗提示/列头/行内文案是否走 tt() 出英文
const out = 'C:/Users/vigna/ego/qc-asm-entry-20261112'
const task = await taskSpace('qc-asm-entry-20261112')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(7000)

const before = await page.evaluate(() => ({
  locale: localStorage.getItem('mes_locale'),
  sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').trim()),
}))
console.log('BEFORE=' + JSON.stringify(before))

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')]
    .find((e) => /Select work order|Pick production work order/i.test((e.textContent || '')))
  if (btn) btn.click()
  return !!btn
})
console.log('clicked=' + clicked)
await page.waitForSelector('.wopick-tip', { timeout: 15000 })
await page.waitForTimeout(1500)
const en = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  return {
    tip: (d.querySelector('.wopick-tip')?.textContent || '').trim(),
    gate: (d.querySelector('.wopick-gate')?.textContent || '').trim(),
    headers: [...d.querySelectorAll('.el-table__header-wrapper th')].map((x) => (x.textContent || '').trim()).filter(Boolean),
    rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3)
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')),
    footerBtns: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('EN=' + JSON.stringify(en))
await page.screenshot({ path: out + '/round-04-en-dialog.png' })

// 搜一条未进入行,看英文原因话术
await page.fill('.wopick-bar input', 'GD-2026-11-0017')
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const btn = d.querySelector('.wopick-bar button')
  if (btn) btn.click()
})
await page.waitForTimeout(2000)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  d.querySelector('.el-table__body-wrapper tbody tr')?.click()
})
await page.waitForTimeout(1200)
const enBlocked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  return { warn: (d.querySelector('.wopick-warn')?.textContent || '').trim() }
})
console.log('EN_BLOCKED=' + JSON.stringify(enBlocked))
await page.screenshot({ path: out + '/round-04-en-blocked.png' })

// 恢复中文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
console.log('done')
