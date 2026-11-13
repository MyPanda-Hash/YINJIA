// round-13: ① 销售出库:不传客户编码(改由推送按名称反查沙箱客户);② 产品入库:改用采购入库那件"沙箱确定有单位"的物料。
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
  return { status: r.status, code: r.body?.code, msg: String(r.body?.message || '').slice(0, 350) }
}
const today = new Date().toISOString().slice(0, 10)
const out = []

// ① 销售出库:只给客户名称
const so = await call('SALE_OUT', '保存', {
  单据日期: today, 客户: '大咖国际设备制造(河南)有限公司', 经手人: '张莉', 部门: '销售部', 仓库: '成品B仓', 仓库编码: 'CP-02',
  detail: { items: [{ 行号: 1, 存货编码: 'A-48-01', 存货名称: 'A级烧结炭棒/滤芯', 仓库: '成品B仓', 仓库编码: 'CP-02',
    计量单位: '支', 数量: 1, 售价: 1, 基本单位名称: '支', 基本单位编码: '支', 基本单位id: '3', 换算系数: '1' }] },
})
const soNo = String(so.body?.data?.['编号'] || '')
console.log('SALE_OUT 建单 ' + soNo + ' ' + String(so.body?.message || '').slice(0, 120))
if (soNo) {
  const a = await call('SALE_OUT', '审核', { 编号: soNo })
  console.log('SALE_OUT 审核 ' + a.status)
  const r = await erp('SALE_OUT', soNo)
  out.push({ panel: 'SALE_OUT', no: soNo, ...r })
  console.log('SALE_OUT ' + soNo + ' → ' + r.status + ' ' + r.msg)
}

// ② 产品入库:用 YJ-TS-004(采购入库已证明沙箱有该商品与单位)
const fi = await call('FINISH_IN', '保存', {
  单据日期: today, 业务类型: '产品入库单', 单据类型: '产品入库单', 经手人: '余均亚', 部门: '组装车间',
  detail: { items: [{ 行号: 1, 产品编码: 'YJ-TS-004', 产品名称: 'PP棉', 仓库: '恒亿仓', 仓库编码: 'CK00006',
    计量单位: '支', 实收数量: 1, 基本单位名称: '支', 基本单位编码: '支', 基本单位id: '3', 换算系数: '1' }] },
})
const fiNo = String(fi.body?.data?.['编号'] || '')
console.log('FINISH_IN 建单 ' + fiNo + ' ' + String(fi.body?.message || '').slice(0, 120))
if (fiNo) {
  const a = await call('FINISH_IN', '审核', { 编号: fiNo })
  console.log('FINISH_IN 审核 ' + a.status + ' ' + String(a.body?.message || '').slice(0, 160))
  const r = await erp('FINISH_IN', fiNo)
  out.push({ panel: 'FINISH_IN', no: fiNo, ...r })
  console.log('FINISH_IN ' + fiNo + ' → ' + r.status + ' ' + r.msg)
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-13.json', JSON.stringify(out, null, 2), 'utf8')
