// round-11:只看接口明细行的键与值(裁剪输出,便于一次看清)
const task = await taskSpace('merge-pick-rows-20261128')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (!acc || !pwd) return
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(acc, 'admin')
  setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
const api = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/voucherFlow/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceKey: 'items', condition: {}, pageNo: 1, pageSize: 2 }),
  })
  const j = await r.json()
  const list = (j && j.data && j.data.list) || []
  const items = (list[0] && list[0].detail && list[0].detail.items) || []
  const pick = (it) => {
    const o = {}
    for (const k of ['行号', '物料编码', '物料名称', '规格型号', '计量单位', '单位', '数量', '已生单数量', '剩余数量', '可送上限', '小数位数', '_lineKey']) {
      if (it && k in it) o[k] = it[k]
    }
    return o
  }
  return { status: r.status, total: list.length, keys: Object.keys(items[0] || {}), it0: pick(items[0]), it1: pick(items[1]) }
})
console.log('api=' + JSON.stringify(api))
await task.finish({ keep: [] })
