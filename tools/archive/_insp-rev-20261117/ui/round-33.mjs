// round-33: 8090 打包版复核「联系人 >15 → 弹窗」+ 打开弹窗看名单
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

await page.goto('http://127.0.0.1:8090/#/login', { timeout: 90000 })
await T(3000)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await T(700)
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((e) => /工厂/.test(e.textContent || ''))
    sel?.querySelector('.el-select__wrapper, .el-input')?.click?.()
  })
  await T(900)
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
    const yj = opts.find((li) => (li.textContent || '').trim() === 'YINJIA-MES') || opts[0]
    yj?.click()
  })
  await T(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await T(7000)
}

await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(8000)

const cell = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
  return {
    cell: txt(tr),
    hasSelect: !!tr?.querySelector('.el-select'),
    hasPickBtn: !!tr?.querySelector('.ic-pick-btn'),
    editable: sheet.className.includes('is-editing'),
  }
})
console.log('cell=' + JSON.stringify(cell))

const opened = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(r.textContent || ''))
  const btn = tr?.querySelector('.ic-pick-btn')
  if (!btn) return 'no-edit-or-no-btn'
  btn.click()
  return 'clicked'
})
console.log('open=' + opened)
await T(1500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.ic-contact-dialog')].find((x) => x.offsetParent)
  const items = [...(d?.querySelectorAll('.ic-contact-item') || [])].map((i) => (i.textContent || '').trim())
  return { visible: !!d, count: items.length, head: items.slice(0, 4) }
})
console.log('dialog=' + JSON.stringify(dlg))
await page.screenshot({ path: dir + '/shots/round-33-8090-dialog.png' })
