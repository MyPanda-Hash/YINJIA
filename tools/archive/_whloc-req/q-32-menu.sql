SET NOCOUNT ON;
PRINT N'=== 菜单里 数据字典 的位置 ===';
SELECT m.id, m.菜单名称 AS 名称, ISNULL(m.面板代码,N'') AS 面板, ISNULL(p.菜单名称,N'') AS 上级
FROM yj_menu m LEFT JOIN yj_menu p ON p.id=m.上级id
WHERE m.菜单名称 LIKE N'%字典%' OR m.面板代码 IN (N'ZDGL',N'WHLOC',N'WH');
GO