-- q-18-perm.sql — yj_role_panel 结构与三张库存报表的授权行(新面板要照抄的授权面)
SET NOCOUNT ON;
SELECT N'yj_role_panel 列' AS k, c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_role_panel') ORDER BY c.column_id;
GO
SELECT N'角色' AS k, * FROM yj_role;
GO
SELECT N'三张报表的授权角色' AS k, panel_code, COUNT(*) AS 角色数,
       STUFF((SELECT ',' + CAST(rp2.role_id AS varchar(10)) FROM yj_role_panel rp2 WHERE rp2.panel_code = rp.panel_code ORDER BY rp2.role_id FOR XML PATH('')), 1, 1, '') AS 角色列表
FROM yj_role_panel rp WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY') GROUP BY panel_code;
GO
SELECT TOP 3 N'授权行样式' AS k, * FROM yj_role_panel WHERE panel_code = 'STOCK_LEDGER' ORDER BY role_id;
GO
SELECT N'是否已存在 STOCK_DETAIL' AS k, (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'STOCK_DETAIL') AS 面板行,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL') AS 字段行,
       (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = 'STOCK_DETAIL') AS 授权行;
GO
