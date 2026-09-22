SET NOCOUNT ON;
-- 源表规模与索引
SELECT 'T' AS k, t.name AS tbl, SUM(p.rows) AS rows_n
  FROM sys.tables t
  JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
 WHERE t.name IN ('bl_purchase_in','bd_purchase_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out',
                  'bl_other_in','bd_other_in','bl_other_out','bd_other_out','bl_finish_in','bd_finish_in',
                  'bl_outsource_in','bd_outsource_in','bl_outsource_issue','bd_outsource_issue',
                  'bs_wh','inv_cost_ledger','kucun')
 GROUP BY t.name ORDER BY SUM(p.rows) DESC;
SELECT 'I' AS k, t.name AS tbl, i.name AS idx, i.type_desc,
       STUFF((SELECT ',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id
               WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id AND ic2.is_included_column=0
               ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,'') AS keycols
  FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id
  JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=1
  JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
 WHERE t.name IN ('bs_wh','inv_cost_ledger','kucun','bl_purchase_in','bd_purchase_in','bl_sale_out','bd_sale_out',
                  'bl_material_out','bd_material_out','bl_other_in','bd_other_in','bl_other_out','bd_other_out',
                  'bl_finish_in','bd_finish_in','bl_outsource_in','bd_outsource_in','bl_outsource_issue','bd_outsource_issue')
 ORDER BY t.name, i.index_id;
GO
