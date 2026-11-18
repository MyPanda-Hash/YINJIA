SET NOCOUNT ON;
SELECT 'P|bl|' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_ret');
SELECT 'P|bd|' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_material_ret');
SELECT 'P|bo|' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_out');