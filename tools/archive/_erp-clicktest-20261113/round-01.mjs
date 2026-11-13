// round-01: 测试账套 —— 逐个盘点「有转ERP按钮」的 7 张单:各有几张已审核、几张未转ERP。
// 只为选测试样本,不写任何数据。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(5000)
if (await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))) {
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
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await page.waitForTimeout(8000)
}
async function switchFactory(name) {
  const cur = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
  if (cur === name) return cur
  await page.evaluate(() => {
    const el = document.querySelector('.factory')
    el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    el?.click()
  })
  await page.waitForTimeout(900)
  const picked = await page.evaluate((want) => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item, .factory-item')]
    const t = items.find((el) => (el.textContent || '').trim() === want)
    if (!t) return ''
    t.click()
    return (t.textContent || '').trim()
  }, name)
  if (!picked) return cur + '(未找到)'
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const inp = document.querySelector('.factory-switch-dialog input')
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp, '123456')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.factory-switch-dialog button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
    btn?.click()
  })
  await page.waitForTimeout(9000)
  return await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
}
const factory = await switchFactory('YINJIA-MES·测试库')
console.log('FACTORY ' + factory)
if (!String(factory).includes('测试')) throw new Error('不是测试账套:' + factory)

const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const panels = ['PURCHASE_IN', 'QC_RETURN', 'FINISH_IN', 'OTHER_IN', 'SALE_OUT', 'MATERIAL_OUT', 'OTHER_OUT']
const out = {}
for (const p of panels) {
  const r = await post('/api/px/queryFormDataList', { panelCode: p, condition: {}, pageNo: 1, pageSize: 100 })
  const list = r.body?.data?.list || []
  const audited = list.filter((d) => String(d['单据状态'] || '') === '已审核')
  const notPushed = audited.filter((d) => String(d['是否已转ERP'] ?? '') !== '是' && String(d['ERP单号'] ?? '').trim() === '')
  out[p] = {
    total: list.length, audited: audited.length, notPushed: notPushed.length,
    samples: notPushed.slice(0, 5).map((d) => ({ no: d['编号'], 日期: d['日期'] || d['单据日期'], 供应商: d['供应商'], 客户: d['客户'] })),
    statuses: [...new Set(list.map((d) => String(d['单据状态'] || '')))],
  }
  console.log(p + ' total=' + list.length + ' audited=' + audited.length + ' notPushed=' + notPushed.length
    + ' samples=' + JSON.stringify(out[p].samples.map((s) => s.no)))
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-01.json', JSON.stringify(out, null, 2), 'utf8')
