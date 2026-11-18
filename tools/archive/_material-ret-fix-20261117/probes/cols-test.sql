SET NOCOUNT ON;
SELECT 'T|bl|' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_ret');
SELECT 'T|bd|' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_material_ret');
SELECT 'T|bo|' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_out');