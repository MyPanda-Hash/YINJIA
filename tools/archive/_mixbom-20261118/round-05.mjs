const task = await taskSpace('mixbom-20261118')
const page = task.page('p1')
for (const code of ['ASM_BOM', 'MIX_BOM']) {
  await page.goto(`http://localhost:5173/#/panelx/list/${code}`, { timeout: 30000 })
  await page.waitForTimeout(3000)
  const info = await page.evaluate(() => ({
    pageNav: document.body.innerText.match(/第\s*\d+\/\d+\s*张/)?.[0] || '',
    rail: [...document.querySelectorAll('[class*="rail"] *, .as-side *, .doc-no-item')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 10),
    hasQueryBtn: [...document.querySelectorAll('button, .tb-main, .as-tb-btn')].some((b) => (b.textContent || '').includes('查询')),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
  }))
  console.log(code, JSON.stringify(info, null, 1))
  await page.screenshot({ path: `C:/Users/vigna/ego/mixbom-20261118/05-${code}.png` })
}
