// round-08: 确认当前登录的是哪个账套(顶栏工厂名 + 令牌声明 + store),不点任何按钮。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(1000)
const info = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const ls = {}
  for (const k of Object.keys(localStorage)) ls[k] = String(localStorage.getItem(k)).slice(0, 300)
  let claims = null
  try {
    const raw = localStorage.getItem('yj_token') || localStorage.getItem('token') || ''
    const tok = raw.replace(/^"|"$/g, '')
    if (tok.split('.').length === 3) {
      claims = JSON.parse(decodeURIComponent(escape(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))))
    }
  } catch (e) { claims = 'decode-failed' }
  return {
    topbar: text(document.querySelector('.topbar, .layout-topbar, header')).slice(0, 300),
    chip: text(document.querySelector('.doc-chip')),
    lsKeys: Object.keys(ls),
    claims,
  }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-08.json', JSON.stringify(info, null, 2), 'utf8')
console.log('ok')
