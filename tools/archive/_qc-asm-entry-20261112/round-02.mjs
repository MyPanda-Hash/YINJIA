// round-02 — 弹窗视觉证据 + 未进入行置灰/强制开单按钮 + 8090 打包版同款入口
const out = 'C:/Users/vigna/ego/qc-asm-entry-20261112'
const task = await taskSpace('qc-asm-entry-20261112')
const page = task.page('p1')

async function openPickerOn(url) {
  await page.goto(url, { timeout: 30000 })
  await page.waitForTimeout(4500)
  await page.click('text=选生产工单')
  await page.waitForSelector('.wopick-tip', { timeout: 15000 })
  await page.waitForTimeout(1200)
}

// ① 5173 弹窗截图 + 未进入行行为
await openPickerOn('http://localhost:5173/#/panelx/list/QC_ASM_INSP')
await page.screenshot({ path: out + '/round-02-dialog-5173.png' })

const blocked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  // 找第一条「未进入组装/装箱」的行并点它
  const target = rows.find((tr) => (tr.textContent || '').includes('未进入组装/装箱'))
  if (target) target.click()
  return { rowCount: rows.length, clicked: !!target }
})
await page.waitForTimeout(1200)
const blockedState = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const btns = [...d.querySelectorAll('.el-dialog__footer button')].map((b) => ({
    text: (b.textContent || '').trim(),
    disabled: !!b.disabled || b.classList.contains('is-disabled'),
  }))
  return {
    warn: (d.querySelector('.wopick-warn')?.textContent || '').trim(),
    btns,
    toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
  }
})
console.log('BLOCKED=' + JSON.stringify(blocked) + ' STATE=' + JSON.stringify(blockedState))
await page.screenshot({ path: out + '/round-02-blocked-row.png' })

// 关闭弹窗
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')
  if (btn) btn.click()
})
await page.waitForTimeout(800)

// ② 8090 打包版(同 jar 内 static)同款入口
await openPickerOn('http://127.0.0.1:8090/#/panelx/list/QC_ASM_INSP')
const p8090 = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  return {
    tip: (d.querySelector('.wopick-tip')?.textContent || '').trim(),
    headers: [...d.querySelectorAll('.el-table__header-wrapper th')].map((x) => (x.textContent || '').trim()).filter(Boolean),
    rowCount: d.querySelectorAll('.el-table__body-wrapper tbody tr').length,
  }
})
console.log('P8090=' + JSON.stringify(p8090))
await page.screenshot({ path: out + '/round-02-dialog-8090.png' })
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')
  if (btn) btn.click()
})
console.log('done')
