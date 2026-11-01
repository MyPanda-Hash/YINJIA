SET NOCOUNT ON;
SELECT 'A1-列数' AS what, CAST(COUNT(*) AS varchar(20)) AS val FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
GO
SELECT 'A1-审计列' AS what, c.name AS col, t.name AS typ, c.is_nullable AS nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_asm_bom')
  AND c.name IN (N'asp_user1', N'asp_time1', N'asp_user2', N'asp_time2', N'asp_cancel')
ORDER BY c.name;
GO
SELECT 'A1-索引' AS what, i.name AS idx, i.type_desc, i.is_primary_key, i.is_unique, i.is_disabled, i.has_filter
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.bs_asm_bom') AND i.type > 0 ORDER BY i.is_primary_key DESC, i.name;
GO
SELECT 'A1-索引键列' AS what, i.name AS idx, ic.index_column_id, c.name AS col, ic.is_included_column
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE i.object_id = OBJECT_ID('dbo.bs_asm_bom') AND i.type > 0 ORDER BY i.name, ic.index_column_id;
GO
SELECT 'A2-表注明' AS what, COUNT(*) AS cnt, MAX(CAST(ep.value AS nvarchar(400))) AS descr
FROM sys.extended_properties ep
WHERE ep.major_id = OBJECT_ID('dbo.bs_asm_bom') AND ep.minor_id = 0 AND ep.name = 'MS_Description';
GO
SELECT 'A2-缺注列' AS what, COUNT(*) AS cnt
FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.bs_asm_bom')
  AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description');
GO
SELECT 'A2-列注明数' AS what, COUNT(*) AS cnt
FROM sys.extended_properties ep
WHERE ep.class = 1 AND ep.major_id = OBJECT_ID('dbo.bs_asm_bom') AND ep.name = 'MS_Description';
GO
SELECT 'A2-空文案列' AS what, COUNT(*) AS cnt FROM sys.extended_properties ep
WHERE ep.class=1 AND ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND (ep.value IS NULL OR LTRIM(RTRIM(CAST(ep.value AS nvarchar(400)))) = '');
GO
SELECT c.column_id, c.name AS col, LEFT(CAST(ep.value AS nvarchar(200)), 50) AS descr
FROM sys.columns c LEFT JOIN sys.extended_properties ep
  ON ep.class=1 AND ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description'
WHERE c.object_id = OBJECT_ID('dbo.bs_asm_bom') ORDER BY c.column_id;
GO
SELECT 'A3-panel' AS what, panel_code, panel_name, panel_name_en, category, mode, line_table,
       ISNULL(head_table, '<NULL>') AS head_table, group_col, pk_col, code_col, prefix,
       ISNULL(date_col, '<NULL>') AS date_col, page_size, detail_key, module_group
FROM yj_panel WHERE panel_code = 'ASM_BOM';
GO
SELECT 'A4-字段数' AS what, COUNT(*) AS cnt FROM yj_field WHERE panel_code = 'ASM_BOM';
GO
SELECT id, col_name, label, data_type, place, seq, width, editable, required, hidden, visible,
       CASE WHEN COL_LENGTH('dbo.bs_asm_bom', col_name) IS NULL THEN N'!!列不存在' ELSE N'OK' END AS phys
FROM yj_field WHERE panel_code = 'ASM_BOM' ORDER BY seq, id;
GO
SELECT 'A4-物理列缺失' AS what, COUNT(*) AS cnt FROM yj_field WHERE panel_code='ASM_BOM' AND COL_LENGTH('dbo.bs_asm_bom', col_name) IS NULL;
GO
SELECT 'A4-非法place' AS what, COUNT(*) AS cnt FROM yj_field WHERE panel_code='ASM_BOM'
  AND (place IS NULL OR place NOT IN (N'query', N'header', N'detail', N'query,header', N'query,detail', N'header,detail', N'query,header,detail'));
GO
SELECT 'A4-同col多place' AS what, COUNT(*) AS cnt FROM (
  SELECT col_name FROM yj_field WHERE panel_code='ASM_BOM' GROUP BY col_name HAVING COUNT(DISTINCT place) > 1) x;
GO
SELECT 'A4-完全重复(panel,col,place,seq)' AS what, COUNT(*) AS cnt FROM (
  SELECT col_name, place, seq FROM yj_field WHERE panel_code='ASM_BOM'
  GROUP BY col_name, place, seq HAVING COUNT(*) > 1) x;
GO
SELECT 'A4-重复col' AS what, COUNT(*) AS cnt FROM (
  SELECT col_name FROM yj_field WHERE panel_code='ASM_BOM' GROUP BY col_name HAVING COUNT(*) > 1) x;
GO
SELECT 'A4-place分布' AS what, place, COUNT(*) AS cnt FROM yj_field WHERE panel_code='ASM_BOM' GROUP BY place ORDER BY place;
GO
SELECT 'A5-面板译名' AS what, locale, text FROM yj_translation WHERE scope='panel' AND ref_key=N'组装物料清单' ORDER BY locale;
GO
SELECT 'A5-面板译名语言数' AS what, COUNT(DISTINCT locale) AS cnt FROM yj_translation WHERE scope='panel' AND ref_key=N'组装物料清单';
GO
SELECT 'A5-字段缺en' AS what, label FROM (
  SELECT DISTINCT label FROM yj_field f WHERE f.panel_code='ASM_BOM'
    AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en')) x ORDER BY label;
GO
SELECT 'A5-字段en清单' AS what, f.label, (SELECT TOP 1 text FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en') AS en
FROM yj_field f WHERE f.panel_code='ASM_BOM' GROUP BY f.label ORDER BY f.label;
GO
SELECT 'A6-角色数' AS what, COUNT(*) AS cnt FROM yj_role;
GO
SELECT 'A6-授权行' AS what, COUNT(*) AS cnt FROM yj_role_panel WHERE panel_code='ASM_BOM';
GO
SELECT 'A6-视图行' AS what, COUNT(*) AS cnt FROM yj_role_panel WHERE panel_code='ASM_BOM' AND perms LIKE '%view%';
GO
SELECT 'A6-query行' AS what, COUNT(*) AS cnt FROM yj_role_panel WHERE panel_code='ASM_BOM' AND perms LIKE '%query%';
GO
SELECT 'A6-未授权角色' AS what, COUNT(*) AS cnt FROM yj_role r WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.panel_code='ASM_BOM' AND rp.role_id=r.id);
GO
SELECT 'A6-perms明细' AS what, perms, COUNT(*) AS cnt FROM yj_role_panel WHERE panel_code='ASM_BOM' GROUP BY perms;
GO
