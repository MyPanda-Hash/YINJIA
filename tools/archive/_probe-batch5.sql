SET NOCOUNT ON;
GO
PRINT '=== editable=0 明细字段所属面板 ===';
SELECT f.panel_code, COUNT(*) AS 只读明细列数, ISNULL(p.panel_name,N'<未注册>') AS 面板名,
       ISNULL(p.mode,N'') AS mode, ISNULL(p.category,N'') AS category
FROM yj_field f LEFT JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.place = N'detail' AND ISNULL(f.editable,1) = 0
GROUP BY f.panel_code, p.panel_name, p.mode, p.category
ORDER BY f.panel_code;
GO
