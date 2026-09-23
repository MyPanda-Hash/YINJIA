SET NOCOUNT ON;
PRINT N'===== A. bs_op 全量(工序基础库?) =====';
SELECT * FROM bs_op ORDER BY id;
GO
SET NOCOUNT ON;
PRINT N'-- bs_op 工序类型 分布 --';
SELECT 工序类型, COUNT(*) n FROM bs_op GROUP BY 工序类型;
GO
SET NOCOUNT ON;
PRINT N'-- bs_op 加工方式 分布 --';
SELECT 加工方式, COUNT(*) n FROM bs_op GROUP BY 加工方式;
GO

SET NOCOUNT ON;
PRINT N'===== B. bs_bom 列+行数 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_bom' ORDER BY ORDINAL_POSITION;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS bs_bom_rows FROM bs_bom;
GO
SET NOCOUNT ON;
SELECT TOP 20 * FROM bs_bom;
GO

SET NOCOUNT ON;
PRINT N'===== C. bs_inv 列+行数 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_inv' ORDER BY ORDINAL_POSITION;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS bs_inv_rows FROM bs_inv;
GO
SET NOCOUNT ON;
SELECT TOP 15 * FROM bs_inv;
GO

SET NOCOUNT ON;
PRINT N'===== D. yj_field 中 检测频率/检验频率 字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, place, seq
FROM yj_field WHERE label LIKE N'%频率%' OR col_name LIKE N'%频率%' ORDER BY panel_code, place, seq;
GO

SET NOCOUNT ON;
PRINT N'===== E. yj_field dict_sql 含 每批/生产量/型式检验 的字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE dict_sql LIKE N'%每批%' OR dict_sql LIKE N'%生产量%' OR dict_sql LIKE N'%型式检验%';
GO

SET NOCOUNT ON;
PRINT N'===== F. yj_field dict_sql 含 裸棒/半成品/成品 的字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE dict_sql LIKE N'%裸棒%' OR dict_sql LIKE N'%半成品%' OR dict_sql LIKE N'%成品%';
GO

SET NOCOUNT ON;
PRINT N'===== G. yj_field 中 工序 相关字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, place, seq
FROM yj_field WHERE label LIKE N'%工序%' OR col_name LIKE N'%工序%' ORDER BY panel_code, place, seq;
GO
