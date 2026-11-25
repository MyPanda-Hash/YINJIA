// round-06: 看清巡线表列表页有哪些按钮(新增可能在图标/下拉里)
const task = await taskSpace('deploy-smoke-20261124')
const page = task.page('p1')
const BASE = 'http://36.140.66.163:8090/'

await page.goto(BASE + '#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(5000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  buttons: [...document.querySelectorAll('button')].map((b) => ({
    txt: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20),
    cls: (b.className || '').slice(0, 40),
    title: b.title || '',
  })).filter((b) => b.txt || b.title).slice(0, 20),
  // 也看看 role=button / a 标签
  links: [...document.querySelectorAll('a, [role="button"]')].map((a) => (a.innerText || a.title || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12),
  headText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('PAGE ' + JSON.stringify(info, null, 1))
