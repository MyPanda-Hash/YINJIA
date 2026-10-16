SET NOCOUNT ON;
/* 直插取证:绕过应用层,验证数据库过滤唯一索引真的拦得住同码(2026-10-16)。
   全程在事务里做并回滚,不留痕迹;结果用 SELECT 输出(SqlRunner 不显示 PRINT)。 */
DECLARE @log TABLE (seq int identity, 步骤 nvarchar(60), 结果 nvarchar(400));
DECLARE @code nvarchar(200) = (SELECT TOP 1 工序编码 FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id);
DECLARE @before int = (SELECT COUNT(*) FROM dbo.bs_op WHERE 工序编码 = @code);
INSERT INTO @log (步骤, 结果) VALUES (N'取样编码', @code + N'(当前 ' + CAST(@before AS nvarchar(10)) + N' 行,含作废)');

BEGIN TRAN;
BEGIN TRY
    INSERT INTO dbo.bs_op (工序编码, 工序名称, 状态, asp_cancel) VALUES (@code, N'直插取证-不应落库', N'启用', 'N');
    INSERT INTO @log (步骤, 结果) VALUES (N'① 直插同码存活行', N'FAIL:竟然插进去了(唯一索引没生效)');
END TRY
BEGIN CATCH
    INSERT INTO @log (步骤, 结果) VALUES (N'① 直插同码存活行', N'OK:被数据库拦下 -> ' + ERROR_MESSAGE());
END CATCH
ROLLBACK;

BEGIN TRAN;
BEGIN TRY
    INSERT INTO dbo.bs_op (工序编码, 工序名称, 状态, asp_cancel) VALUES (@code, N'直插取证-作废行', N'启用', 'Y');
    INSERT INTO @log (步骤, 结果) VALUES (N'② 同码的已作废行', N'OK:可插入(作废行不占码,作废后可重建同码)');
END TRY
BEGIN CATCH
    INSERT INTO @log (步骤, 结果) VALUES (N'② 同码的已作废行', N'FAIL:被误拦 -> ' + ERROR_MESSAGE());
END CATCH
ROLLBACK;

DECLARE @after int = (SELECT COUNT(*) FROM dbo.bs_op WHERE 工序编码 = @code);
INSERT INTO @log (步骤, 结果) VALUES (N'③ 回滚后该编码行数', CAST(@after AS nvarchar(10)) + N'(取样时 = ' + CAST(@before AS nvarchar(10)) + N',应一致 = 未留痕迹)');
INSERT INTO @log (步骤, 结果)
SELECT N'④ 存活重复编码数', CAST(COUNT(*) AS nvarchar(10)) + N'(必须为 0)'
FROM (SELECT 工序编码 FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 工序编码 HAVING COUNT(*)>1) d;
INSERT INTO @log (步骤, 结果)
SELECT N'⑤ 唯一索引', i.name + N' unique=' + CAST(i.is_unique AS nvarchar(2)) + N' filter=' + CAST(i.has_filter AS nvarchar(2))
       + N' ' + ISNULL(i.filter_definition, N'')
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.bs_op') AND i.name = 'ux_bs_op_code';

SELECT 步骤, 结果 FROM @log ORDER BY seq;
SELECT 库名 = DB_NAME();
