SET NOCOUNT ON;

-- 1) inh 列
SELECT 'INHCOL|' + COLUMN_NAME + '|' + DATA_TYPE + '|' + ISNULL(CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR(10)),'')
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inh' ORDER BY ORDINAL_POSITION;

-- 2) inh src=13 行数 + 抽样
SELECT 'INH13|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) FROM inh WHERE src = 13;

-- 3) bd_material_ret 列
SELECT 'RETCOL|' + COLUMN_NAME + '|' + DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bd_material_ret' ORDER BY ORDINAL_POSITION;

-- 4) 生产退料单单据数
SELECT 'RETDOC|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) FROM bd_material_ret;
SELECT 'RETLINE|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) FROM bl_material_ret;

-- 5) 生产领料面板的字段清单(作为新面板的对照模板)
SELECT 'FIELD|' + CAST(seq AS VARCHAR(10)) + '|' + label + '|' + ISNULL(place,'') + '|visible=' + CAST(visible AS VARCHAR(3)) + '|hidden=' + CAST(hidden AS VARCHAR(3)) + '|type=' + ISNULL(field_type,'')
FROM yj_field WHERE panel_code='PROD_PICK_LIST' ORDER BY seq;

-- 6) 面板清单表结构(可能有独立的面板表)
SELECT 'PANELTBL|' + TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE 'yj_%' ORDER BY TABLE_NAME;
