/* q-02-shape.sql — 库存三视图的取数对象规模/索引/统计信息新鲜度(只读) */
SET NOCOUNT ON;
GO
SELECT t.name AS table_name, SUM(p.rows) AS rows_n,
       (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = t.object_id AND i.type > 0) AS idx_n,
       (SELECT MAX(sp.last_updated) FROM sys.stats st
          CROSS APPLY sys.dm_db_stats_properties(st.object_id, st.stats_id) sp
        WHERE st.object_id = t.object_id) AS stats_last_updated,
       (SELECT MAX(sp.rows_sampled) FROM sys.stats st
          CROSS APPLY sys.dm_db_stats_properties(st.object_id, st.stats_id) sp
        WHERE st.object_id = t.object_id) AS max_rows_sampled
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE t.name IN ('bl_purchase_in','bl_finish_in','bl_other_in','bl_other_out','bl_sale_out','bl_material_out',
                 'bl_outsource_in','bl_outsource_issue','bl_dispatch','inh','outh','kucun','bs_inv','bs_wh',
                 'bl_purchase_in_detail','bl_finish_in_detail')
GROUP BY t.name, t.object_id
ORDER BY rows_n DESC;
GO
SELECT name AS stat_name, OBJECT_NAME(object_id) AS on_table, stats_date(object_id, stats_id) AS updated
FROM sys.stats WHERE OBJECT_NAME(object_id) IN ('v_stock_balance','v_stock_ledger','v_stock_summary')
ORDER BY on_table;
GO
SELECT name, type_desc, is_unique FROM sys.indexes
WHERE object_id = OBJECT_ID('kucun') ORDER BY index_id;
GO
