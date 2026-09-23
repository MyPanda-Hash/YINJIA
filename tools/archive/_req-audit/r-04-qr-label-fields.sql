-- r-04:二维码/标签/打印 相关字段与字典
SET NOCOUNT ON;
GO
PRINT '=== [1] yj_field 里 label 含 二维码/条码/标签/标识卡/打印 的字段 ===';
SELECT panel_code, col_name, label, data_type, place, visible, hidden
FROM yj_field
WHERE label LIKE N'%二维码%' OR label LIKE N'%条码%' OR label LIKE N'%标签%'
   OR label LIKE N'%标识卡%' OR label LIKE N'%打印%' OR col_name LIKE N'%qr%'
   OR col_name LIKE N'%barcode%' OR col_name LIKE N'%label%'
ORDER BY panel_code, col_name;
GO
PRINT '=== [2] 批次/lot 相关字段(C10 材料码内容=物料编码+批次+单箱数量) ===';
SELECT panel_code, col_name, label, data_type, place
FROM yj_field
WHERE label LIKE N'%批次%' OR label LIKE N'%批号%' OR label LIKE N'%lot%'
   OR col_name LIKE N'%lot%' OR col_name LIKE N'%batch%'
ORDER BY panel_code, col_name;
GO
PRINT '=== [3] 箱数/单箱数量 相关字段 ===';
SELECT panel_code, col_name, label, data_type
FROM yj_field WHERE label LIKE N'%箱数%' OR label LIKE N'%单箱%' OR label LIKE N'%装箱%'
ORDER BY panel_code, col_name;
GO
PRINT '=== [4] 特采 相关面板与字段 ===';
SELECT panel_code, col_name, label, data_type, place, dict_sql
FROM yj_field
WHERE col_name LIKE N'%特采%' OR label LIKE N'%特采%' OR dict_sql LIKE N'%特采%'
ORDER BY panel_code, col_name;
GO
PRINT '=== [5] 检验结果 字典(是否含 合格/不合格/特采) ===';
SELECT panel_code, col_name, label, data_type, dict_sql
FROM yj_field
WHERE (panel_code LIKE N'%QC%' OR panel_code LIKE N'%INSP%')
  AND (label LIKE N'%结果%' OR label LIKE N'%判定%');
GO
