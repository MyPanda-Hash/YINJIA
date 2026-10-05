SET NOCOUNT ON;
GO
PRINT '=== 非报表类面板的 editable=0 明细列(会影响明细行内联编辑的候选) ===';
SELECT f.panel_code, ISNULL(p.panel_name,N'?') AS 面板名, ISNULL(p.category,N'') AS category,
       ISNULL(p.mode,N'') AS mode, f.seq, f.label, f.data_type
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.place = N'detail' AND ISNULL(f.editable,1) = 0 AND ISNULL(p.category,N'') <> N'报表'
ORDER BY f.panel_code, f.seq;
GO
