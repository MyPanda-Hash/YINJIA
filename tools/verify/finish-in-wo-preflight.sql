/* ============================================================================
   finish-in-wo-preflight.sql —— 产成品入库单「加工单号」补齐前的**只读**前置检查
   不改任何数据；只回答：库里有没有这两张表、有多少待补单、工单够不够用。
   末行 RESULT: PREFLIGHT-OK / PREFLIGHT-NO-PLANG / PREFLIGHT-NO-TABLE
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @hasH bit = CASE WHEN OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasL bit = CASE WHEN OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasP bit = CASE WHEN OBJECT_ID(N'dbo.plang', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @pending int = 0, @wo int = 0, @filled int = 0;

IF @hasH = 1 AND @hasL = 1
BEGIN
    EXEC sp_executesql N'SELECT @a = COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'''') = N'''';
                      SELECT @b = COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'''') <> N'''';',
         N'@a int OUTPUT, @b int OUTPUT', @a = @pending OUTPUT, @b = @filled OUTPUT;
END
IF @hasP = 1
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM dbo.plang;', N'@n int OUTPUT', @n = @wo OUTPUT;

SELECT N'01 产成品入库单头表 bd_finish_in' AS 检查项,
       CASE WHEN @hasH = 1 THEN N'PASS' ELSE N'FAIL' END AS 结果, N'' AS 说明
UNION ALL
SELECT N'02 产成品入库单行表 bl_finish_in',
       CASE WHEN @hasL = 1 THEN N'PASS' ELSE N'FAIL' END, N''
UNION ALL
SELECT N'03 生产工单表 plang',
       CASE WHEN @hasP = 1 THEN N'PASS' ELSE N'FAIL' END, N''
UNION ALL
SELECT N'04 待补（加工单号为空）单数', N'INFO', CAST(@pending AS nvarchar(10)) + N' 张'
UNION ALL
SELECT N'05 已有加工单号单数', N'INFO', CAST(@filled AS nvarchar(10)) + N' 张'
UNION ALL
SELECT N'06 生产工单行数', N'INFO',
       CAST(@wo AS nvarchar(10)) + N' 行' + CASE WHEN @wo = 0 THEN N'（⚠ 工单表为空 ⇒ 什么都补不出来，脚本会 NOOP）' ELSE N'' END;

SELECT CASE WHEN @hasH = 0 OR @hasL = 0 OR @hasP = 0 THEN N'RESULT: PREFLIGHT-NO-TABLE'
            WHEN @wo = 0 THEN N'RESULT: PREFLIGHT-NO-PLANG'
            ELSE N'RESULT: PREFLIGHT-OK' END AS 结果;
