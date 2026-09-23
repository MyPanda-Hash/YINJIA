SET NOCOUNT ON;
PRINT '=== yj_std_lib 结构与行数 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_std_lib' ORDER BY ORDINAL_POSITION;
GO
SELECT COUNT(*) AS rows_std_lib FROM yj_std_lib;
GO
PRINT '=== 关键业务表行数 ===';
SELECT N'qc_recv' AS t, COUNT(*) AS n FROM qc_recv
UNION ALL SELECT N'qc_insp', COUNT(*) FROM qc_insp
UNION ALL SELECT N'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT N'qc_tc', COUNT(*) FROM qc_tc
UNION ALL SELECT N'sl_recv', COUNT(*) FROM sl_recv
UNION ALL SELECT N'purchase_in_head', COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='purchase_in_head';
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('bd_purchase_in','purchase_in','bl_purchase_in','bd_other_in','bd_other_out','bd_pu_order') ORDER BY TABLE_NAME;
GO
SELECT N'bd_other_in' AS t, COUNT(*) AS n FROM bd_other_in UNION ALL SELECT N'bd_other_out', COUNT(*) FROM bd_other_out UNION ALL SELECT N'bd_pu_order', COUNT(*) FROM bd_pu_order;
GO
PRINT '=== 研发表行数 ===';
SELECT N'rd_spec_doc_head' AS t, COUNT(*) AS n FROM rd_spec_doc_head UNION ALL SELECT N'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head UNION ALL SELECT N'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head UNION ALL SELECT N'rd_prod_info_head', COUNT(*) FROM rd_prod_info_head UNION ALL SELECT N'rd_plan', COUNT(*) FROM rd_plan UNION ALL SELECT N'rd_approval', COUNT(*) FROM rd_approval UNION ALL SELECT N'rd_progress', COUNT(*) FROM rd_progress;
