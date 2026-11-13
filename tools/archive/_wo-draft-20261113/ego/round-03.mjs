// round-03：返回列表 → 草稿箱角标/列表 → 继续编辑回填
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

// 返回列表（保存后已无未保存修改，离开守卫应直接放行）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '返回列表')
  btn?.click()
})
await sleep(3500)
let listInfo = await page.evaluate(() => ({
  hash: location.hash,
  draftBoxBtn: (() => {
    const b = [...document.querySelectorAll('.wol-btns button')].find((x) => (x.textContent || '').includes('草稿箱'))
    return b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : ''
  })(),
}))
console.log('返回列表=' + JSON.stringify(listInfo))

// 打开草稿箱
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').includes('草稿箱'))
  btn?.click()
})
await sleep(2500)
const box = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('草稿箱') && x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    headers: [...d.querySelectorAll('.el-table th')].map((x) => (x.textContent || '').trim()),
    rows: [...d.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()),
    empty: (d.querySelector('.el-table__empty-text') || {}).textContent || '',
  }
})
console.log('草稿箱=' + JSON.stringify(box, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r03-draftbox.png' })

// 点第一行「继续编辑」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('草稿箱') && x.getBoundingClientRect().width > 100)
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '继续编辑')
  btn?.click()
})
await sleep(3500)
const reopened = await page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.wop-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const sel = item.querySelector('.el-select__selected-item') || item.querySelector('.el-select__placeholder')
    const inp = item.querySelector('input')
    out[label] = ((sel ? sel.textContent : (inp ? inp.value : '')) || '').trim()
  }
  return {
    hash: location.hash,
    head: (document.querySelector('.wop-head') || {}).textContent?.replace(/\s+/g, ' ').trim(),
    values: out,
  }
})
console.log('继续编辑回填=' + JSON.stringify(reopened, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r03-edit-draft.png' })
console.log('pageerrors=' + JSON.stringify(errors))
