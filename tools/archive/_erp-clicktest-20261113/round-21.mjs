// round-21(终验):7 张有「转ERP」按钮的单据,**同一轮**各造一张、审核、转ERP,打印成功表。
// 数据全部取自沙箱真实档案:商品 YJ-XWR-003(个/base_unit=1)、仓库 恒亿仓(CK00006,沙箱有库存)、客户 001 长江、供应商 深圳市陶氏。
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
  return { status: r.status, msg: String(r.body?.message || '').slice(0, 240), data: r.body?.data }
}
const today = new Date().toISOString().slice(0, 10)
const M = { code: 'YJ-XWR-003', name: '白色无纺布130g', unit: '个', wh: '恒亿仓', whCode: 'CK00006' }
const B = { 基本单位名称: '个', 基本单位编码: '个', 基本单位id: '1', 换算系数: '1' }

const plan = [
  ['PURCHASE_IN', '采购入库单', { 单据日期: today, 供应商: '深圳市陶氏水处理设备技术开发有限公司' },
    [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 实收数量: 1, 单价: 1, ...B }]],
  ['QC_RETURN', '暂收退料单', { 单据日期: today, 供应商: '深圳市陶氏水处理设备技术开发有限公司', 仓库: M.wh },
    [{ 行号: 1, 物料编码: M.code, 物料名称: M.name, 计量单位: M.unit, 退货数量: 1, 单价: 1, ...B }]],
  ['FINISH_IN', '产品入库单', { 单据日期: today, 业务类型: '产品入库单', 单据类型: '产品入库单' },
    [{ 行号: 1, 产品编码: M.code, 产品名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 实收数量: 1, ...B }]],
  ['OTHER_IN', '其他入库单', { 单据日期: today, 业务类型: '其他入库' },
    [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 数量: 1, 单价: 1, ...B }]],
  ['SALE_OUT', '销售出库单', { 单据日期: today, 客户: '长江', 客户编码: '001', 经手人: '张莉', 部门: '销售部', 仓库: M.wh, 仓库编码: M.whCode },
    [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 数量: 1, 售价: 1, ...B }]],
  ['MATERIAL_OUT', '材料出库单', { 单据日期: today, 业务类型: '生产领料' },
    [{ 行号: 1, 材料编码: M.code, 材料名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 数量: 1, 金额: 0, ...B }]],
  ['OTHER_OUT', '其他出库单', { 单据日期: today, 业务类型: '其他出库' },
    [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 数量: 1, ...B }]],
]

const out = []
for (const [panel, label, head, items] of plan) {
  const rec = { panel, label }
  const save = await call(panel, '保存', { ...head, detail: { items } })
  rec.no = String(save.body?.data?.['编号'] || '')
  if (!rec.no) { rec.ok = false; rec.why = '建单失败:' + String(save.body?.message || '').slice(0, 120); out.push(rec); console.log(JSON.stringify(rec)); continue }
  const aud = await call(panel, '审核', { 编号: rec.no })
  if ((aud.body?.code ?? aud.status) !== 200) { rec.ok = false; rec.why = '审核失败:' + String(aud.body?.message || '').slice(0, 120); out.push(rec); console.log(JSON.stringify(rec)); continue }
  const r = await erp(panel, rec.no)
  rec.ok = !!(r.data && String(r.data['是否已转ERP'] ?? '') === '是')
  rec.erpNo = r.data?.['ERP单号'] || ''
  rec.msg = r.msg
  out.push(rec)
  console.log(JSON.stringify(rec))
}
console.log('\n===== 汇总 =====')
for (const r of out) console.log(`${r.label.padEnd(6)} | ${r.no || '-'} | ${r.ok ? '✅ ' + r.erpNo : '⛔ ' + (r.why || r.msg)}`)
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-21.json', JSON.stringify(out, null, 2), 'utf8')
