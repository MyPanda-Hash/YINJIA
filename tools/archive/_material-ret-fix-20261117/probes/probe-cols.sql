SET NOCOUNT ON;
SELECT DB_NAME() AS db,
  (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_material_ret')) AS bl_cols,
  (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_ret')) AS bd_cols,
  COL_LENGTH('dbo.bl_material_ret', N'加工单号') AS bl_加工单号,
  COL_LENGTH('dbo.bl_material_ret', N'工单行号') AS bl_工单行号,
  COL_LENGTH('dbo.bd_material_ret', N'加工单号') AS bd_加工单号,
  COL_LENGTH('dbo.bd_material_ret', N'工单行号') AS bd_工单行号,
  COL_LENGTH('dbo.bl_material_out', N'工单行号') AS bo_工单行号;