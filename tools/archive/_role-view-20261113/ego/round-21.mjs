// round-21.mjs —— 销售账号:序号输入调位置 + 取消勾选后置底无序号(并确认非管理员看不到「套用到其他角色」)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip') }

// 已登录会从 /login 弹回桌面 ⇒ 先清会话,保证按指定账号登录
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.waitForTimeout(1500)
const h0 = await page.evaluate(() => location.hash)
if (!h0.includes('login')) {
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
}
await page.waitForTimeout(2800)

await page.evaluate(() => {
  const f = [...document.querySelectorAll('.el-select__wrapper')].find((w) => (w.textContent || '').includes('YINJIA-MES'))
  if (f) f.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('测试库'))
  if (t) t.click()
})
await page.waitForTimeout(600)
await page.fill('input[placeholder="请输入登录账号"]', 'zz_fv_a')
await page.fill('input[placeholder="请输入登录密码"]', 'Tmp#FieldView2026')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(6500)
console.log('hash=' + (await page.evaluate(() => location.hash)))

await page.goto('http://127.0.0.1:8091/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(7500)

// 打开 更多 → 表格调整
await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
})
await page.waitForTimeout(1800)

const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  if (!box) return null
  const rows = [...box.querySelectorAll('.col-pref-row')]
  return {
    scope: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].filter((e) => e.className.includes('is-active')).map((e) => (e.textContent || '').trim()),
    tip: (box.querySelector('.col-pref-tip')?.textContent || '').replace(/\s+/g, ' ').trim(),
    tplButtons: [...box.querySelectorAll('.col-pref-tpl button')].map((b) => (b.textContent || '').trim()),
    seqInputs: box.querySelectorAll('.cp-seq-input').length,
    seqDash: box.querySelectorAll('.cp-seq-dash').length,
    first3: rows.slice(0, 3).map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      seq: r.querySelector('.cp-seq-input input')?.value ?? null,
      checked: !!r.querySelector('.el-checkbox.is-checked'),
    })),
    last2: rows.slice(-2).map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      seq: r.querySelector('.cp-seq-input input')?.value ?? null,
      checked: !!r.querySelector('.el-checkbox.is-checked'),
      dash: !!r.querySelector('.cp-seq-dash'),
    })),
  }
})
console.log('对话框 = ' + JSON.stringify(dlg, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-21-seq-ui.png' })

// 把「金额」序号改成 1,并取消勾选「税率%」
const act = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const rows = [...box.querySelectorAll('.col-pref-row')]
  const pick = (name) => rows.find((r) => (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*(必填|已定制)$/, '') === name)
  const rec = {}
  const inp = pick('金额')?.querySelector('.cp-seq-input input')
  if (inp) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '1')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.blur()
    rec.seqSet = true
  }
  const cb = pick('税率%')?.querySelector('.el-checkbox')
  if (cb && cb.classList.contains('is-checked')) { cb.click(); rec.unchecked = true }
  return rec
})
console.log('操作 = ' + JSON.stringify(act))
await page.waitForTimeout(1000)

const mid = await page.evaluate(() => [...document.querySelectorAll('.col-pref-row')].slice(0, 4).map((r) => ({
  label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
  seq: r.querySelector('.cp-seq-input input')?.value ?? null,
  checked: !!r.querySelector('.el-checkbox.is-checked'),
})))
console.log('保存前前 4 行 = ' + JSON.stringify(mid, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-21-before-save.png' })

await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const btn = [...(box?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(5000)

const after = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  cols: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-21-after-save.png' })
