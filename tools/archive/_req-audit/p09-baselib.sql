SET NOCOUNT ON;
PRINT N'=== 1. 工序/工艺路线/检验基础库 表结构+行数 ===';
SELECT t.name AS tbl, CAST(p.rows AS INT) AS rows_approx
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name IN ('bs_op','bs_route','bs_qc_item','bs_qc_plan','bs_proj','bs_bom','bs_dict','bs_wc','bs_equip') ORDER BY t.name;
GO
PRINT N'=== 2. bs_op 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_op' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== 3. bs_route 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_route' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== 4. OP(工序)/ROUTE(工艺路线)/QC_ITEM/QC_PLAN 面板字段 ===';
SELECT panel_code, place, seq, col_name, label, data_type, LEFT(ISNULL(dict_sql,N''),100) AS dict_head, ISNULL(ref_panel,N'') AS refp
FROM yj_field WHERE panel_code IN ('OP','ROUTE','QC_ITEM','QC_PLAN','BOM') ORDER BY panel_code, place, seq;
GO
PRINT N'=== 5. 全部 yj_panel 中 category=基础设置/基础档案 的面板数 ===';
SELECT category, mode, COUNT(*) FROM yj_panel GROUP BY category, mode ORDER BY category, mode;
GO
PRINT N'=== 6. yj_message 消息码 (SPEC/TERM 相关) 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_message' ORDER BY ORDINAL_POSITION;
GO
