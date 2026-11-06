const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 45000 })
await page.waitForTimeout(10000)

const out = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tr')]
  const signRow = rows.find((r) => (r.innerText || '').includes('检验人'))
  const spans = signRow ? [...signRow.querySelectorAll('.qr-sign')] : []
  const headerText = (document.querySelector('.as-side-title, .as-side-head')?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    signRowText: signRow ? (signRow.innerText || '').replace(/\s+/g, ' ').trim() : null,
    signs: spans.map((s) => ({ text: (s.innerText || '').trim(), title: s.getAttribute('title') })),
    bodyHasEmptyHint: (document.body.innerText || '').includes('新增时按登录人生成'),
    materialCode: (document.querySelectorAll('.qr-value-code .qr-ref-text')[0]?.innerText || '').trim(),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-inspector-hint-20261106/round-02.png' })
