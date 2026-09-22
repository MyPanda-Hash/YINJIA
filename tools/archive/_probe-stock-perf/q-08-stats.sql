SET NOCOUNT ON;
SELECT OBJECT_NAME(t.object_id) AS tbl,
       (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id=t.object_id AND i.type>0) AS idx_n,
       (SELECT COUNT(*) FROM sys.stats s WHERE s.object_id=t.object_id) AS stat_n,
       SUM(p.rows) AS rows_n
  FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
 WHERE t.name IN ('bl_purchase_in','bd_purchase_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out',
                  'bl_other_in','bd_other_in','bl_other_out','bd_other_out','bl_finish_in','bd_finish_in',
                  'bl_outsource_in','bd_outsource_in','bl_outsource_issue','bd_outsource_issue',
                  'bs_wh','inv_cost_ledger','kucun')
 GROUP BY t.object_id ORDER BY rows_n DESC;
GO
SELECT OBJECT_NAME(s.object_id) AS tbl, s.name AS stat, s.auto_created, s.user_created,
       CONVERT(nvarchar(19), sp.last_updated, 120) AS last_upd, sp.rows
  FROM sys.stats s JOIN sys.dm_db_stats_properties(s.object_id, s.stats_id) sp ON 1=1
 WHERE OBJECT_NAME(s.object_id) LIKE 'bl[_]%' OR OBJECT_NAME(s.object_id) LIKE 'bd[_]%'
 ORDER BY 1,2;
GO
