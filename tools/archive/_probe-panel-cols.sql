USE HSDZ_MES; SET NOCOUNT ON;
SELECT c.name AS 列名, t.name AS 类型, c.is_nullable, CASE WHEN c.is_nullable=0 AND c.is_identity=0 AND c.default_object_id=0 THEN N'必填' ELSE N'' END AS 提示
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id;
GO
SELECT * FROM yj_panel WHERE panel_code = N'RD_APPROVAL';
GO