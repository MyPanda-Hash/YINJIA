// round-01 — 出货检验表观(QC_ASM_INSP)「选生产工单」入口 + 弹窗(5173 源码版)
// 目标:① 面板侧栏出现「选生产工单」 ② 弹窗提示语/列是表观单口径(进入组装/装箱) ③ 选中已进入行能回执已有单
const out = 'C:/Users/vigna/ego/qc-asm-entry-20261112'
const task = await taskSpace('qc-asm-entry-20261112')
console.log('spaceId=' + task.spaceId)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)

// 需要登录时自动登录(admin/123456,默认工厂 YJ=正式库)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('needLogin=' + needLogin)
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
  await page.waitForTimeout(5000)
}

// ① 面板侧栏按钮清单
const side = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  btns: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
}))
console.log('SIDE=' + JSON.stringify(side))

// ② 点「选生产工单」开弹窗
await page.click('text=选生产工单')
await page.waitForSelector('.wopick-tip', { timeout: 15000 })
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const th = [...d.querySelectorAll('.el-table__header-wrapper th')].map((x) => (x.textContent || '').trim()).filter(Boolean)
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 6)
    .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | '))
  return {
    tip: (d.querySelector('.wopick-tip')?.textContent || '').trim(),
    gate: (d.querySelector('.wopick-gate')?.textContent || '').trim(),
    headers: th,
    rowCount: d.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    rows,
    footerBtns: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('DIALOG=' + JSON.stringify(dlg))

// ③ 搜索夹具工单行并选中
await page.fill('.wopick-bar input', 'GD-TEST-ASM')
await page.click('.wopick-bar button')
await page.waitForTimeout(1800)
const found = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return {
    rowCount: rows.length,
    rows: rows.slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')),
  }
})
console.log('FOUND=' + JSON.stringify(found))
if (found.rowCount > 0) {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
    const tr = d.querySelector('.el-table__body-wrapper tbody tr')
    tr?.click()
  })
  await page.waitForTimeout(800)
  // 点「确定」生成/命中已有单
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
    const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  const after = await page.evaluate(() => ({
    toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
    docNo: [...document.querySelectorAll('input,div,span')].map((e) => (e.value || e.textContent || '').trim())
      .filter((t) => /^ZJ-2026-11-\d+$/.test(t)).slice(0, 5),
    status: (document.querySelector('.as-status, .doc-status, .el-tag')?.textContent || '').trim(),
  }))
  console.log('AFTER_PICK=' + JSON.stringify(after))
}

await page.screenshot({ path: out + '/round-01-picker.png' })
console.log('shot=' + out + '/round-01-picker.png')
