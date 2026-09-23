SET NOCOUNT ON;
-- 每面板一行字段数统计
SELECT panel_code,
       COUNT(*) AS 字段数,
       SUM(CASE WHEN dict_sql IS NOT NULL AND LTRIM(RTRIM(dict_sql)) <> '' THEN 1 ELSE 0 END) AS 有字典数,
       SUM(CASE WHEN ref_panel IS NOT NULL AND LTRIM(RTRIM(ref_panel)) <> '' THEN 1 ELSE 0 END) AS 有参照数,
       SUM(CASE WHEN editable = 1 THEN 1 ELSE 0 END) AS 可编辑数,
       SUM(CASE WHEN required = 1 THEN 1 ELSE 0 END) AS 必填数
FROM yj_field
WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','QC_TC','QC_JJF','PURCHASE_IN','OTHER_IN','OTHER_OUT',
                     'PU_ORDER','STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','INV','RKD','CKD','QC_BHC','QC_LYB')
GROUP BY panel_code
ORDER BY panel_code;
GO
-- 有字典的字段(选项=业务口径)
SELECT panel_code + N' . ' + col_name + N' [' + label + N'] => ' +
       REPLACE(REPLACE(dict_sql, CHAR(13), N' '), CHAR(10), N' ') AS 字典
FROM yj_field
WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','QC_TC','QC_JJF','PURCHASE_IN','OTHER_IN','OTHER_OUT',
                     'PU_ORDER','STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','INV','RKD','CKD')
  AND dict_sql IS NOT NULL AND LTRIM(RTRIM(dict_sql)) <> ''
ORDER BY panel_code, seq;
GO
