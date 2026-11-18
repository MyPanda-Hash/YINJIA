// round-13: 直接打接口验证「重号被拒」的返回文案(不新增数据)
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || localStorage.getItem('token') || ''
  const body = {
    panelCode: 'INSP_COMMISSION',
    buttonName: '提交',
    formData: {
      编号: 'WT-2026-11-9002',
      单据编号: 'WT-2026-11-9001',
      单据日期: '2026-11-17',
      委托单位: '品质',
      detail: { items: [{ 行号: 1, 检测元素: '锂' }] },
    },
    buttonParam: {},
  }
  const r = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token ? 'Bearer ' + token : '' },
    body: JSON.stringify(body),
  })
  let text = ''
  try { text = await r.text() } catch (e) { text = 'ERR ' + e.message }
  return { status: r.status, body: text.slice(0, 400) }
})
console.log(JSON.stringify(res, null, 2))
