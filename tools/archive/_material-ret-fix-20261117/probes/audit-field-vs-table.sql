SET NOCOUNT ON;
/* 审计:yj_field 声明的列在对应的物理表上是否存在
   单据面板(doc, head_table 非空):place 含 header ⇒ 必须在 head_table 上;place 含 detail ⇒ 必须在 line_table 上
   平表/档案(flat/archive):place 任意 ⇒ 必须在 line_table 上 */
SELECT '[' + p.panel_code + '] ' + p.mode + ' | ' + f.label + ' | col=' + f.col_name
       + ' | place=' + f.place + ' | table=' + p.line_table + ' | visible=' + CAST(f.visible AS varchar(2)) AS 问题
  FROM dbo.yj_field f
  JOIN dbo.yj_panel p ON p.panel_code = f.panel_code
 WHERE ( (p.head_table IS NOT NULL AND CHARINDEX('header', f.place) > 0
          AND COL_LENGTH('dbo.' + p.head_table, f.col_name) IS NULL)
      OR (CHARINDEX('detail', f.place) > 0
          AND COL_LENGTH('dbo.' + p.line_table, f.col_name) IS NULL)
      OR (p.head_table IS NULL AND CHARINDEX('header', f.place) > 0
          AND COL_LENGTH('dbo.' + p.line_table, f.col_name) IS NULL) )
 ORDER BY p.panel_code, f.place, f.seq;
