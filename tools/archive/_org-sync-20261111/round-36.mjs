const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
async function submit(no) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=' + no, { timeout: 60000 })
  await page.waitForTimeout(8000)
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '提交审批')
    if (!btn) return 'NO-BTN'
    btn.click()
    return 'CLICKED'
  })
  await page.waitForTimeout(1500)
  if (clicked === 'CLICKED') {
    await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
      if (!d) return
      const btn = [...d.querySelectorAll('button')].find((b) => /确认提交审批/.test(b.textContent || ''))
      if (btn) btn.click()
    })
  }
  const msgs = []
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400)
    const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
    if (m.length) msgs.push(...m)
  }
  const side = await page.evaluate(() => {
    const el = document.querySelector('.approval-side')
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) : ''
  })
  return { clicked, msgs: [...new Set(msgs)], side }
}
console.log('0003=' + JSON.stringify(await submit('JYSJ-2026-11-0003')))
console.log('0004=' + JSON.stringify(await submit('JYSJ-2026-11-0004')))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-36-submitted.png' })
