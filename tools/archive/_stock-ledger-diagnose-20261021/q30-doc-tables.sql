SET NOCOUNT ON;
SELECT 表名 = name, 行数 = (SELECT SUM(row_count) FROM sys.dm_db_partition_stats ps WHERE ps.object_id = t.object_id AND ps.index_id IN (0,1))
FROM sys.tables t
WHERE name IN ('bd_purchase_in','bl_purchase_in','bd_finish_in','bl_finish_in','bd_other_in','bl_other_in',
               'bd_sale_out','bl_sale_out','bd_material_out','bl_material_out','bd_other_out','bl_other_out',
               'bd_transfer','bl_transfer','bd_stocktake','bl_stocktake','bd_outsource_in','bl_outsource_in')
ORDER BY name;
