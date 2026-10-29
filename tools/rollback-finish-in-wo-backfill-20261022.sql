/* ============================================================================
   rollback-finish-in-wo-backfill-20261022.sql
   回滚「产成品入库单 · 加工单号补齐」——只撤掉本脚本写进去的值，别的一行不碰。

   判定依据 = 留痕：yj_usage_log 里
       panel_name = N'产成品入库单'
       AND action_name LIKE N'数据修复·补齐加工单号(%'      -- （形如 数据修复·补齐加工单号(覆盖1/1/strict)→GD-2026-10-0090）
   还原规则：
       ① 从留痕里解出「当时写入的工单号」（`→` 之后那段）；
       ② 只还原**当前值仍等于该工单号**的单据（有人后来手工改成别的号，就不动 —— 那是新事实）；
       ③ 加工单号置 NULL，工单行号置 NULL（本脚本只填了这两个字段）；
       ④ 给留痕行打上 N'（已回滚）' 标记 —— 重复执行不会再撤第二次，也不会撤别人的补齐。

   执行（tools 目录）：两个账套都要跑
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run rollback-finish-in-wo-backfill-20261022.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @PanelName nvarchar(200) = N'产成品入库单';
DECLARE @Marker    nvarchar(20)  = N'（已回滚）';
DECLARE @Reverted  int = 0;

IF OBJECT_ID('tempdb..#rb') IS NOT NULL DROP TABLE #rb;
CREATE TABLE #rb (单据编号 nvarchar(400) NOT NULL PRIMARY KEY,
                  工单号 nvarchar(56), 留痕id bigint);

BEGIN TRY
    BEGIN TRANSACTION;

    -- ① 取留痕（未标记回滚的），解出工单号
    INSERT INTO #rb (单据编号, 工单号, 留痕id)
    SELECT l.doc_no,
           LTRIM(RTRIM(SUBSTRING(l.action_name, CHARINDEX(N'→', l.action_name) + 1, 200))),
           l.id
      FROM dbo.yj_usage_log l
     WHERE l.panel_name = @PanelName
       AND l.action_name LIKE N'数据修复·补齐加工单号(%'
       AND l.action_name NOT LIKE N'%' + @Marker + N'%'
       AND l.doc_no IS NOT NULL
       AND CHARINDEX(N'→', l.action_name) > 0;

    -- ①b 只保留「当前值仍等于留痕值」的单据
    DELETE rb
      FROM #rb rb
     WHERE NOT EXISTS (SELECT 1 FROM dbo.bd_finish_in h
                        WHERE h.单据编号 = rb.单据编号 AND h.加工单号 = rb.工单号);

    -- ② 还原
    UPDATE h
       SET h.加工单号 = NULL, h.工单行号 = NULL
      FROM dbo.bd_finish_in h
      JOIN #rb rb ON rb.单据编号 = h.单据编号
     WHERE h.加工单号 = rb.工单号;

    SET @Reverted = @@ROWCOUNT;

    -- ③ 留痕打标记（改成"已回滚"后缀，避免二次回滚）
    UPDATE l
       SET l.action_name = LEFT(l.action_name, 80) + @Marker
      FROM dbo.yj_usage_log l
      JOIN #rb rb ON rb.留痕id = l.id;

    IF @Reverted <> (SELECT COUNT(*) FROM #rb)
        THROW 51000, N'回滚行数与留痕不一致（可能有并发修改）。', 1;

    SELECT rb.单据编号, rb.工单号 AS 已撤掉的加工单号 INTO #out FROM #rb rb;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ⚠ 结果集单独成批：SQL Server JDBC 对一个批次里的多条语句只回第一个结果集；
      变量是批次作用域的 ⇒ 汇总走 #out / #rb 临时表。 */
GO
IF OBJECT_ID('tempdb..#out') IS NULL
    SELECT CAST(NULL AS nvarchar(400)) AS 单据编号, CAST(NULL AS nvarchar(56)) AS 已撤掉的加工单号
      INTO #out WHERE 1 = 0;
GO
SELECT 单据编号, 已撤掉的加工单号 FROM #out ORDER BY 单据编号;
GO
SELECT N'RESULT: FINISH-IN-WO-ROLLED-BACK-' + CONVERT(nvarchar(10), (SELECT COUNT(*) FROM #out)) AS 结果,
       (SELECT COUNT(*) FROM #out) AS 本次回滚单数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'') AS 空加工单号单数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'') AS 加工单号非空单数;
