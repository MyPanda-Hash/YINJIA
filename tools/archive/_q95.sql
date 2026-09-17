SET NOCOUNT ON;
-- 建一张全新的测试单(不推过金蝶)
INSERT INTO bd_purchase_in (单据编号, 单据日期, 供应商, 供应商编码, 经手人, 备注, 仓库, 单据状态, asp_time1, asp_time2)
VALUES (N'BTN-TEST-001', '2026-09-16', N'推送测试供应商', N'TEST-SUP-A', N'管理员', N'按钮转ERP测试', N'正品仓', N'已审核', GETDATE(), GETDATE());
INSERT INTO bl_purchase_in (单据编号, 存货编码, 存货名称, 规格型号, 实收数量, 计量单位, 单价, 仓库, 仓库编码)
VALUES (N'BTN-TEST-001', N'TEST-MAT-A', N'测试物料A', N'A-001', 10, N'个', 25, N'正品仓', N'CK00001');
-- 写状态机(已审核)
IF NOT EXISTS(SELECT 1 FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no=N'BTN-TEST-001')
  INSERT INTO yj_doc_status (panel_code, doc_no, shr, shsj, saved) VALUES ('PURCHASE_IN', N'BTN-TEST-001', N'管理员', '2026-09-16', 'Y');
SELECT N'BTN-TEST-001 创建成功' AS r;
