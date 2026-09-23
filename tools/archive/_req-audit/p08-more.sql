SET NOCOUNT ON;
PRINT N'=== 1. RD_SPEC_DOC 全部字段 ===';
SELECT place, seq, col_name, label, data_type, LEFT(ISNULL(dict_sql,N''),80) AS dict_head, ISNULL(ref_panel,N'') AS refp, editable, required, hidden
FROM yj_field WHERE panel_code='RD_SPEC_DOC' ORDER BY place, seq;
GO
PRINT N'=== 2. RD_PLAN 表头字段 ===';
SELECT place, seq, col_name, label, data_type, LEFT(ISNULL(dict_sql,N''),60) AS dict_head, editable, required, hidden
FROM yj_field WHERE panel_code='RD_PLAN' AND place LIKE '%header%' ORDER BY seq;
GO
PRINT N'=== 3. RD_PROGRESS 全部字段 ===';
SELECT place, seq, col_name, label, data_type, LEFT(ISNULL(dict_sql,N''),80) AS dict_head, editable, required, hidden
FROM yj_field WHERE panel_code='RD_PROGRESS' ORDER BY place, seq;
GO
PRINT N'=== 4. 工序/工艺 基础库表 ===';
SELECT name FROM sys.tables WHERE name LIKE '%route%' OR name LIKE '%proc%' OR name LIKE '%process%' OR name LIKE '%craft%' OR name LIKE '%gongxu%' OR name LIKE 'bs[_]%' ORDER BY name;
GO
PRINT N'=== 5. yj_std_lib 库分布 ===';
SELECT lib_code, COUNT(*) AS cnt FROM yj_std_lib GROUP BY lib_code ORDER BY lib_code;
GO
PRINT N'=== 6. 产品信息表真实列 ===';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_prod_info_head' ORDER BY ORDINAL_POSITION;
GO
SELECT COUNT(*) AS prod_info_rows FROM rd_prod_info_head;
GO
PRINT N'=== 7. 全部 yj_panel: 含 RD / 研发 / 文件 字样的菜单注册 ===';
SELECT panel_code, panel_name, module_group, category, mode FROM yj_panel WHERE module_group IS NULL OR module_group NOT IN (N'研发管理') ORDER BY module_group, panel_code;
