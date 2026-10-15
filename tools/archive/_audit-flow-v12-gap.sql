SET NOCOUNT ON;
SELECT DB_NAME() AS 数据库;

PRINT N'=== A. ERP 导入(基础资料/采购单/销售订单) ===';
SELECT 'bd_pu_order 总行/带外部ID' AS 项, COUNT(*) AS 总行, SUM(CASE WHEN ISNULL(外部数据ID,N'')<>N'' THEN 1 ELSE 0 END) AS 带外部ID FROM dbo.bd_pu_order
UNION ALL SELECT 'bd_so_order', COUNT(*), SUM(CASE WHEN ISNULL(外部数据ID,N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.bd_so_order
UNION ALL SELECT 'bs_inv 存货档案', COUNT(*), SUM(CASE WHEN ISNULL(来料检验,N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== B. 采购链链路计数(ACTIVE) ===';
SELECT source_panel_code + N'->' + target_panel_code AS 链路, COUNT(*) AS 行数, SUM(ISNULL(linked_quantity,0)) AS 数量
FROM dbo.form_flow_link WHERE link_status='ACTIVE' GROUP BY source_panel_code, target_panel_code ORDER BY 链路;

PRINT N'=== C. 采购四单单据量 ===';
SELECT 'PU_ORDER' AS 面板, COUNT(*) AS 行数 FROM dbo.bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_RECV', COUNT(*) FROM dbo.sl_recv WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_INSP', COUNT(*) FROM dbo.qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_RETURN', COUNT(*) FROM dbo.qc_return WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'PURCHASE_IN', COUNT(*) FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== D. 工单双轨(bd_manu_order vs plang) ===';
SELECT 'bd_manu_order' AS 表, COUNT(*) AS 行数 FROM dbo.bd_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'plang 工单行', COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'plang_pc 排产行', COUNT(*) FROM dbo.plang_pc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'wo_progress 工序任务', COUNT(*) FROM dbo.wo_progress WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'wo_process_line 预排台账', COUNT(*) FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== E. 五道工序报工(scjl 按工序) ===';
SELECT ISNULL(gxdm,N'(空)') AS 工序, COUNT(*) AS 报工行, SUM(CASE WHEN RTRIM(ISNULL(wgzt,N''))=N'Y' THEN 1 ELSE 0 END) AS 已完工行,
 SUM(ISNULL(sl,0)) AS 报工数量 FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY gxdm ORDER BY 工序;

PRINT N'=== F. 工艺路线与工序字典 ===';
SELECT r.工艺路线编码, COUNT(*) AS 工序数, MAX(CASE WHEN ISNULL(r.asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 有效
FROM dbo.bs_route r GROUP BY r.工艺路线编码 ORDER BY r.工艺路线编码;

PRINT N'=== G. 工序质检单量 ===';
SELECT 'QC_MOLD_INSP 成型' AS 面板, COUNT(*) AS 行数 FROM dbo.qc_mold_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_CUT_INSP 切炭', COUNT(*) FROM dbo.qc_cut_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_ASM_INSP 组装', COUNT(*) FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_FIRST_INSP 首件', COUNT(*) FROM dbo.qc_first_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_PROC_INSP 制程', COUNT(*) FROM dbo.qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_TC_IN 特采', COUNT(*) FROM dbo.qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== H. 仓库档案(隔离仓/不良品仓) ===';
SELECT 生产线, 生产车间 FROM dbo.bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT 仓库编码, 仓库名称, ISNULL(仓库类型,N'') AS 仓库类型 FROM dbo.bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 仓库编码;

PRINT N'=== I. 成品入库与销售出库 ===';
SELECT 'FINISH_IN 产成品入库' AS 面板, COUNT(*) AS 行数 FROM dbo.bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'SALE_OUT 销货出库', COUNT(*) FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'MATERIAL_OUT 材料出库', COUNT(*) FROM dbo.bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== J. 财务(应付/应收/对账/成本) ===';
SELECT name AS 对象, type_desc AS 类型 FROM sys.objects
WHERE (name LIKE N'%payable%' OR name LIKE N'%receivable%' OR name LIKE N'%arap%' OR name LIKE N'%statement%'
    OR name LIKE N'%应付%' OR name LIKE N'%应收%' OR name LIKE N'%对账%')
  AND type IN ('U','V') ORDER BY name;

PRINT N'=== K. 二维码/条码相关表 ===';
SELECT name AS 对象 FROM sys.objects WHERE (name LIKE N'%qr%' OR name LIKE N'%barcode%' OR name LIKE N'%二维码%' OR name LIKE N'%label%') AND type IN ('U','V') ORDER BY name;
