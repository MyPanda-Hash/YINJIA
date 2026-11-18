/* ============================================================================
 * migrate-qc-insp-rec-resultcols-default1-20261119.sql —— 「检测结果」列数默认改为 **1 格**
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-19 第二版):「默认是1格。后面再自主增加。」
 *   上一版(同日 migrte-qc-insp-rec-resultcols-20261119.sql)把默认做成 5 格、存量单据一律回填 5;
 *   用户要的是**新单一格起**(要几格自己按「＋ 新增列」加)。
 *
 * 本脚本(幂等;两账套均执行):
 *   ① 存量每张单的 `qc_insp_rec.结果列数` **按"实际用到的格数"重算**(最少 1)——
 *      · 取该单所有明细行里 结果1..结果20 中**非空的最大序号**,整单取 MAX;
 *      · 一行都没有 / 结果1 也空 ⇒ 1;
 *      ⇒ 有数据的格子一列都不会被藏起来,没数据的空列则不显示(正式库实测:69 张单全部只用到 结果1)。
 *   ② `qc_insp_rec.结果列数` 的列说明改成「默认 1」口径(sp_updateextendedproperty,幂等)。
 *   ③ 自检:没有 NULL;没有任何单据的 结果列数 < 它实际用到的格数(否则会"藏掉已填的值")。
 *
 * 注意:
 *   · **不动任何业务数据**(结果1..结果20 一个字节不改,只是"显示几列"变了);
 *   · 不动 yj_field / 前端常量 —— 前端默认 1 格由 `QC_INSP_REC_DEFAULT_RESULT_COLS = 1` 决定,
 *     新单 `结果列数` 为空就按 1 渲染;用户加列后保存才写这个头字段。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 按实际用到的格数重算每张单的列数(最少 1) ---------- */
;WITH rowmax AS (
    SELECT d.单据编号,
           CASE
             WHEN ISNULL(d.[结果20],N'') <> N'' THEN 20 WHEN ISNULL(d.[结果19],N'') <> N'' THEN 19
             WHEN ISNULL(d.[结果18],N'') <> N'' THEN 18 WHEN ISNULL(d.[结果17],N'') <> N'' THEN 17
             WHEN ISNULL(d.[结果16],N'') <> N'' THEN 16 WHEN ISNULL(d.[结果15],N'') <> N'' THEN 15
             WHEN ISNULL(d.[结果14],N'') <> N'' THEN 14 WHEN ISNULL(d.[结果13],N'') <> N'' THEN 13
             WHEN ISNULL(d.[结果12],N'') <> N'' THEN 12 WHEN ISNULL(d.[结果11],N'') <> N'' THEN 11
             WHEN ISNULL(d.[结果10],N'') <> N'' THEN 10 WHEN ISNULL(d.[结果9],N'')  <> N'' THEN 9
             WHEN ISNULL(d.[结果8],N'')  <> N'' THEN 8  WHEN ISNULL(d.[结果7],N'')  <> N'' THEN 7
             WHEN ISNULL(d.[结果6],N'')  <> N'' THEN 6  WHEN ISNULL(d.[结果5],N'')  <> N'' THEN 5
             WHEN ISNULL(d.[结果4],N'')  <> N'' THEN 4  WHEN ISNULL(d.[结果3],N'')  <> N'' THEN 3
             WHEN ISNULL(d.[结果2],N'')  <> N'' THEN 2  WHEN ISNULL(d.[结果1],N'')  <> N'' THEN 1
             ELSE 1
           END AS n
      FROM dbo.qc_insp_rec_detail d
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
), docmax AS (
    SELECT 单据编号, MAX(n) AS n FROM rowmax GROUP BY 单据编号
)
UPDATE h
   SET h.[结果列数] = ISNULL(m.n, 1)
  FROM dbo.qc_insp_rec h
  LEFT JOIN docmax m ON m.单据编号 = h.单据编号
 WHERE ISNULL(h.[结果列数], 0) <> ISNULL(m.n, 1);

PRINT N'[重算] 结果列数 ← 实际用到的格数(最少 1): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张单';
GO

/* ---------- ② 列说明改成「默认 1」口径 ---------- */
DECLARE @desc nvarchar(600) =
    N'检验报告「检测结果」的列数(**默认 1 格**,上限 20;用户口径「默认是1格。后面再自主增加。」)。'
  + N'一张纸抽几件就填几列,纸面用「检测结果列 － n ＋」/ 表头「＋ 新增列」维护;'
  + N'减列/删列会清空被删列已填的值。界面上不显示(visible=0/hidden=1),只做计数载体。';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.qc_insp_rec')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_rec'), N'结果列数', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @desc,
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec', N'COLUMN', N'结果列数';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @desc,
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec', N'COLUMN', N'结果列数';
PRINT N'[注明] qc_insp_rec.结果列数 已改为「默认 1 格」口径';
GO

/* ---------- ③ 自检 ---------- */
IF EXISTS (SELECT 1 FROM dbo.qc_insp_rec WHERE [结果列数] IS NULL)
    RAISERROR(N'qc_insp_rec.结果列数 仍有空值(应至少为 1)', 16, 1);

/* ⚠ CTE 后面只能跟**一条**语句(查询/UPDATE/INSERT),直接接 IF 会报「关键字 'IF' 附近有语法错误」
   (2026-11-19 本脚本首跑踩过)⇒ 先 INTO 临时表,再 IF 判。 */
;WITH rowmax AS (
    SELECT d.单据编号,
           CASE
             WHEN ISNULL(d.[结果20],N'') <> N'' THEN 20 WHEN ISNULL(d.[结果19],N'') <> N'' THEN 19
             WHEN ISNULL(d.[结果18],N'') <> N'' THEN 18 WHEN ISNULL(d.[结果17],N'') <> N'' THEN 17
             WHEN ISNULL(d.[结果16],N'') <> N'' THEN 16 WHEN ISNULL(d.[结果15],N'') <> N'' THEN 15
             WHEN ISNULL(d.[结果14],N'') <> N'' THEN 14 WHEN ISNULL(d.[结果13],N'') <> N'' THEN 13
             WHEN ISNULL(d.[结果12],N'') <> N'' THEN 12 WHEN ISNULL(d.[结果11],N'') <> N'' THEN 11
             WHEN ISNULL(d.[结果10],N'') <> N'' THEN 10 WHEN ISNULL(d.[结果9],N'')  <> N'' THEN 9
             WHEN ISNULL(d.[结果8],N'')  <> N'' THEN 8  WHEN ISNULL(d.[结果7],N'')  <> N'' THEN 7
             WHEN ISNULL(d.[结果6],N'')  <> N'' THEN 6  WHEN ISNULL(d.[结果5],N'')  <> N'' THEN 5
             WHEN ISNULL(d.[结果4],N'')  <> N'' THEN 4  WHEN ISNULL(d.[结果3],N'')  <> N'' THEN 3
             WHEN ISNULL(d.[结果2],N'')  <> N'' THEN 2  WHEN ISNULL(d.[结果1],N'')  <> N'' THEN 1
             ELSE 1
           END AS n
      FROM dbo.qc_insp_rec_detail d
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
), docmax AS (
    SELECT 单据编号, MAX(n) AS n FROM rowmax GROUP BY 单据编号
)
SELECT h.单据编号, h.[结果列数], m.n
  INTO #badcols
  FROM dbo.qc_insp_rec h
  JOIN docmax m ON m.单据编号 = h.单据编号
 WHERE h.[结果列数] < m.n;

IF EXISTS (SELECT 1 FROM #badcols)
BEGIN
    DECLARE @bad nvarchar(300) = (
        SELECT TOP 5 STRING_AGG(CONVERT(nvarchar(50), 单据编号) + N'(列数' + CONVERT(nvarchar(10), 结果列数)
                              + N'<用到' + CONVERT(nvarchar(10), n) + N')', N'、')
          FROM #badcols);
    DROP TABLE #badcols;
    RAISERROR(N'有单据的结果列数少于它实际用到的格数(会藏掉已填的值):%s', 16, 1, @bad);
END
DROP TABLE #badcols;

SELECT N'单数' AS 项, COUNT(*) AS 值 FROM dbo.qc_insp_rec
UNION ALL SELECT N'列数=1 的单数', COUNT(*) FROM dbo.qc_insp_rec WHERE [结果列数] = 1
UNION ALL SELECT N'列数>1 的单数', COUNT(*) FROM dbo.qc_insp_rec WHERE [结果列数] > 1
UNION ALL SELECT N'列数>20 的单数', COUNT(*) FROM dbo.qc_insp_rec WHERE [结果列数] > 20;
PRINT N'✅ 检验报告检测结果列数已改为「默认 1 格」口径(存量按实际用到的格数回填)';
GO
