SET NOCOUNT ON;
PRINT N'== 入库/出库/调拨/盘点 单据行表的数量类列 ==';
SELECT o.name AS 表, c.name AS 列, t.name AS 类型, c.precision, c.scale
FROM sys.columns c
JOIN sys.objects o ON c.object_id=o.object_id
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE o.type='U' AND o.name IN ('bl_purchase_in','bl_sale_out','bl_material_out','bl_other_in','bl_other_out',
      'bl_finish_in','bl_outsource_in','bl_transfer','bl_stocktake','bl_so_order','bl_pu_order',
      'bl_manu_order','bl_outsource_order','bl_qc_recv','bl_qc_return','sl_recv_detail')
  AND (c.name LIKE N'%数量%' OR c.name LIKE N'%量%' OR c.name LIKE N'%存量%' OR c.name IN (N'数量',N'批号',N'仓库'))
ORDER BY o.name, c.column_id;
