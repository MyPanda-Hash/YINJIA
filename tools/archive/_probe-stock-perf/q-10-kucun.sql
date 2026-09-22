SET NOCOUNT ON;
SELECT 'kucun' AS k, c.name, t.name AS ty FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('kucun') ORDER BY c.column_id;
GO
SELECT '存在性' AS k, t.name FROM sys.tables t WHERE t.name IN ('bl_purchase_in','bd_purchase_in','bl_finish_in','bd_finish_in','bl_other_in','bd_other_in','bl_outsource_in','bd_outsource_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out','bl_other_out','bd_other_out','bl_outsource_issue','bd_outsource_issue','bs_wh','kucun') ORDER BY 2;
GO
SELECT '单据编号列' AS k, OBJECT_NAME(c.object_id) AS tbl FROM sys.columns c WHERE c.name=N'单据编号' AND OBJECT_NAME(c.object_id) IN ('bl_purchase_in','bd_purchase_in','bl_finish_in','bd_finish_in','bl_other_in','bd_other_in','bl_outsource_in','bd_outsource_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out','bl_other_out','bd_other_out','bl_outsource_issue','bd_outsource_issue') ORDER BY 2;
GO
