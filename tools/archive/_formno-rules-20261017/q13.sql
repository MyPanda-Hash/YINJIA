SET NOCOUNT ON;
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name AS col, TYPE_NAME(c.user_type_id) AS t, c.max_length, c.is_nullable
FROM sys.columns c
WHERE c.name IN (N'单据编号',N'单号',N'合同号') AND OBJECT_NAME(c.object_id) IN
 (N'bd_purchase_in',N'bd_sale_out',N'bd_material_out',N'bd_finish_in',N'bd_other_in',N'bd_other_out',
  N'bd_pu_order',N'bd_so_order',N'sl_recv',N'qc_insp',N'qc_return',N'bd_manu_order',N'wo_order',
  N'bd_dispatch',N'sample_req',N'qc_proc_insp_head',N'qc_first_insp_head',N'maint_plan',N'day_report',N'bd_outsource_order')
ORDER BY tbl;
PRINT '== 单据编号 上是否有唯一索引/主键 ==';
SELECT OBJECT_NAME(i.object_id) AS tbl, i.name AS idx, i.type_desc, i.is_unique, c.name AS col
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
JOIN sys.columns c ON c.object_id=i.object_id AND c.column_id=ic.column_id
WHERE c.name = N'单据编号' AND i.is_unique = 1
ORDER BY tbl;
PRINT '== s_allno 索引/约束 ==';
SELECT i.name, i.type_desc, i.is_unique, i.is_primary_key FROM sys.indexes i WHERE i.object_id = OBJECT_ID('s_allno');
