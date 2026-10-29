/* 还原 fixture 为"带 id 的表"，并把测试用的包装视图收掉 */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST' THROW 51000, N'只允许在 HSDZ_MES_TEST 执行。', 1;
IF OBJECT_ID(N'dbo.wo_mixing_list', N'V') IS NOT NULL DROP VIEW dbo.wo_mixing_list;
GO
IF OBJECT_ID(N'dbo.wo_mixing_list_src', N'U') IS NOT NULL
    EXEC sp_rename N'dbo.wo_mixing_list_src', N'wo_mixing_list';
GO
IF OBJECT_ID(N'dbo.v_wo_mixing_list', N'V') IS NOT NULL DROP VIEW dbo.v_wo_mixing_list;
GO
SELECT name, type_desc FROM sys.objects WHERE name LIKE N'%wo_mixing_list%' ORDER BY name;
PRINT N'RESULT: RESTORED-TABLE';
