SET NOCOUNT ON;

-- 1) 相关面板的行表/单头表
SELECT N'1-面板' AS 段, panel_code, panel_name, head_table, line_table
FROM yj_panel WHERE panel_code IN ('PURCHASE_IN', 'QC_INSP', 'QC_RETURN');

-- 2) 这三个面板上带「单位」的字段元数据
SELECT N'2-面板字段' AS 段, panel_code, col_name, label, data_type, place, hidden
FROM yj_field
WHERE (col_name LIKE N'%单位%' OR label LIKE N'%单位%')
  AND panel_code IN ('PURCHASE_IN', 'QC_INSP', 'QC_RETURN')
ORDER BY panel_code, col_name;

-- 3) 行表里带「单位」的物理列
SELECT N'3-行表列' AS 段, TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE N'%单位%'
  AND TABLE_NAME IN (SELECT line_table FROM yj_panel WHERE panel_code IN ('PURCHASE_IN', 'QC_INSP', 'QC_RETURN'))
ORDER BY TABLE_NAME, COLUMN_NAME;

-- 4) 采购入库行 单位/计量单位 填充情况(单位恒空 = 那行代码取不到值)
SELECT N'4-入库行' AS 段, COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(d.单位, N'') = N'' THEN 1 ELSE 0 END) AS 单位_空行,
       SUM(CASE WHEN ISNULL(d.单位, N'') <> N'' THEN 1 ELSE 0 END) AS 单位_有值行,
       SUM(CASE WHEN ISNULL(d.计量单位, N'') = N'' THEN 1 ELSE 0 END) AS 计量单位_空行
FROM bd_purchase_in_detail d;

-- 5) 来源检验行 单位 填充情况(有值 = 只要 SELECT 出来就能补进入库行)
SELECT N'5-检验行' AS 段, COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(单位, N'') = N'' THEN 1 ELSE 0 END) AS 单位_空行,
       SUM(CASE WHEN ISNULL(单位, N'') <> N'' THEN 1 ELSE 0 END) AS 单位_有值行,
       SUM(CASE WHEN ISNULL(计量单位, N'') = N'' THEN 1 ELSE 0 END) AS 计量单位_空行
FROM qc_insp_detail;
