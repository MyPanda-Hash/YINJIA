SET NOCOUNT ON;
DECLARE @m TABLE(old_no nvarchar(56), new_no nvarchar(56));
INSERT @m SELECT DISTINCT p.pl_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
SELECT N'来源单号命中' k, COUNT(*) n FROM dbo.form_flow_link f JOIN @m m ON f.source_form_no=m.old_no
UNION ALL SELECT N'目标单号命中', COUNT(*) FROM dbo.form_flow_link f JOIN @m m ON f.target_form_no=m.old_no
UNION ALL SELECT N'来源行键命中', COUNT(*) FROM dbo.form_flow_link f JOIN @m m ON f.source_line_key LIKE m.old_no + N'#%'
UNION ALL SELECT N'目标行键命中', COUNT(*) FROM dbo.form_flow_link f JOIN @m m ON f.target_line_key LIKE m.old_no + N'#%';
SELECT source_panel_code, target_panel_code, COUNT(*) n
FROM dbo.form_flow_link f JOIN @m m ON f.source_form_no=m.old_no OR f.target_form_no=m.old_no
GROUP BY source_panel_code, target_panel_code ORDER BY n DESC;
GO
