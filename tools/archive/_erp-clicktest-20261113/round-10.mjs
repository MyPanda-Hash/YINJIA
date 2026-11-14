// round-10: 按金蝶报错逐项修数据后重试:
//  · 其他出库:经手人编码改沙箱里存在的 ZY00081(秦文静,来自金蝶拉取的样本单)
//  · 销售出库:补 仓库编码 / 基本单位三件套(金蝶拉取样本行上有:基本单位名称/编码/id=支/支/3)
//  · 暂收退料:仓库要写在**表头**(推送取头 仓库),否则回落正品仓(CK00001)库存不足
//  · 产品入库 / 材料出库:补 基本单位三件套 + 换算系数
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
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
const U = { name: '支', code: '支', id: '3' }
const results = []
async function buildAuditPush({ panel, label, head, items }) {
  const save = await call(panel, '保存', { ...head, detail: { items } })
  const no = String(save.body?.data?.['编号'] || '')
  const rec = { panel, label, no, saveMsg: String(save.body?.message || '').slice(0, 160) }
  if (!no) { results.push(rec); console.log(panel + ' 建单失败 ' + rec.saveMsg); return rec }
  const aud = await call(panel, '审核', { 编号: no })
  rec.auditMsg = String(aud.body?.message || '').slice(0, 160)
  if ((aud.body?.code ?? aud.status) !== 200) { results.push(rec); console.log(panel + ' ' + no + ' 审核失败 ' + rec.auditMsg); return rec }
  rec.erp = await erp(panel, no)
  results.push(rec)
  console.log(panel + ' ' + no + ' 转ERP → ' + rec.erp.status + ' ' + rec.erp.msg)
  return rec
}
const M = { code: 'YJ-TS-004', name: 'PP棉', unit: '支', wh: '恒亿仓', price: 0.96 }

// ① 其他出库(修经手人编码)
await buildAuditPush({
  panel: 'OTHER_OUT', label: '其他出库-沙箱物料',
  head: { 单据日期: today, 业务类型: '其他出库', 经手人: '秦文静', 经手人编码: 'ZY00081', 部门: '工程技术中心', 部门编码: 'BM00021' },
  items: [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 计量单位: M.unit, 数量: 1,
    基本单位名称: U.name, 基本单位编码: U.code, 基本单位id: U.id, 换算系数: '1' }],
})

// ② 销售出库(补仓库编码 + 单位三件套)
await buildAuditPush({
  panel: 'SALE_OUT', label: '销售出库-沙箱成品',
  head: { 单据日期: today, 客户: '大咖国际设备制造(河南)有限公司', 客户编码: 'C-84', 经手人: '张莉', 经手人编码: 'ZL', 部门: '销售部', 银行账号: '' },
  items: [{ 行号: 1, 存货编码: 'A-48-01', 存货名称: 'A级烧结炭棒/滤芯', 仓库: '成品B仓', 仓库编码: 'CP-02', 计量单位: '支',
    数量: 1, 售价: 1, 基本单位名称: U.name, 基本单位编码: U.code, 基本单位id: U.id, 换算系数: '1' }],
})

// ③ 暂收退料(仓库写表头)
await buildAuditPush({
  panel: 'QC_RETURN', label: '暂收退料-沙箱采购料',
  head: { 单据日期: today, 供应商: '深圳市陶氏水处理设备技术开发有限公司', 部门: '品质部', 仓库: M.wh },
  items: [{ 行号: 1, 物料编码: M.code, 物料名称: M.name, 计量单位: M.unit, 退货数量: 1, 单价: M.price,
    基本单位名称: U.name, 基本单位编码: U.code, 基本单位id: U.id, 换算系数: '1' }],
})

// ④ 产品入库(单位三件套)
await buildAuditPush({
  panel: 'FINISH_IN', label: '产品入库-沙箱成品',
  head: { 单据日期: today, 业务类型: '产品入库单', 单据类型: '产品入库单', 经手人: '余均亚', 经手人编码: 'ZY00022', 部门: '组装车间', 部门编码: 'BM00005' },
  items: [{ 行号: 1, 产品编码: 'A-48-01', 产品名称: 'A级烧结炭棒/滤芯', 仓库: '成品B仓', 仓库编码: 'CP-02', 计量单位: '支',
    实收数量: 1, 基本单位名称: U.name, 基本单位编码: U.code, 基本单位id: U.id, 换算系数: '1' }],
})

// ⑤ 材料出库(单位三件套)
await buildAuditPush({
  panel: 'MATERIAL_OUT', label: '材料出库-沙箱物料',
  head: { 单据日期: today, 业务类型: '生产领料', 经手人: '秦文静', 经手人编码: 'ZY00081' },
  items: [{ 行号: 1, 材料编码: M.code, 材料名称: M.name, 仓库: M.wh, 仓库编码: 'CK00006', 计量单位: M.unit, 数量: 1, 金额: 0,
    基本单位名称: U.name, 基本单位编码: U.code, 基本单位id: U.id, 换算系数: '1' }],
})

await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-10.json', JSON.stringify(results, null, 2), 'utf8')
