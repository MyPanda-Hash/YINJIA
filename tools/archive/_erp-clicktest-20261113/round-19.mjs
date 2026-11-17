// round-19: 按**沙箱真实档案**重做 3 张单据并转ERP:
//  · 商品 YJ-TS-004(沙箱基本单位 = 个/id=1;YCL-01 有 16649 库存)
//  · 客户 001 长江(沙箱客户档案里真实存在)
//  · 单位一律 个(id=1),基本单位 id=1 —— 之前用"支/3"与商品基本单位不符,是被拒的原因之一
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-cleanup-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(6000)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('FACTORY ' + factory)
if (!String(factory).includes('测试')) throw new Error('不是测试账套:' + factory)
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (p, b, f) => post('/api/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} })
const erp = async (panel, no) => {
  const r = await call(panel, '转ERP', { 编号: no, 单据编号: no })
  return { status: r.status, code: r.body?.code, msg: String(r.body?.message || '').slice(0, 350), data: r.body?.data }
}
const today = new Date().toISOString().slice(0, 10)
const results = []
const M = { code: 'YJ-TS-004', name: 'PP棉', unit: '个', wh: '材料仓', whCode: 'YCL-01', price: 1 }
const U = { name: '个', code: '个', id: '1' }
async function build(panel, label, head, items) {
  const save = await call(panel, '保存', { ...head, detail: { items } })
  const no = String(save.body?.data?.['编号'] || '')
  const rec = { panel, label, no, saveMsg: String(save.body?.message || '').slice(0, 200) }
  if (!no) { results.push(rec); console.log(panel + ' 建单失败 ' + rec.saveMsg); return rec }
  const aud = await call(panel, '审核', { 编号: no })
  rec.auditMsg = String(aud.body?.message || '').slice(0, 200)
  if ((aud.body?.code ?? aud.status) !== 200) { results.push(rec); console.log(panel + ' ' + no + ' 审核失败 ' + rec.auditMsg); return rec }
  rec.erp = await erp(panel, no)
  results.push(rec)
  console.log(panel + ' ' + no + ' 转ERP → ' + rec.erp.status + ' ' + rec.erp.msg + ' data=' + JSON.stringify(rec.erp.data))
  return rec
}
const baseUnits = { 基本单位名称: U.name, 基本单位编码: U.code, 基本单位id: U.id, 换算系数: '1' }

// ① 销售出库(客户 001 长江)
await build('SALE_OUT', '销售出库-沙箱客户+沙箱物料',
  { 单据日期: today, 客户: '长江', 客户编码: '001', 经手人: '张莉', 部门: '销售部', 仓库: M.wh, 仓库编码: M.whCode },
  [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit,
    数量: 1, 售价: M.price, ...baseUnits }])

// ② 产品入库(入库类)
await build('FINISH_IN', '产品入库-沙箱物料',
  { 单据日期: today, 业务类型: '产品入库单', 单据类型: '产品入库单' },
  [{ 行号: 1, 产品编码: M.code, 产品名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit,
    实收数量: 1, ...baseUnits }])

// ③ 材料出库(出库类)
await build('MATERIAL_OUT', '材料出库-沙箱物料',
  { 单据日期: today, 业务类型: '生产领料' },
  [{ 行号: 1, 材料编码: M.code, 材料名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit,
    数量: 1, 金额: 0, ...baseUnits }])

await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-19.json', JSON.stringify(results, null, 2), 'utf8')
