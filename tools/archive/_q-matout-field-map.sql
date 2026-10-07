-- _q-matout-field-map.sql — 材料出库单字段 ↔ 金蝶生产领料单(inv_pick)对照取证
-- 用法(库名可换 HSDZ_MES_TEST):
--   sqlcmd -S 127.0.0.1 -U yinjia -P *** -d HSDZ_MES -W -h -1 -s"|" -i tools\archive\_q-matout-field-map.sql
SET NOCOUNT ON;

PRINT '## A. 两表列 ↔ 金蝶 inv_pick 接口键(取自列 MS_Description 中文注明)';
SELECT t.name + '|' + c.name + '|' + ISNULL(CAST(ep.value AS nvarchar(400)), '')
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE t.name IN ('bd_material_out', 'bl_material_out')
ORDER BY t.name, c.column_id;

PRINT '## B. yj_field 注册(MATERIAL_OUT):col_name|label|place|visible|hidden|seq|ref_panel|ref_field';
SELECT ISNULL(col_name,'') + '|' + ISNULL(label,'') + '|' + ISNULL(place,'') + '|'
     + CAST(ISNULL(visible,0) AS nvarchar(4)) + '|' + CAST(ISNULL(hidden,0) AS nvarchar(4)) + '|'
     + CAST(ISNULL(seq,0) AS nvarchar(8)) + '|' + ISNULL(ref_panel,'') + '|' + ISNULL(ref_field,'')
FROM yj_field WHERE panel_code = 'MATERIAL_OUT'
ORDER BY CASE WHEN place LIKE '%header%' OR place = 'query' THEN 0 ELSE 1 END, seq, id;

PRINT '## C. 计数汇总';
SELECT '列数 bd_material_out|' + CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bd_material_out')
UNION ALL SELECT '列数 bl_material_out|' + CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bl_material_out')
UNION ALL SELECT '带 inv_pick 注明的列|' + CAST(COUNT(*) AS nvarchar(10)) FROM sys.extended_properties
  WHERE name = 'MS_Description' AND minor_id > 0 AND CAST(value AS nvarchar(400)) LIKE N'%inv_pick%'
UNION ALL SELECT 'yj_field 总数|' + CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = 'MATERIAL_OUT'
UNION ALL SELECT 'yj_field 显示中|' + CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND hidden = 0 AND visible = 1
UNION ALL SELECT 'yj_field 隐藏|' + CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND hidden = 1
UNION ALL SELECT '转ERP 四列|' + CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bd_material_out')
  AND name IN (N'是否已转ERP', N'ERP单号', N'转ERP操作人', N'转ERP时间')
UNION ALL SELECT '单据数 头/行|' + CAST((SELECT COUNT(*) FROM bd_material_out) AS nvarchar(10)) + '/' + CAST((SELECT COUNT(*) FROM bl_material_out) AS nvarchar(10))
UNION ALL SELECT '已审核|' + CAST(COUNT(*) AS nvarchar(10)) FROM bd_material_out h
  JOIN yj_doc_status s ON s.panel_code = 'MATERIAL_OUT' AND s.doc_no = h.单据编号 AND s.shr IS NOT NULL
  WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
UNION ALL SELECT '已审核未转ERP|' + CAST(COUNT(*) AS nvarchar(10)) FROM bd_material_out h
  JOIN yj_doc_status s ON s.panel_code = 'MATERIAL_OUT' AND s.doc_no = h.单据编号 AND s.shr IS NOT NULL
  WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(h.是否已转ERP, N'否') <> N'是'
UNION ALL SELECT '已转ERP|' + CAST(COUNT(*) AS nvarchar(10)) FROM bd_material_out WHERE ISNULL(是否已转ERP, N'否') = N'是';
GO
