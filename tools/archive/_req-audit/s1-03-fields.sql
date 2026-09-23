SET NOCOUNT ON;
GO
SELECT N'S1-8b: RD_* 面板中 label 含 受控/履历/文件编码/审核/版本/修订' AS sec,
       panel_code, col_name, label, data_type, dict_sql
FROM yj_field
WHERE panel_code LIKE 'RD%'
  AND (label LIKE N'%受控%' OR label LIKE N'%履历%' OR label LIKE N'%文件编码%'
       OR label LIKE N'%审核%' OR label LIKE N'%版本%' OR label LIKE N'%修订%')
ORDER BY panel_code, seq;
GO
SELECT N'S1-8c: 任意面板 label 精确含 受控/履历/文件编码/修订/版本' AS sec,
       panel_code, col_name, label, data_type
FROM yj_field
WHERE label LIKE N'%受控%' OR label LIKE N'%履历%' OR label LIKE N'%文件编码%'
   OR label LIKE N'%修订%' OR label LIKE N'%版本%'
ORDER BY panel_code, seq;
GO
SELECT N'S1-8d: 任意面板 col_name 含 受控/履历/编码/filecode/control' AS sec,
       panel_code, col_name, label
FROM yj_field
WHERE col_name LIKE N'%受控%' OR col_name LIKE N'%履历%' OR col_name LIKE N'%filecode%'
   OR col_name LIKE N'%file_code%' OR col_name LIKE N'%control%' OR col_name LIKE N'%编码%'
ORDER BY panel_code, seq;
GO
SELECT N'S1-8e: 物理表列名含 受控/履历/编码/受控章' AS sec,
       TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE N'%受控%' OR COLUMN_NAME LIKE N'%履历%' OR COLUMN_NAME LIKE N'%编码%'
   OR COLUMN_NAME LIKE N'%filecode%' OR COLUMN_NAME LIKE N'%file_code%'
   OR COLUMN_NAME LIKE N'%code%'
ORDER BY TABLE_NAME, COLUMN_NAME;
GO
SELECT N'S1-8f: 表名含 受控/履历/汇总/编码/contro/ledger/archive' AS sec, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE N'%受控%' OR TABLE_NAME LIKE N'%履历%' OR TABLE_NAME LIKE N'%汇总%'
   OR TABLE_NAME LIKE N'%编码%' OR TABLE_NAME LIKE N'%contro%' OR TABLE_NAME LIKE N'%ledger%'
   OR TABLE_NAME LIKE N'%summary%' OR TABLE_NAME LIKE N'%doc_file%' OR TABLE_NAME LIKE N'%file%'
ORDER BY TABLE_NAME;
GO
