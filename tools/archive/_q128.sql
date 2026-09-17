SET NOCOUNT ON;
-- 找出 git 仓库中引用的但数据库中不存在的面板
SELECT DISTINCT panel_code FROM yj_panel ORDER BY panel_code;
