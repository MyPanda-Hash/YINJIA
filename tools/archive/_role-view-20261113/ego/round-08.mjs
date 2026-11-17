// round-08.mjs —— 打开「表格调整」,看作用域切换条(系统整体 / 本角色:销售)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const clicked = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
  return !!it
})
console.log('点表格调整 = ' + clicked)
await page.waitForTimeout(1500)

const dlg = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const box = boxes.find((d) => (d.textContent || '').includes('表格调整')) || boxes[0]
  if (!box) return null
  return {
    title: (box.querySelector('.el-dialog__title')?.textContent || '').trim(),
    scopeRadios: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].map((e) => ({
      t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
      on: e.className.includes('is-active'),
    })),
    tip: (box.querySelector('.col-pref-tip')?.textContent || '').replace(/\s+/g, ' ').trim(),
    rows: [...box.querySelectorAll('.col-pref-row')].map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      checked: !!r.querySelector('.el-checkbox.is-checked'),
      dragOn: r.getAttribute('draggable'),
      aliasDisabled: !!r.querySelector('.cp-alias .is-disabled, .cp-alias[class*=disabled]'),
    })),
    footer: [...box.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log(JSON.stringify(dlg, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-08-dialog-system.png' })
