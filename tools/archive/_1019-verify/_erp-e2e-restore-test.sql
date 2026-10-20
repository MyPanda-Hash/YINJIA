/* 把 10.19 转ERP 端到端验证用的测试单据还原(两次尝试都不改业务口径,验证完即还原) */
UPDATE qc_return
   SET 供应商 = N'GYS00002', 仓库 = NULL, 是否已转ERP = NULL, ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL
 WHERE 单据编号 = N'TH-2026-10-0047'
GO
UPDATE qc_return_detail
   SET 物料编码 = N'CL004', 物料名称 = N'切削液', 计量单位 = N'升', 单位 = N'升', 退货数量 = 30
 WHERE 单据编号 = N'TH-2026-10-0047' AND ISNULL(asp_cancel,'N')<>'Y'
GO
SELECT r.单据编号, r.供应商, ISNULL(r.仓库,N'(空)') AS 仓库, r.是否已转ERP, d.物料编码, d.计量单位, d.退货数量
FROM qc_return r JOIN qc_return_detail d ON d.单据编号=r.单据编号 WHERE r.单据编号=N'TH-2026-10-0047'
