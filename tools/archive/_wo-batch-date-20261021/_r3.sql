SET NOCOUNT ON;
SELECT c.name AS col, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.form_flow_link') ORDER BY c.column_id;
GO
DECLARE @m TABLE(old_no nvarchar(56), new_no nvarchar(56));
INSERT @m SELECT DISTINCT p.pl_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
SELECT source_panel_code, target_panel_code, COUNT(*) n
FROM dbo.form_flow_link f JOIN @m m ON f.source_doc_no=m.old_no OR f.target_doc_no=m.old_no
GROUP BY source_panel_code, target_panel_code;
GO
