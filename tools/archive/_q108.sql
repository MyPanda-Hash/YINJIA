SET NOCOUNT ON;
INSERT INTO bd_purchase_in (单据编号, 单据日期, 供应商, 供应商编码, 经手人, 备注, 仓库, 单据状态, asp_time1, asp_time2, 是否已转ERP)
VALUES (N'FLOW-TEST-001', '2026-09-16', N'测试供应商A', N'TEST-SUP-A', N'管理员', N'流程测试', N'正品仓', N'草稿', GETDATE(), GETDATE(), N'否');
INSERT INTO bl_purchase_in (单据编号, 存货编码, 存货名称, 规格型号, 实收数量, 计量单位, 单价, 仓库, 仓库编码)
VALUES (N'FLOW-TEST-001', N'TEST-MAT-A', N'测试物料A', N'A-001', 5, N'个', 10, N'正品仓', N'CK00001');
SELECT '创建成功' AS r;
