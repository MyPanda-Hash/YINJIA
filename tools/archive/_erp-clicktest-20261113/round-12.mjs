// round-12: 基本单位修复后重推 产品入库/材料出库;其他出库去掉经手人编码;销售出库补表头仓库。
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
const results = []
const push = async (panel, no, label) => {
  const r = await erp(panel, no)
  results.push({ panel, no, label, ...r })
  console.log(panel + ' ' + no + ' → ' + r.status + ' ' + r.msg)
  return r
}

// ① 两张已存在的单直接重推(FI-2026-11-0002 / LL-2026-11-0019 都是"未转"状态)
await push('FINISH_IN', 'FI-2026-11-0002', '产品入库-沙箱成品')
await push('MATERIAL_OUT', 'LL-2026-11-0019', '材料出库-沙箱物料')

// ② 其他出库:不带经手人/编码(编码在沙箱查不到)
const today = new Date().toISOString().slice(0, 10)
const saveOo = await call('OTHER_OUT', '保存', {
  单据日期: today, 业务类型: '其他出库',
  detail: { items: [{ 行号: 1, 存货编码: 'YJ-TS-004', 存货名称: 'PP棉', 仓库: '恒亿仓', 计量单位: '支', 数量: 1,
    基本单位名称: '支', 基本单位编码: '支', 基本单位id: '3', 换算系数: '1' }] },
})
const ooNo = String(saveOo.body?.data?.['编号'] || '')
console.log('OTHER_OUT 建单 ' + ooNo + ' ' + String(saveOo.body?.message || '').slice(0, 120))
if (ooNo) { await call('OTHER_OUT', '审核', { 编号: ooNo }); await push('OTHER_OUT', ooNo, '其他出库-无经手人') }

// ③ 销售出库:补表头仓库(存单报"仓库不能为空")
const saveSo = await call('SALE_OUT', '保存', {
  单据日期: today, 客户: '大咖国际设备制造(河南)有限公司', 客户编码: 'C-84', 经手人: '张莉', 部门: '销售部',
  仓库: '成品B仓', 仓库编码: 'CP-02',
  detail: { items: [{ 行号: 1, 存货编码: 'A-48-01', 存货名称: 'A级烧结炭棒/滤芯', 仓库: '成品B仓', 仓库编码: 'CP-02',
    计量单位: '支', 数量: 1, 售价: 1, 基本单位名称: '支', 基本单位编码: '支', 基本单位id: '3', 换算系数: '1' }] },
})
const soNo = String(saveSo.body?.data?.['编号'] || '')
console.log('SALE_OUT 建单 ' + soNo + ' ' + String(saveSo.body?.message || '').slice(0, 160))
if (soNo) { const a = await call('SALE_OUT', '审核', { 编号: soNo }); console.log('SALE_OUT 审核 ' + a.status + ' ' + String(a.body?.message || '').slice(0, 120)); await push('SALE_OUT', soNo, '销售出库-沙箱成品') }

await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-12.json', JSON.stringify(results, null, 2), 'utf8')
