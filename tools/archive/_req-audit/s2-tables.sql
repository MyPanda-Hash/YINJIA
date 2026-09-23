SET NOCOUNT ON;
PRINT N'===== A. 6面板 head/detail 真实表列 =====';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('rd_prod_info_head','rd_prod_info_detail','rd_spec_doc_head','rd_spec_doc_detail',
  'rd_asm_proc_head','rd_asm_proc_detail','rd_insp_plan_head','rd_insp_plan_detail',
  'rd_asm_bom_head','rd_asm_bom_detail','rd_mold_proc_head','rd_mold_proc_detail')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO

SET NOCOUNT ON;
PRINT N'===== B. 6面板表行数 =====';
SELECT 'rd_prod_info_head' t, COUNT(*) n FROM rd_prod_info_head
UNION ALL SELECT 'rd_prod_info_detail', COUNT(*) FROM rd_prod_info_detail
UNION ALL SELECT 'rd_spec_doc_head', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT 'rd_spec_doc_detail', COUNT(*) FROM rd_spec_doc_detail
UNION ALL SELECT 'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT 'rd_asm_proc_detail', COUNT(*) FROM rd_asm_proc_detail
UNION ALL SELECT 'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT 'rd_insp_plan_detail', COUNT(*) FROM rd_insp_plan_detail
UNION ALL SELECT 'rd_asm_bom_head', COUNT(*) FROM rd_asm_bom_head
UNION ALL SELECT 'rd_asm_bom_detail', COUNT(*) FROM rd_asm_bom_detail
UNION ALL SELECT 'rd_mold_proc_head', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT 'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail;
GO

SET NOCOUNT ON;
PRINT N'===== C. 所有含 proc/process/route/craft/std 的表 =====';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%proc%' OR TABLE_NAME LIKE '%route%' OR TABLE_NAME LIKE '%craft%'
   OR TABLE_NAME LIKE '%std%' OR TABLE_NAME LIKE '%step%' OR TABLE_NAME LIKE '%_bs_%'
   OR TABLE_NAME LIKE 'bs[_]%' OR TABLE_NAME LIKE '%gongxu%'
ORDER BY TABLE_NAME;
GO

SET NOCOUNT ON;
PRINT N'===== D. 下发相关表 =====';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%dev_task%' OR TABLE_NAME LIKE '%assign%' OR TABLE_NAME LIKE '%dispatch%'
   OR TABLE_NAME LIKE '%approval%' OR TABLE_NAME LIKE '%doc_status%' OR TABLE_NAME LIKE '%flow%'
   OR TABLE_NAME LIKE '%notify%' OR TABLE_NAME LIKE '%message%' OR TABLE_NAME LIKE '%todo%'
   OR TABLE_NAME LIKE '%contract%'
ORDER BY TABLE_NAME;
GO

SET NOCOUNT ON;
PRINT N'===== E. rd_dev_task 列 + 行数 + 全量数据 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_dev_task' ORDER BY ORDINAL_POSITION;
GO

SET NOCOUNT ON;
SELECT COUNT(*) AS rd_dev_task_rows FROM rd_dev_task;
GO

SET NOCOUNT ON;
PRINT N'-- rd_dev_task 全量(前50) --';
SELECT * FROM rd_dev_task;
GO

SET NOCOUNT ON;
PRINT N'-- rd_dev_task 按面板聚合 --';
SELECT 面板代码, COUNT(*) n FROM rd_dev_task GROUP BY 面板代码 ORDER BY 面板代码;
GO

SET NOCOUNT ON;
PRINT N'-- rd_dev_task 按状态聚合 --';
SELECT 状态, COUNT(*) n FROM rd_dev_task GROUP BY 状态 ORDER BY 状态;
GO
