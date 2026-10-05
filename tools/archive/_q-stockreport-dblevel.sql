-- 库存报表三张表:数据库层面的客观事实(只读)
SET NOCOUNT ON;
-- ══ 1. 库级环境(优化器行为的前提)══
SELECT DB_NAME() AS 库, d.compatibility_level AS 兼容级别,
       d.is_read_committed_snapshot_on AS RCSI, d.snapshot_isolation_state_desc AS 快照隔离,
       d.is_auto_create_stats_on AS 自动建统计, d.is_auto_update_stats_on AS 自动更统计,
       d.recovery_model_desc AS 恢复模式, d.collation_name AS 排序规则
FROM sys.databases d WHERE d.name = DB_NAME();
GO
-- ══ 2. 视图属性:是否 SCHEMABINDING(能不能带 hint / 能不能建索引视图)══
SELECT v.name AS 视图,
       OBJECTPROPERTY(v.object_id,'IsSchemaBound') AS 绑定架构,
       OBJECTPROPERTY(v.object_id,'IsIndexed') AS 已建索引视图,
       OBJECTPROPERTY(v.object_id,'IsDeterministic') AS 确定性,
       LEN(m.definition) AS 定义长度
FROM sys.views v JOIN sys.sql_modules m ON m.object_id=v.object_id
WHERE v.name IN ('v_stock_movement','v_stock_ledger','v_stock_summary','v_stock_balance')
ORDER BY v.name;
GO
-- ══ 3. 视图依赖链(谁读谁)══
SELECT OBJECT_NAME(d.referencing_id) AS 引用方, d.referenced_entity_name AS 被引用, d.referenced_class_desc AS 类别
FROM sys.sql_expression_dependencies d
WHERE OBJECT_NAME(d.referencing_id) IN ('v_stock_movement','v_stock_ledger','v_stock_summary','v_stock_balance')
ORDER BY 引用方, 被引用;
GO
-- ══ 4. 参与表/视图的存储形态:堆表还是索引表、行数 ══
SELECT t.name AS 对象, t.type_desc AS 类型,
       CASE WHEN EXISTS (SELECT 1 FROM sys.indexes i WHERE i.object_id=t.object_id AND i.index_id > 0) THEN N'有索引' ELSE N'堆表(HEAP)' END AS 形态,
       (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id=t.object_id AND i.index_id > 0) AS 索引数,
       SUM(p.rows) AS 行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name IN ('bl_purchase_in','bd_purchase_in','bl_finish_in','bd_finish_in','bl_other_in','bd_other_in',
                 'bl_outsource_in','bd_outsource_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out',
                 'bl_other_out','bd_other_out','bl_outsource_issue','bd_outsource_issue','inv_cost_ledger','kucun','bs_wh')
GROUP BY t.name, t.type_desc, t.object_id
ORDER BY 形态 DESC, 对象;
GO
-- ══ 5. 物化成本表与库存表的索引清单 ══
SELECT OBJECT_NAME(i.object_id) AS 表, i.name AS 索引, i.type_desc AS 类型, i.is_unique AS 唯一,
       i.is_primary_key AS 主键, ISNULL(i.filter_definition,N'') AS 筛选, i.fill_factor AS 填充因子
FROM sys.indexes i WHERE i.object_id IN (OBJECT_ID('dbo.inv_cost_ledger'), OBJECT_ID('dbo.kucun'), OBJECT_ID('dbo.bs_wh'))
ORDER BY 表, i.index_id;
GO
-- ══ 6. 统计信息:哪些是显式 FULLSCAN 建的(坏计划的解药)══
SELECT OBJECT_NAME(s.object_id) AS 表, s.name AS 统计, s.auto_created AS 自动建, s.user_created AS 手工建,
       sp.rows AS 行数, sp.rows_sampled AS 采样行数,
       CASE WHEN sp.rows > 0 AND sp.rows_sampled >= sp.rows THEN N'FULLSCAN' ELSE N'抽样' END AS 采样方式,
       sp.last_updated AS 更新时间, sp.persisted_sample_percent AS 持久采样率
FROM sys.stats s CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE s.object_id IN (SELECT object_id FROM sys.tables WHERE name IN
      ('bl_purchase_in','bd_purchase_in','bl_finish_in','bd_finish_in','bl_other_in','bd_other_in',
       'bl_outsource_in','bd_outsource_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out',
       'bl_other_out','bd_other_out','bl_outsource_issue','bd_outsource_issue','bs_wh','kucun'))
ORDER BY 表, 统计;
GO
-- ══ 7. 成本分区大小(=递归深度):决定默认 MAXRECURSION 100 会不会炸 ══
SELECT COUNT(*) AS 分区数, MAX(c) AS 最大分区行数, AVG(c) AS 平均分区行数
FROM (SELECT COUNT(*) AS c FROM v_stock_movement GROUP BY 仓库键, 存货编码) x;
GO
SELECT TOP 5 仓库键, 存货编码, COUNT(*) AS 分区行数
FROM v_stock_movement GROUP BY 仓库键, 存货编码 ORDER BY COUNT(*) DESC;
GO
-- ══ 8. 物化表与流水的勾稽(DB 层面的一致性凭据)══
SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水行, (SELECT COUNT(*) FROM inv_cost_ledger) AS 成本行,
       (SELECT COUNT(*) FROM v_stock_movement m WHERE NOT EXISTS (SELECT 1 FROM inv_cost_ledger c WHERE c.src=m.src AND c.rid=m.rid)) AS 无成本行,
       (SELECT COUNT(*) FROM inv_cost_ledger c WHERE NOT EXISTS (SELECT 1 FROM v_stock_movement m WHERE m.src=c.src AND m.rid=c.rid)) AS 无流水行;
GO
