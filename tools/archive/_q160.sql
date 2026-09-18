SET NOCOUNT ON;
-- 建一张带采购订单号的已审核测试单
INSERT INTO bd_purchase_in (单据编号, 单据日期, 供应商, 供应商编码, 经手人, 备注, 仓库, 单据状态, 审核人, 审核时间, 是否已转ERP, 采购订单号, asp_user1, asp_time1, asp_time2, asp_cancel)
VALUES (N'TCGRK-PO-001', '2026-09-17', N'惠州市双喜科技有限公司', N'YJ-20260916-01-供应商', N'测试导入', N'带订单号转ERP验证', N'华北工控仓', N'已审核', N'测试导入', GETDATE(), N'否', N'YJ-20260916-01', 'test-seed', GETDATE(), GETDATE(), 'N');
INSERT INTO bl_purchase_in (单据编号, 存货编码, 存货名称, 规格型号, 实收数量, 计量单位, 单价, 金额, 仓库, 仓库编码, 是否来料检验, asp_user1, asp_time1, asp_cancel)
SELECT N'TCGRK-PO-001', N'YJ-SX-031', N'端盖', N'036', 100, N'个', 1, 100, N'华北工控仓', N'CK00006', N'是', 'test-seed', GETDATE(), 'N';
-- 修供应商编码为真实档案的
UPDATE bd_purchase_in SET 供应商编码=(SELECT TOP 1 dm FROM dm_gf WHERE mc=N'惠州市双喜科技有限公司') WHERE 单据编号=N'TCGRK-PO-001';
IF NOT EXISTS(SELECT 1 FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no=N'TCGRK-PO-001')
  INSERT INTO yj_doc_status (panel_code, doc_no, shr, shsj, canceled, stopped, pending, update_at)
  VALUES ('PURCHASE_IN', N'TCGRK-PO-001', N'测试导入', GETDATE(), 'N', 'N', 'N', GETDATE());
SELECT '创建成功' AS r;
