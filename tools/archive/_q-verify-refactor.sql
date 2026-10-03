SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM sys.tables) AS 表数,
       (SELECT COUNT(*) FROM sys.views)  AS 视图数,
       (SELECT COUNT(*) FROM yj_schema_log) AS 已登记迁移;
GO
SELECT '--- inh 列(应已是流水表:src/rid/单据日期/仓库编码/存货编码/收入数量/含税金额…) ---' AS x;
SELECT c.name AS inh列, ty.name AS 类型 FROM sys.columns c
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('inh') ORDER BY c.column_id;
GO
SELECT '--- 勾稽:结存 == Σ流水 ---' AS x;
SELECT (SELECT COUNT(*) FROM inh) AS inh行,
       (SELECT COUNT(*) FROM outh) AS outh行,
       (SELECT ISNULL(SUM(收入数量),0) FROM inh) AS 入库合计,
       (SELECT ISNULL(SUM(发出数量),0) FROM outh) AS 出库合计,
       (SELECT ISNULL(SUM(yl),0) FROM kucun) AS kucun余量;
GO
SELECT '--- v_stock_movement 口径 ---' AS x;
SELECT CASE WHEN OBJECT_DEFINITION(OBJECT_ID('v_stock_movement')) LIKE '%inh%'
            THEN N'已改读 inh/outh 流水表' ELSE N'仍是 8 路 UNION(未重构)' END AS 视图口径;
GO
SELECT '--- 视图列数(列契约应=23) ---' AS x;
SELECT COUNT(*) AS 列数 FROM sys.columns WHERE object_id = OBJECT_ID('v_stock_movement');
GO
SELECT '--- 在册表缺口(补建遗留表后应只剩 dm_key) ---' AS x;
SELECT name FROM sys.tables WHERE name IN ('plang','plang_pc','scjl','yj_ext_bind_log','bs_wh_loc','dm_key');
GO
