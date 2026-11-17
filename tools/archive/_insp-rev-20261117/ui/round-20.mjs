// round-20: 新增后不动任何东西,等两个时间点读联系人(验证"直接带入当前登录人姓名")
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

async function readContact() {
  return page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const sheet = document.querySelector('[data-ic-sheet]')
    if (!sheet) return { none: true }
    const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
    return {
      docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
      contact: txt(tr?.querySelector('.el-select') || tr),
    }
  })
}

// 关掉可能残留的下拉
await page.keyboard.press('Escape').catch(() => {})
await T(500)

const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add=' + added)

await T(5000)
console.log('t+5s=' + JSON.stringify(await readContact()))
await T(6000)
console.log('t+11s=' + JSON.stringify(await readContact()))

await page.screenshot({ path: dir + '/shots/round-20-autofill.png' })
