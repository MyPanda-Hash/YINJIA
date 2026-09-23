SET NOCOUNT ON;
PRINT '=== 1. 含 qc/insp/recv/return 的表 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%qc%' OR TABLE_NAME LIKE '%insp%' OR TABLE_NAME LIKE '%recv%' OR TABLE_NAME LIKE '%return%' ORDER BY TABLE_NAME;
GO
PRINT '=== 2. 检验项目/方案 表结构与行数 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_qc_item' ORDER BY ORDINAL_POSITION;
GO
SELECT COUNT(*) AS bs_qc_item_rows FROM bs_qc_item;
GO
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_qc_plan' ORDER BY ORDINAL_POSITION;
GO
SELECT COUNT(*) AS bs_qc_plan_rows FROM bs_qc_plan;
GO
PRINT '=== 3. 折叠棉等检验要求的存放处?找含 检验要求/材料 的表 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%mat%' OR TABLE_NAME LIKE '%item%' OR TABLE_NAME LIKE '%std%' OR TABLE_NAME LIKE '%lib%';
GO
PRINT '=== 4. 关键业务表行数 ===';
SELECT N'bd_qc_recv' AS t, COUNT(*) AS n FROM bd_qc_recv
UNION ALL SELECT N'bd_qc_insp', COUNT(*) FROM bd_qc_insp
UNION ALL SELECT N'bd_qc_return', COUNT(*) FROM bd_qc_return
UNION ALL SELECT N'bd_purchase_in', COUNT(*) FROM bd_purchase_in
UNION ALL SELECT N'bd_other_in', COUNT(*) FROM bd_other_in
UNION ALL SELECT N'bd_other_out', COUNT(*) FROM bd_other_out
UNION ALL SELECT N'bd_pu_order', COUNT(*) FROM bd_pu_order
UNION ALL SELECT N'qc_tc', COUNT(*) FROM qc_tc
UNION ALL SELECT N'rd_spec_doc_head', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT N'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'rd_prod_info_head', COUNT(*) FROM rd_prod_info_head
UNION ALL SELECT N'rd_plan', COUNT(*) FROM rd_plan;
