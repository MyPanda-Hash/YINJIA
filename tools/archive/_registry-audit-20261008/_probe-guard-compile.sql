-- 探针:IF 守卫能否挡住「引用不存在列」的语句(决定血统二择一写法是否可行)
SET NOCOUNT ON;
GO
PRINT N'-- A: IF 守卫包住引用不存在列的 SELECT --';
IF COL_LENGTH('dbo.bs_wh_loc', N'不存在的列X') IS NOT NULL
  SELECT 不存在的列X FROM dbo.bs_wh_loc;
ELSE
  PRINT N'  A 的 ELSE 分支执行了(说明 IF 分支里那句没被编译)';
GO
PRINT N'-- B: IF 守卫包住引用不存在列的 UPDATE --';
IF COL_LENGTH('dbo.bs_wh_loc', N'不存在的列X') IS NOT NULL
  UPDATE dbo.bs_wh_loc SET 不存在的列X = N'1';
ELSE
  PRINT N'  B 的 ELSE 分支执行了';
GO
