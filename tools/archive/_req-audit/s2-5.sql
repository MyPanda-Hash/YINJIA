SET NOCOUNT ON;
PRINT N'===== 1. yj_form_approval 按面板+action 分布(是否有 RD_*) =====';
SELECT panel_code, action, result, COUNT(*) n, MIN(node_no) mn, MAX(node_no) mx
FROM yj_form_approval GROUP BY panel_code, action, result ORDER BY panel_code, action;
GO

SET NOCOUNT ON;
PRINT N'===== 2. RD_* 面板的审批记录数 =====';
SELECT COUNT(*) AS rd_approval_rows FROM yj_form_approval WHERE panel_code LIKE 'RD%';
GO

SET NOCOUNT ON;
PRINT N'===== 3. yj_doc_status 中 RD_* 面板状态分布 =====';
SELECT panel_code, COUNT(*) n,
  SUM(CASE WHEN ISNULL(archived,'N')='Y' THEN 1 ELSE 0 END) archived_n,
  SUM(CASE WHEN ISNULL(pending,'N')='Y' THEN 1 ELSE 0 END) pending_n,
  SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END) shr_n
FROM yj_doc_status WHERE panel_code LIKE 'RD%' GROUP BY panel_code ORDER BY panel_code;
GO

SET NOCOUNT ON;
PRINT N'===== 4. yj_std_lib 库清单(lib_code 分布) =====';
SELECT lib_code, COUNT(*) n, MIN(item_code) sample_item FROM yj_std_lib GROUP BY lib_code ORDER BY lib_code;
GO

SET NOCOUNT ON;
PRINT N'===== 5. bs_dict 全部字典类别(找工序分类候选) =====';
SELECT 字典类别, COUNT(*) n, MIN(名称) AS 首项 FROM bs_dict GROUP BY 字典类别 ORDER BY 字典类别;
GO

SET NOCOUNT ON;
PRINT N'===== 6. bs_dict 中名称含 工序/裸棒/半成品/成品/棒 的条目 =====';
SELECT 字典类别, 代码, 名称, 停用 FROM bs_dict
WHERE 名称 LIKE N'%工序%' OR 名称 LIKE N'%裸棒%' OR 名称 LIKE N'%半成品%' OR 名称 LIKE N'%成品%'
ORDER BY 字典类别, 代码;
GO

SET NOCOUNT ON;
PRINT N'===== 7. OP_TYPE 字典原文 =====';
SELECT 字典类别, 代码, 名称, 停用 FROM bs_dict WHERE 字典类别='OP_TYPE' ORDER BY 代码;
GO

SET NOCOUNT ON;
PRINT N'===== 8. 所有含"分类/类别/状态"列的 表(找工序库) =====';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE (COLUMN_NAME LIKE N'%分类%' OR COLUMN_NAME LIKE N'%类别%' OR COLUMN_NAME LIKE N'%工序%' OR COLUMN_NAME LIKE N'%类%')
  AND (TABLE_NAME LIKE 'bs%' OR TABLE_NAME LIKE 'yj%' OR TABLE_NAME LIKE 'rd%')
ORDER BY TABLE_NAME, COLUMN_NAME;
GO

SET NOCOUNT ON;
PRINT N'===== 9. RD_* 表全清单 =====';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'rd[_]%' ORDER BY TABLE_NAME;
GO

SET NOCOUNT ON;
PRINT N'===== 10. RD 面板行数总览 =====';
SELECT 'rd_prod_info_head' t, COUNT(*) n FROM rd_prod_info_head
UNION ALL SELECT 'rd_spec_doc_head', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT 'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT 'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT 'rd_mold_proc_head', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT 'rd_asm_bom_head', COUNT(*) FROM rd_asm_bom_head
UNION ALL SELECT 'rd_dev_task', COUNT(*) FROM rd_dev_task
UNION ALL SELECT 'rd_spec_assign', COUNT(*) FROM rd_spec_assign;
GO
