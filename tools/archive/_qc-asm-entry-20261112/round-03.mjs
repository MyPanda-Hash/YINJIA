// round-03 — 未进入行置灰 + 强制开单按钮 + 英文界面(新词条生效)
const out = 'C:/Users/vigna/ego/qc-asm-entry-20261112'
const task = await taskSpace('qc-asm-entry-20261112')
const page = task.page('p1')

async function openPicker() {
  await page.waitForTimeout(3500)
  await page.click('text=选生产工单')
  await page.waitForSelector('.wopick-tip', { timeout: 15000 })
  await page.waitForTimeout(1500)
}

// ① 未进入的行(关键字 GD-2026-11-0017)
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await openPicker()
// 弹窗关键字可能沿用上次(组件未销毁)——先清空再查
await page.fill('.wopick-bar input', 'GD-2026-11-0017')
await page.click('.wopick-bar button')
await page.waitForTimeout(2000)
const rowsInfo = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return {
    rowCount: rows.length,
    rows: rows.slice(0, 4).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')),
  }
})
console.log('ROWS=' + JSON.stringify(rowsInfo))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  d.querySelector('.el-table__body-wrapper tbody tr')?.click()
})
await page.waitForTimeout(1200)
const blocked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  return {
    warn: (d.querySelector('.wopick-warn')?.textContent || '').trim(),
    footerBtns: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => ({
      text: (b.textContent || '').trim(), disabled: !!b.disabled || b.classList.contains('is-disabled'),
    })),
  }
})
console.log('BLOCKED=' + JSON.stringify(blocked))
await page.screenshot({ path: out + '/round-03-blocked-row.png' })
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')
  if (btn) btn.click()
})

// ② 英文界面:新弹窗文案/列头是否英文
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(5000)
await openPicker()
const en = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  return {
    locale: localStorage.getItem('mes_locale'),
    tip: (d.querySelector('.wopick-tip')?.textContent || '').trim(),
    gate: (d.querySelector('.wopick-gate')?.textContent || '').trim(),
    headers: [...d.querySelectorAll('.el-table__header-wrapper th')].map((x) => (x.textContent || '').trim()).filter(Boolean),
    rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3)
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')),
  }
})
console.log('EN=' + JSON.stringify(en))
await page.screenshot({ path: out + '/round-03-en.png' })
// 恢复中文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
console.log('done')
