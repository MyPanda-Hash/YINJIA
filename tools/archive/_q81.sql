SET NOCOUNT ON;
INSERT INTO bd_purchase_in (单据编号, 单据日期, 供应商, 供应商编码, 经手人, 汇率, 备注, 仓库, 单据状态)
VALUES (N'TEST-PUR-001', '2026-09-16', N'测试供应商A', N'TEST-SUP-A', N'管理员', 1, N'推送测试-采购入库', N'正品仓', N'已审核');
INSERT INTO bl_purchase_in (单据编号, 存货编码, 存货名称, 规格型号, 实收数量, 计量单位, 单价, [税率%], 金额, 含税金额, 批号, 仓库, 仓库编码)
VALUES
(N'TEST-PUR-001', N'TEST-MAT-A', N'测试物料A', N'A-001', 100, N'个', 25.5, 13, 2550, 2881.5, N'LOT20260916', N'正品仓', N'CK00001'),
(N'TEST-PUR-001', N'TEST-MAT-B', N'测试物料B', N'B-002', 50, N'箱', 80, 13, 4000, 4520, NULL, N'正品仓', N'CK00001');
INSERT INTO bd_sale_out (单据编号, 单据日期, 客户, 客户编码, 经手人, 汇率, 备注, 单据状态)
VALUES (N'TEST-SALE-001', '2026-09-16', N'测试客户X', N'TEST-CUS-X', N'管理员', 1, N'推送测试-销售出库', N'已审核');
INSERT INTO bl_sale_out (单据编号, 存货编码, 存货名称, 规格型号, 数量, 计量单位, 售价, [税率%], 销售金额, 含税销售金额, 仓库, 仓库编码)
VALUES (N'TEST-SALE-001', N'TEST-MAT-A', N'测试物料A', N'A-001', 30, N'个', 35, 13, 1050, 1186.5, N'正品仓', N'CK00001');
SELECT N'TEST-PUR-001' AS d, (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'TEST-PUR-001') AS n
UNION ALL SELECT N'TEST-SALE-001', (SELECT COUNT(*) FROM bl_sale_out WHERE 单据编号=N'TEST-SALE-001');
