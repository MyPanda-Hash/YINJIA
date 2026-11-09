// round-18: 通过界面语言下拉切到 English,再验证提示是否英文
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true })
} catch {}
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(9000)

// 找顶栏语言切换器(显示"中"或"中文")
console.log('langCandidates=' + JSON.stringify(await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('header *, .topbar *, .el-dropdown, [class*="locale"], [class*="lang"]')) {
    const t = (el.textContent || '').trim()
    if (t && t.length <= 12 && /^(\S{1,3}\s*[▾▼⌄]?)$/.test(t) && /[中EnglishJP日]/.test(t)) {
      out.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), text: t })
    }
  }
  return out.slice(0, 12)
})))
const opened = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('header *, .el-dropdown, [class*="locale"], [class*="lang"]')]
    .find((el) => /^(中|中文|简体中文|English)\s*[▾▼⌄]?$/.test((el.textContent || '').trim()))
  if (!cand) return 'none'
  const clickable = cand.closest('.el-dropdown') || cand
  clickable.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  if (clickable.click) clickable.click()
  return (cand.textContent || '').trim()
})
console.log('opened=' + opened)
await page.waitForTimeout(1200)
console.log('menu=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.el-dropdown-menu__item, li')].map((el) => (el.textContent || '').trim()).filter((t) => t && t.length < 24).slice(0, 20))))
const picked = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.el-dropdown-menu__item, li')].find((el) => /English\s*\(en\)/.test((el.textContent || '').trim()))
  if (!item) return 'none'
  item.click(); return 'clicked'
})
console.log('picked=' + picked)
await page.waitForTimeout(5000)
console.log('toolbarAfter=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('span.tb-main')].map((s) => (s.textContent || '').trim()).slice(0, 12))))
