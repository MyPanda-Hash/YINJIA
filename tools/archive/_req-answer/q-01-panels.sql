SET NOCOUNT ON;
-- C 板块相关面板清单
SELECT panel_code, panel_name, category, mode, head_table, line_table, code_col, prefix
FROM yj_panel
WHERE panel_name LIKE N'%采购%' OR panel_name LIKE N'%暂收%' OR panel_name LIKE N'%检验%'
   OR panel_name LIKE N'%入库%' OR panel_name LIKE N'%出库%' OR panel_name LIKE N'%库存%'
   OR panel_name LIKE N'%特采%' OR panel_name LIKE N'%标签%' OR panel_name LIKE N'%商品%'
   OR panel_name LIKE N'%送料%' OR panel_name LIKE N'%退%'
ORDER BY panel_code;
GO
PRINT N'=== 元数据总量 ===';
SELECT (SELECT COUNT(*) FROM yj_panel) AS 面板数,
       (SELECT COUNT(*) FROM yj_field) AS 字段数,
       (SELECT COUNT(*) FROM yj_user) AS 用户数,
       (SELECT COUNT(*) FROM yj_role) AS 角色数;
GO
