SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('bl_purchase_in','bl_finish_in','bl_other_in','bl_material_out','bl_sale_out','bl_other_out')
  AND (COLUMN_NAME IN ('id','单据编号','存货编码','产品编码','数量','实收数量','仓库','仓库编码','批号','批次号','asp_cancel'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
