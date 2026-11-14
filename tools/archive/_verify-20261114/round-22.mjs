// round-22 — B1 菜单树取证:左导航 DOM 里找「巡线检验」及其父级「品质管理/制程品质」
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
const info = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const all = [...document.querySelectorAll('*')].filter((e) => {
    const t = txt(e)
    return t === '巡线检验' && e.children.length === 0
  })
  const navContainers = []
  for (const sel of ['.sidebar', '.side-nav', '.el-menu', '.nav', '.layout-menu', 'aside', 'nav']) {
    document.querySelectorAll(sel).forEach((e) => navContainers.push({ sel, cls: e.className, childCount: e.children.length, textLen: txt(e).length }))
  }
  const chain = all.map((hit) => {
    const out = []
    let el = hit
    for (let i = 0; i < 8 && el; i++) {
      out.push({ tag: el.tagName, cls: String(el.className).slice(0, 80), t: txt(el).slice(0, 60) })
      el = el.parentElement
    }
    return out
  })
  return { matches: all.length, chain, navContainers: navContainers.slice(0, 12) }
})
console.log('MENU_INFO=' + JSON.stringify(info, null, 1))
console.log('DONE round-22')
