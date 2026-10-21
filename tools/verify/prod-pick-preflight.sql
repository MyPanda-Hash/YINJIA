/* ============================================================================
   prod-pick-preflight.sql —— 生产领料(PROD_PICK_LIST)装之前的**只读**前置检查
   不改任何数据；只回答两件事：源表 outh 在不在、材料出库段有没有数据。
   末行 RESULT: OUTH-OK / OUTH-MISSING —— 增量包 apply.ps1 按它决定是否继续。
   用法：java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbc:...> yinjia <密码> prod-pick-preflight.sql
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @has bit = CASE WHEN OBJECT_ID(N'dbo.outh', N'U') IS NOT NULL THEN 1 ELSE 0 END;

SELECT N'源表 dbo.outh 是否存在' AS 检查项,
       CASE WHEN @has = 1 THEN N'PASS' ELSE N'FAIL' END AS 结果,
       CASE WHEN @has = 1 THEN OBJECT_NAME(OBJECT_ID(N'dbo.outh')) ELSE N'未找到（见 README 4A）' END AS 说明;

IF @has = 1
BEGIN
    DECLARE @rows int, @docs int;
    EXEC sp_executesql N'SELECT @n = COUNT(*), @d = COUNT(DISTINCT 单据编号)
                           FROM dbo.outh WHERE src = 6 AND ISNULL(asp_cancel, N''N'') <> N''Y'';',
         N'@n int OUTPUT, @d int OUTPUT', @n = @rows OUTPUT, @d = @docs OUTPUT;
    SELECT N'材料出库段(src=6)行数 / 单据数' AS 检查项, N'INFO' AS 结果,
           CAST(@rows AS nvarchar(20)) + N' 行 / ' + CAST(@docs AS nvarchar(20)) + N' 张（0 行也算通：面板先装上，以后有数据自然显示）' AS 说明;
END

SELECT CASE WHEN @has = 1 THEN N'RESULT: OUTH-OK' ELSE N'RESULT: OUTH-MISSING' END AS 结果;
