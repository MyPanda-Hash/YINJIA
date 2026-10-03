SET NOCOUNT ON;
-- 1) line_table/head_table 鎸囧悜鐨勫璞′笉瀛樺湪
SELECT 'MISSING_TABLE' AS kind, p.panel_code, p.line_table AS tbl FROM yj_panel p
WHERE p.line_table IS NOT NULL AND OBJECT_ID(p.line_table) IS NULL
UNION ALL
SELECT 'MISSING_TABLE', p.panel_code, p.head_table FROM yj_panel p
WHERE p.head_table IS NOT NULL AND OBJECT_ID(p.head_table) IS NULL;
-- 2) 瀛楁寮曠敤鐨勫垪涓嶅瓨鍦?鎸?place 鍒嗘祦:鍚?header 鎴栫函 query 鈫?澶磋〃,鍏朵綑 鈫?琛岃〃;浠呭熀琛?
--    绾?query 浣嶅瓧娈?濡傛暟鎹褰曡〃鐨?鎶ュ憡缂栧彿/娴嬭瘯涓婚)鐗╃悊鍒楀湪澶磋〃鈥斺€旀紡鍒や細鏁存壒璇姤銆?
SELECT 'MISSING_COL' AS kind, f.panel_code,
  CASE WHEN (f.place LIKE '%header%' OR f.place = 'query') AND p.head_table IS NOT NULL THEN p.head_table ELSE p.line_table END AS tbl,
  f.label, f.col_name
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.col_name IS NOT NULL
  AND OBJECT_ID(CASE WHEN (f.place LIKE '%header%' OR f.place = 'query') AND p.head_table IS NOT NULL THEN p.head_table ELSE p.line_table END, 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(CASE WHEN (f.place LIKE '%header%' OR f.place = 'query') AND p.head_table IS NOT NULL THEN p.head_table ELSE p.line_table END)
      AND c.name = f.col_name);