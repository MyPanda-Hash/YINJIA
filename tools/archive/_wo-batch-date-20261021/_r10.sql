SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m;
SELECT DISTINCT p.pl_no AS old_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) AS new_no INTO #m FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_form_approval') ORDER BY c.column_id;
GO
SELECT N'yj_usage_log' k, COUNT(*) n FROM dbo.yj_usage_log u JOIN #m m ON u.doc_no=m.old_no
UNION ALL SELECT N'yj_doc_status', COUNT(*) FROM dbo.yj_doc_status s JOIN #m m ON s.doc_no=m.old_no
UNION ALL SELECT N'yj_doc_annotation', COUNT(*) FROM dbo.yj_doc_annotation a JOIN #m m ON a.doc_no=m.old_no
UNION ALL SELECT N'yj_attachment', COUNT(*) FROM dbo.yj_attachment a JOIN #m m ON a.doc_no=m.old_no
UNION ALL SELECT N'wo_split_log.父工单号', COUNT(*) FROM dbo.wo_split_log s JOIN #m m ON s.[父工单号]=m.old_no
UNION ALL SELECT N'wo_split_log.子工单号', COUNT(*) FROM dbo.wo_split_log s JOIN #m m ON s.[子工单号]=m.old_no
UNION ALL SELECT N'wo_split_log.根工单号', COUNT(*) FROM dbo.wo_split_log s JOIN #m m ON s.[根工单号]=m.old_no
UNION ALL SELECT N'Porder.tm', COUNT(*) FROM dbo.Porder p JOIN #m m ON p.tm=m.old_no
UNION ALL SELECT N'form_flow_source_detail_key', COUNT(*) FROM dbo.form_flow_link f JOIN #m m ON f.source_detail_key=m.old_no
UNION ALL SELECT N'form_flow_target_detail_key', COUNT(*) FROM dbo.form_flow_link f JOIN #m m ON f.target_detail_key=m.old_no;
GO
