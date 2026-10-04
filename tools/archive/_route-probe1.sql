-- 工艺路线(ROUTE)现状取证 ① 表结构 + 面板元数据
SELECT '=== 0. yj_panel 列 ===' AS x;
SELECT c.column_id AS seq, c.name AS col, t.name AS typ
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('yj_panel') ORDER BY c.column_id;
GO
SELECT '=== 1. bs_route 列 ===' AS x;
SELECT c.column_id AS seq, c.name AS col, t.name AS typ, c.max_length AS len, c.is_nullable AS nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('bs_route') ORDER BY c.column_id;
GO
SELECT '=== 2. bs_route 行数 ===' AS x;
SELECT COUNT(*) AS rows_total, COUNT(DISTINCT 工艺路线编码) AS routes FROM bs_route;
GO
SELECT '=== 3. bs_route 前 5 行 ===' AS x;
SELECT TOP 5 * FROM bs_route ORDER BY id;
GO
SELECT '=== 4. yj_panel 中含 route 的行 ===' AS x;
SELECT * FROM yj_panel WHERE table_name IN ('bs_route','bs_op','bs_work_center','bs_team','bs_equip');
GO
SELECT '=== 5. 引用 bs_route 的库对象 ===' AS x;
SELECT name, type_desc FROM sys.objects WHERE OBJECT_DEFINITION(object_id) LIKE '%bs_route%' AND type IN ('V','P','FN','TF','IF');
