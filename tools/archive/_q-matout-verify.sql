-- 验证:材料出库单接口并集写入结果
SET NOCOUNT ON;
SELECT '列数' AS k, 'bd_material_out' AS obj, CAST(COUNT(*) AS nvarchar(20)) AS v FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
UNION ALL SELECT '列数','bl_material_out', CAST(COUNT(*) AS nvarchar(20)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_material_out')
UNION ALL SELECT '面板字段数','MATERIAL_OUT', CAST(COUNT(*) AS nvarchar(20)) FROM yj_field WHERE panel_code='MATERIAL_OUT'
UNION ALL SELECT '面板字段·显示','MATERIAL_OUT', CAST(COUNT(*) AS nvarchar(20)) FROM yj_field WHERE panel_code='MATERIAL_OUT' AND visible=1 AND hidden=0
UNION ALL SELECT '面板字段·隐藏','MATERIAL_OUT', CAST(COUNT(*) AS nvarchar(20)) FROM yj_field WHERE panel_code='MATERIAL_OUT' AND hidden=1
UNION ALL SELECT '中文注明(新列)','合计', CAST(COUNT(*) AS nvarchar(20)) FROM sys.extended_properties ep
  WHERE ep.name='MS_Description' AND ep.minor_id>0 AND ISNULL(CAST(ep.value AS nvarchar(400)),'') LIKE N'%inv_pick%'
UNION ALL SELECT '译名(en)','field', CAST(COUNT(*) AS nvarchar(20)) FROM yj_translation WHERE scope='field' AND locale='en'
  AND ref_key IN (SELECT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT')
UNION ALL SELECT '转ERP四列','bd_material_out', CAST(COUNT(*) AS nvarchar(20)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out') AND name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间');
PRINT '=== 面板字段清单(place/visible) ===';
SELECT place, col_name, label, visible, hidden, seq FROM yj_field WHERE panel_code='MATERIAL_OUT' ORDER BY place, seq;
GO
