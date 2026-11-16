// round-39:验①弹窗收窄(460)②提示文案只限本面板 ③选项不再限 30 字、长文本换行
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6500)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(2800)
await page.evaluate(() => document.querySelector('.qr-label .qr-opt-mgr')?.click())
await page.waitForTimeout(1500)

const info = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 0)
  const ta = dlg?.querySelector('.qr-opt-row textarea')
  return {
    width: dlg ? Math.round(dlg.getBoundingClientRect().width) : null,
    hint: (dlg?.querySelector('.qr-opt-hint')?.textContent || '').trim(),
    isTextarea: ta?.tagName === 'TEXTAREA',
    maxlength: ta ? ta.getAttribute('maxlength') : null,
  }
})
// 塞 60 个全角字(旧版 30 字限制会被截断/拒绝)
const TEXT = '出货检验单项判定意见：本批次外观与尺寸符合控制计划要求，功能性测试结果合格，同意放行'.repeat(2).slice(0, 60)
const set = await page.evaluate((text) => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 0)
  const rows = [...dlg.querySelectorAll('.qr-opt-row')]
  const ta = rows[rows.length - 1]?.querySelector('textarea')
  if (!ta) return { ok: false }
  ta.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  s.call(ta, text)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  ta.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true, len: ta.value.length }
}, TEXT)
await page.waitForTimeout(1200)
const after = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 0)
  const rows = [...dlg.querySelectorAll('.qr-opt-row')]
  const ta = rows[rows.length - 1]?.querySelector('textarea')
  const cs = ta ? getComputedStyle(ta) : null
  return {
    len: ta?.value?.length ?? null,
    h: ta?.clientHeight ?? null,
    sh: ta?.scrollHeight ?? null,
    wordBreak: cs?.wordBreak ?? null,
    rows: rows.length,
  }
})
console.log('OPT_DIALOG=' + JSON.stringify({ info, set, after }))
await page.evaluate(() => { const b = [...document.querySelectorAll('.el-dialog__footer button')].find((x) => (x.textContent || '').includes('取消')); b?.click() })
await page.waitForTimeout(1500)
console.log('CLOSED=' + JSON.stringify({ anyOpen: await page.evaluate(() => [...document.querySelectorAll('.el-overlay')].some((o) => getComputedStyle(o).display !== 'none')) }))
