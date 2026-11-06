// round-10：正式库 A/B 取证（写库动作仅一次「新增」空白草稿，round-11 删除）
//   A = 4179 新构建（预期 .rs-pre 为空、正文无 外：/内：/长：）
//   B = 8090 老 jar（预期 .rs-pre = 外：/内：/长：）
const OUT = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-rodspec-20261106'
const task = await taskSpace('yj-rod-spec')

async function ensureLogin(page, base) {
  await page.goto(`${base}/#/login`, { timeout: 30000 })
  await page.waitForTimeout(1800)
  if (!(await page.url()).includes('/login')) return 'session'
  await page.waitForSelector('input[placeholder="请输入登录账号"]', { timeout: 20000 })
  await page.fill('input[placeholder="请输入登录账号"]', 'admin')
  await page.waitForTimeout(1500)
  await page.click('.el-select--large', { label: '打开登录工厂' })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.el-select-dropdown__item')].find((n) => n.innerText.trim() === 'YINJIA-MES')
    if (el) el.click()
  })
  await page.waitForTimeout(500)
  await page.fill('input[placeholder="请输入登录密码"]', '123456')
  await page.click('button:has-text("进入系统")', { label: '登录正式库' })
  await page.waitForTimeout(4000)
  return await page.url()
}

const probe = () => {
  const txt = document.body.innerText || ''
  return {
    spans: [...document.querySelectorAll('.rs-pre')].map((el) => el.textContent.trim()),
    hits: ['外：', '内：', '长：'].filter((w) => txt.includes(w)),
    addBtns: [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.innerText || '').trim() === '新增').length,
  }
}

const p1 = task.page('p1')
const p2 = task.page('p2')

console.log('A login', await ensureLogin(p1, 'http://127.0.0.1:4179'))
await p1.goto('http://127.0.0.1:4179/#/panelx/list/RD_MOLD_PROC', { timeout: 30000 })
await p1.waitForTimeout(3500)
const addInfo = await p1.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && (n.innerText || '').trim() === '新增')[0]
  if (!el) return { found: false, buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 14) }
  el.click()
  return { found: true, tag: el.tagName, cls: el.className }
})
console.log('A add', JSON.stringify(addInfo))
await p1.waitForTimeout(5500)
const A = await p1.evaluate(probe)
console.log('A-new', JSON.stringify(A))
await p1.screenshot({ path: `${OUT}/A-new-sheet.png` })

console.log('B login', await ensureLogin(p2, 'http://127.0.0.1:8090'))
await p2.goto('http://127.0.0.1:8090/#/panelx/list/RD_MOLD_PROC', { timeout: 30000 })
await p2.waitForTimeout(4000)
const openInfo = await p2.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr')]
  const r = rows.find((tr) => (tr.innerText || '').trim().length > 3)
  if (!r) return { rows: rows.length }
  r.click()
  return { rows: rows.length, text: (r.innerText || '').replace(/\s+/g, ' ').slice(0, 100) }
})
console.log('B open', JSON.stringify(openInfo))
await p2.waitForTimeout(4500)
const B = await p2.evaluate(probe)
console.log('B-old', JSON.stringify(B))
await p2.screenshot({ path: `${OUT}/B-old-sheet.png` })

console.log('VERDICT', JSON.stringify({ A_new: A, B_old: B }))
