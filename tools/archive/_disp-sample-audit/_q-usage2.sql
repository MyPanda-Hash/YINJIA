SET NOCOUNT ON;
-- _q-usage2.sql — 补充取证:发号台账 / 代码-数据交叉引用 / 其它表里的派工·外协痕迹
PRINT N'=== 7 单号台账 s_allno 按类别 ===';
SELECT lb, COUNT(*) AS n, MIN(asp_time1) AS tmin, MAX(asp_time1) AS tmax
FROM s_allno WHERE lb IN (N'SP', N'DP', N'WO', N'WW', N'PG')
GROUP BY lb;
GO
SELECT N's_allno_total' AS k, COUNT(*) AS n FROM s_allno;
GO

PRINT N'=== 7b 样品申请单实测那张单 ===';
SELECT * FROM dbo.sample_req;
GO

PRINT N'=== 9 生产/排产相关表里是否有派工单号/委外单号列 ===';
SELECT t.name AS tbl, c.name AS col
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE c.name LIKE N'%派工%' OR c.name LIKE N'%委外%' OR c.name LIKE N'%外协%'
ORDER BY t.name, c.name;
GO

PRINT N'=== 10 全库哪个表有数据提到 DP-/WW-/SP- 前缀单号(抽样头表主键区) ===';
SELECT N'bd_dispatch' AS t, COUNT(*) AS n FROM bd_dispatch
UNION ALL SELECT N'bl_dispatch', COUNT(*) FROM bl_dispatch
UNION ALL SELECT N'bd_outsource_order', COUNT(*) FROM bd_outsource_order
UNION ALL SELECT N'bl_outsource_order', COUNT(*) FROM bl_outsource_order;
GO

PRINT N'=== 11 yj_panel 里 module_group=生产制造 的现存面板(看这两组之外是否还有入口) ===';
SELECT panel_code, panel_name, category, mode, module_group
FROM yj_panel WHERE module_group = N'生产制造' ORDER BY panel_code;
GO

PRINT N'=== 12 yj_panel 全表 group 分布 ===';
SELECT ISNULL(module_group, N'(null)') AS module_group, COUNT(*) AS n FROM yj_panel GROUP BY module_group ORDER BY n DESC;
GO
