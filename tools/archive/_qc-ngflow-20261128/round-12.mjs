const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0021', { timeout: 60000 })
await page.waitForTimeout(4500)

const out = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a.qr-nglink')].map((a) => ({
    text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    title: a.getAttribute('title'),
    visible: !!(a.offsetWidth || a.offsetHeight),
  }))
  // 检验结论格:取含「检验结论」的行,把值格里的内容摊开(值不进 innerText 的坑 → 读控件 value)
  const rows = [...document.querySelectorAll('.qr-foot-table tr')].map((tr) => ({
    label: (tr.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim(),
    cellHtml: (tr.querySelectorAll('td')[1]?.innerHTML || '').replace(/\s+/g, ' ').slice(0, 260),
    selectValue: [...tr.querySelectorAll('input')].map((i) => i.value).filter(Boolean),
  }))
  return { hash: location.hash, headNo: document.body.innerText.includes('JYSJ-2026-11-0021'), links, rows }
})
console.log('NG-LINK', JSON.stringify(out, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-12-rec-link.png' })
