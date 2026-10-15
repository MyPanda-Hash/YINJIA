-- q-16-panel-shape.sql — 新建 flat 报表面板所需字段与现成先例(STOCK_STATUS = flat + kucun)
SET NOCOUNT ON;
SELECT N'yj_panel 列' AS k, c.name, t.name AS 类型, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_panel') ORDER BY c.column_id;
GO
SELECT N'先例面板全字段' AS k, * FROM yj_panel WHERE panel_code IN ('STOCK_STATUS','STOCK_BALANCE');
GO
SELECT N'yj_panel 现有 panel_code 前缀' AS k, LEFT(panel_code, 6) AS 前缀, COUNT(*) AS 个数
FROM yj_panel GROUP BY LEFT(panel_code, 6) ORDER BY 个数 DESC;
GO
SELECT N'库存相关菜单面板是否在权限表' AS k, * FROM yj_panel WHERE module_group LIKE N'%库存%';
GO
