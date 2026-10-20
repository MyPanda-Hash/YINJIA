/* 10.19 转ERP 端到端验证:把测试账套一张已审核的暂收退料单改成"沙箱档案里存在"的供应商/单位 */
UPDATE qc_return SET 供应商 = N'广东元丰化学试剂有限公司' WHERE 单据编号 = N'TH-2026-10-0047'
GO
UPDATE qc_return_detail SET 计量单位 = N'kg', 单位 = N'kg' WHERE 单据编号 = N'TH-2026-10-0047' AND ISNULL(asp_cancel,'N')<>'Y'
GO
SELECT r.单据编号, r.供应商, r.仓库, r.是否已转ERP, d.物料编码, d.计量单位, d.退货数量
FROM qc_return r JOIN qc_return_detail d ON d.单据编号=r.单据编号
WHERE r.单据编号=N'TH-2026-10-0047'
