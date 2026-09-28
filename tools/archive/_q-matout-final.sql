-- 收尾验证:材料出库单接口并集 + 转ERP 接线(两账套各跑一遍)
SET NOCOUNT ON;
SELECT '列数 bd_material_out' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
UNION ALL SELECT '列数 bl_material_out', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_material_out')
UNION ALL SELECT '字段数 MATERIAL_OUT', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='MATERIAL_OUT'
UNION ALL SELECT '…其中显示', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='MATERIAL_OUT' AND hidden=0 AND visible=1
UNION ALL SELECT '…其中隐藏', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='MATERIAL_OUT' AND hidden=1
UNION ALL SELECT '转ERP 四列', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out') AND name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间')
UNION ALL SELECT 'inv_pick 中文注明列', CAST(COUNT(*) AS nvarchar(10)) FROM sys.extended_properties WHERE name='MS_Description' AND minor_id>0 AND CAST(value AS nvarchar(400)) LIKE N'%inv_pick%'
UNION ALL SELECT '材料出库单数(头/行)', CAST((SELECT COUNT(*) FROM bd_material_out) AS nvarchar(10)) + N'/' + CAST((SELECT COUNT(*) FROM bl_material_out) AS nvarchar(10))
UNION ALL SELECT 'E2E 造数残留', CAST(COUNT(*) AS nvarchar(10)) FROM bd_material_out WHERE 单据编号 LIKE 'CL-2026-09-%'
UNION ALL SELECT '转ERP候选(已审核未转)', CAST(COUNT(*) AS nvarchar(10)) FROM bd_material_out h INNER JOIN yj_doc_status s ON s.panel_code='MATERIAL_OUT' AND s.doc_no=h.单据编号 AND s.shr IS NOT NULL WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(h.是否已转ERP,N'否')<>N'是';
GO
