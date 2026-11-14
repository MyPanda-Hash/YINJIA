// round-09: 用**金蝶沙箱里确实存在**的物料/仓库/往来单位造 6 张单据(每张 1 件),审核后直连调「转ERP」,
// 把每张的报文级结果打出来(失败就换物料/降数量再试一次)。素材:
//  · YJ-TS-004(支) @ 恒亿仓 —— 本轮采购入库刚推成功过,沙箱确定有货;CUSTOMER/供应商=深圳市陶氏(该单供应商)
//  · A-48-01/A-48-12/A-48-17 @ 成品B仓 —— 销售出库报错里被点名"库存不足"(说明商品与仓库都存在于沙箱)
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
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
  return { status: r.status, code: r.body?.code, msg: String(r.body?.message || '').slice(0, 400), data: r.body?.data }
}
const today = new Date().toISOString().slice(0, 10)
const MATERIAL = { code: 'YJ-TS-004', name: '合单验证物料', unit: '支', wh: '恒亿仓', price: 0.96 }
const SUPPLIER = { name: '深圳市陶氏水处理设备技术开发有限公司', code: '' }
const results = []

/** 建单 → 审核 → 转ERP(失败把报文带出来) */
async function buildAuditPush({ panel, label, head, items }) {
  const save = await call(panel, '保存', { ...head, detail: { items } })
  const no = String(save.body?.data?.['编号'] || '')
  const rec = { panel, label, no, save: { status: save.status, msg: String(save.body?.message || '').slice(0, 200) } }
  if (!no) { results.push(rec); console.log(panel + ' 建单失败 ' + rec.save.msg); return rec }
  const aud = await call(panel, '审核', { 编号: no })
  rec.audit = { status: aud.status, code: aud.body?.code, msg: String(aud.body?.message || '').slice(0, 200) }
  if ((aud.body?.code ?? aud.status) !== 200) { results.push(rec); console.log(panel + ' ' + no + ' 审核失败 ' + rec.audit.msg); return rec }
  rec.erp = await erp(panel, no)
  results.push(rec)
  console.log(panel + ' ' + no + ' 转ERP → ' + rec.erp.status + ' ' + rec.erp.msg)
  return rec
}

// ① 其他入库(入库类,不消耗库存)
await buildAuditPush({
  panel: 'OTHER_IN', label: '其他入库-沙箱物料',
  head: { 单据日期: today, 业务类型: '其他入库', 经手人: '孙淼淼' },
  items: [{ 行号: 1, 存货编码: MATERIAL.code, 存货名称: MATERIAL.name, 仓库: MATERIAL.wh, 计量单位: MATERIAL.unit, 数量: 1, 单价: MATERIAL.price }],
})

// ② 其他出库(出库类,1 件)
await buildAuditPush({
  panel: 'OTHER_OUT', label: '其他出库-沙箱物料',
  head: { 单据日期: today, 业务类型: '其他出库', 经手人: '孙淼淼' },
  items: [{ 行号: 1, 存货编码: MATERIAL.code, 存货名称: MATERIAL.name, 仓库: MATERIAL.wh, 计量单位: MATERIAL.unit, 数量: 1 }],
})

// ③ 销售出库(成品 A-48-01 @ 成品B仓,1 件)
await buildAuditPush({
  panel: 'SALE_OUT', label: '销售出库-沙箱成品',
  head: { 单据日期: today, 客户: '大咖国际设备制造(河南)有限公司', 客户编码: 'C-84', 经手人: '张莉', 部门: '销售部', 交货方式: '车辆配送' },
  items: [{ 行号: 1, 存货编码: 'A-48-01', 存货名称: 'A级烧结炭棒/滤芯', 仓库: '成品B仓', 计量单位: '支', 数量: 1, 售价: 1 }],
})

// ④ 暂收退料(采购退货):用本轮采购入库推过的那家供应商 + 那件物料(沙箱里现在有货)
await buildAuditPush({
  panel: 'QC_RETURN', label: '暂收退料-沙箱采购料',
  head: { 单据日期: today, 供应商: SUPPLIER.name, 部门: '品质部' },
  items: [{ 行号: 1, 物料编码: MATERIAL.code, 物料名称: MATERIAL.name, 计量单位: MATERIAL.unit, 退货数量: 1, 单价: MATERIAL.price, 仓库: MATERIAL.wh }],
})

// ⑤ 产品入库(成品 A-48-01 @ 成品B仓)
await buildAuditPush({
  panel: 'FINISH_IN', label: '产品入库-沙箱成品',
  head: { 单据日期: today, 业务类型: '产品入库单', 单据类型: '产品入库单', 经手人: '余均亚', 部门: '组装车间' },
  items: [{ 行号: 1, 产品编码: 'A-48-01', 产品名称: 'A级烧结炭棒/滤芯', 仓库: '成品B仓', 计量单位: '支', 实收数量: 1 }],
})

// ⑥ 材料出库(生产领料):沙箱物料 + 1 件
await buildAuditPush({
  panel: 'MATERIAL_OUT', label: '材料出库-沙箱物料',
  head: { 单据日期: today, 业务类型: '生产领料', 经手人: '孙淼淼' },
  items: [{ 行号: 1, 材料编码: MATERIAL.code, 材料名称: MATERIAL.name, 仓库: MATERIAL.wh, 计量单位: MATERIAL.unit, 数量: 1, 金额: 0 }],
})

await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-09.json', JSON.stringify(results, null, 2), 'utf8')
