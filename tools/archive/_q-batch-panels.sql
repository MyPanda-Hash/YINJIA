SET NOCOUNT ON;
-- 哪些面板注册了「批次号」头字段(⇒ isBatchPanel=true ⇒ 保存/审核会走 syncBatchNo)
SELECT N'1-BATCH-PANELS' AS seg, f.panel_code,
       CAST(MAX(CASE WHEN f.col_name = N'批次号' THEN 1 ELSE 0 END) AS varchar(5)) AS yj_批次号,
       CAST(MAX(CASE WHEN f.col_name = N'批次键' THEN 1 ELSE 0 END) AS varchar(5)) AS yj_批次键,
       CAST(MAX(CASE WHEN f.col_name = N'供应商编码' THEN 1 ELSE 0 END) AS varchar(5)) AS yj_供应商编码,
       CAST(MAX(CASE WHEN f.col_name = N'供应商代码' THEN 1 ELSE 0 END) AS varchar(5)) AS yj_供应商代码
FROM yj_field f WHERE f.place LIKE '%header%'
GROUP BY f.panel_code HAVING MAX(CASE WHEN f.col_name = N'批次号' THEN 1 ELSE 0 END) = 1
ORDER BY f.panel_code;
-- 这些面板的头表里到底有没有「批次键」物理列
SELECT N'2-PHYS' AS seg, p.panel_code, p.head_table,
       CAST(COL_LENGTH(p.head_table, N'批次号') AS varchar(10)) AS len_批次号,
       CAST(COL_LENGTH(p.head_table, N'批次键') AS varchar(10)) AS len_批次键
FROM yj_panel p
WHERE p.panel_code IN (SELECT panel_code FROM yj_field WHERE place LIKE '%header%' AND col_name = N'批次号')
ORDER BY p.panel_code;
