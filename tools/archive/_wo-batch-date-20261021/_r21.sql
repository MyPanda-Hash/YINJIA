SET NOCOUNT ON;
DECLARE @m TABLE(old_no nvarchar(56));
INSERT @m SELECT DISTINCT p.pl_no FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
SELECT TOP 5 f.source_panel_code, f.source_form_no, f.source_line_key, f.target_panel_code, f.target_form_no, f.target_line_key, f.link_status
FROM dbo.form_flow_link f JOIN @m m ON f.target_form_no=m.old_no ORDER BY f.id;
SELECT TOP 5 f.source_panel_code, f.source_form_no, f.source_line_key, f.target_panel_code, f.target_form_no, f.target_line_key, f.link_status
FROM dbo.form_flow_link f JOIN @m m ON f.source_form_no=m.old_no ORDER BY f.id;
GO
