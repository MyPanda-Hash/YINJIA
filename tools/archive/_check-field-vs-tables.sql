-- 一次性检查脚本:全量比对 yj_field.col_name 是否存在于面板头表/行表(口径=prune-orphan-fields:
-- place 含 detail → 必须是 line_table 列;含 header/query 不含 detail → head_table(非NULL) 或 line_table 之一)
SET NOCOUNT ON;
SELECT f.panel_code, f.place, f.col_name, f.label,
       COALESCE(p.head_table + '/', '') + p.line_table AS tables,
       f.col_name AS missing_in_both
FROM yj_field f
JOIN yj_panel p ON f.panel_code = p.panel_code
WHERE p.mode IN ('doc','archive')
  AND (
    -- detail 字段:必须行表列
    (f.place LIKE '%detail%' AND COL_LENGTH(p.line_table, f.col_name) IS NULL)
    OR
    -- header/query 字段:头表(非空)或行表至少一处存在
    (f.place NOT LIKE '%detail%'
     AND (p.head_table IS NULL OR p.head_table = '')
     AND COL_LENGTH(p.line_table, f.col_name) IS NULL)
    OR
    (f.place NOT LIKE '%detail%'
     AND p.head_table IS NOT NULL
     AND COL_LENGTH(p.head_table, f.col_name) IS NULL
     AND COL_LENGTH(p.line_table, f.col_name) IS NULL)
  )
ORDER BY f.panel_code, f.place;
