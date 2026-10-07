-- 探针:MES 里是否已有「物料清单/BOM」面板与表;以及生产基础资料面板现状
SELECT '=== 1. 面板清单(物料清单/BOM 相关) ===' AS x;
SELECT panel_code, panel_name, mode, head_table, line_table, code_col FROM yj_panel
WHERE panel_name LIKE N'%物料清单%' OR panel_name LIKE N'%BOM%' OR panel_code LIKE '%BOM%' OR line_table LIKE '%bom%';
GO
SELECT '=== 2. 库表(bom 相关) ===' AS x;
SELECT name, type_desc FROM sys.objects WHERE name LIKE '%bom%' AND type IN ('U','V');
GO
SELECT '=== 3. 生产基础资料面板:表 + 字段数 ===' AS x;
SELECT p.panel_code, p.panel_name, p.head_table, p.line_table,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS fields
FROM yj_panel p WHERE p.panel_code IN ('OP','TEAM','EQUIP','ROUTE','WORK_CENTER','PROCESS') ORDER BY p.panel_code;
GO
SELECT '=== 4. 行数 ===' AS x;
SELECT 'bs_op' AS tbl, COUNT(*) AS rows_total FROM bs_op
UNION ALL SELECT 'bs_team', COUNT(*) FROM bs_team
UNION ALL SELECT 'bs_equip', COUNT(*) FROM bs_equip
UNION ALL SELECT 'bs_route', COUNT(*) FROM bs_route;
