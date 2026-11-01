SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m;
SELECT DISTINCT p.pl_no AS old_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) AS new_no INTO #m FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
GO
SELECT COUNT(*) AS 审批单引用 FROM dbo.yj_form_approval a JOIN #m m ON a.form_no=m.old_no;
GO
SELECT TOP 10 u.doc_no, u.event_type, u.panel_name, u.action_name, CONVERT(varchar(19),u.created_at,120) created_at
FROM dbo.yj_usage_log u JOIN #m m ON u.doc_no=m.old_no;
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_material_out') ORDER BY c.column_id;
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_out') ORDER BY c.column_id;
GO
