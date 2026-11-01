SET NOCOUNT ON;
SELECT '=== form_flow_link columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('form_flow_link') ORDER BY c.column_id;
GO
SELECT '=== qc_insp columns again ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('qc_insp') ORDER BY c.column_id;
GO
SELECT '=== qc_insp_detail columns again ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('qc_insp_detail') ORDER BY c.column_id;
GO
