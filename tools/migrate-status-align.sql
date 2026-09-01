-- 单据状态对齐迁移(以工作流注册表 yj_doc_status 为准):
-- A. 种子数据直写的"已审核/审批中"重置回草稿(无注册表审核留痕的)
-- B. 重建 v_sales_order_detail(状态列派生,与其他明细视图同构)
USE HSDZ_MES;
SET NOCOUNT ON;

-- ===== A. 重置种子噪音(有真实审核留痕的不动) =====
UPDATE bd_so_order SET 单据状态=N'草稿', 审核人=NULL, 审核时间=NULL, 审批人=NULL, 审批时间=NULL
WHERE 单据状态<>N'草稿' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='SO_ORDER' AND s.doc_no=bd_so_order.[单据编号] AND (s.shr IS NOT NULL OR ISNULL(s.canceled,'N')='Y'));
UPDATE bd_pu_order SET 单据状态=N'草稿', 审核人=NULL, 审核时间=NULL, 审批人=NULL, 审批时间=NULL
WHERE 单据状态<>N'草稿' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=bd_pu_order.[单据编号] AND (s.shr IS NOT NULL OR ISNULL(s.canceled,'N')='Y'));
UPDATE bd_manu_order SET 单据状态=N'草稿', 审核人=NULL, 审核时间=NULL, 审批人=NULL, 审批时间=NULL
WHERE 单据状态<>N'草稿' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='MANU_ORDER' AND s.doc_no=bd_manu_order.[合同号] AND (s.shr IS NOT NULL OR ISNULL(s.canceled,'N')='Y'));
UPDATE bd_dispatch SET 单据状态=N'草稿', 审核人=NULL, 审核时间=NULL, 审批人=NULL, 审批时间=NULL
WHERE 单据状态<>N'草稿' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='DISPATCH' AND s.doc_no=bd_dispatch.[单据编号] AND (s.shr IS NOT NULL OR ISNULL(s.canceled,'N')='Y'));
UPDATE bd_outsource_order SET 单据状态=N'草稿', 审核人=NULL, 审核时间=NULL, 审批人=NULL, 审批时间=NULL
WHERE 单据状态<>N'草稿' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='OUTSOURCE_ORDER' AND s.doc_no=bd_outsource_order.[单据编号] AND (s.shr IS NOT NULL OR ISNULL(s.canceled,'N')='Y'));

-- ===== B. 销售订单明细视图(状态列派生) =====
IF OBJECT_ID('v_sales_order_detail') IS NOT NULL DROP VIEW v_sales_order_detail;
EXEC(N'CREATE VIEW v_sales_order_detail AS SELECT h.[id], h.[单据编号], h.[单据日期], h.[客户], h.[客户编码], h.[结算客户], h.[部门], h.[部门负责人], h.[业务员], h.[项目], h.[预计交货日期], h.[联系人], h.[备注], h.[审核时间], h.[审批人], h.[审批时间], h.asp_user1, h.asp_time1, h.asp_cancel'
  + N', l.[单据编号] AS line_no, l.[存货名称品牌], l.[存货名称], l.[存货编码], l.[规格型号], l.[数量], l.[销售单位], l.[单价], l.[税率%], l.[含税单价], l.[金额], l.[含税金额], l.[折扣金额], l.[现存量]'
  + N', CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'''
  + N' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'''
  + N' WHEN s.shr IS NOT NULL THEN N''已审核'''
  + N' ELSE N''草稿'' END AS [单据状态]'
  + N', s.shr AS [审核人]'
  + N' FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]'
  + N' LEFT JOIN yj_doc_status s ON s.panel_code = ''SO_ORDER'' AND s.doc_no = h.[单据编号]');

-- ===== 验证 =====
SELECT N'销售订单明细-状态分布' AS k, 单据状态, COUNT(*) AS cnt FROM v_sales_order_detail GROUP BY 单据状态;
SELECT N'重置后头表状态' AS k, 单据状态, COUNT(*) AS cnt FROM bd_so_order GROUP BY 单据状态;
GO
