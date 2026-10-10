/* 只读核对(2026-10-09) v2:定向看**同步目标那张进度单**的明细,别被遗留行干扰。
   同步目标 = rd_progress 里未取消、编号最大的那张(= syncPlanToProgress 的选取口径)。 */
SET NOCOUNT ON;
GO
DECLARE @doc nvarchar(60) = (SELECT TOP 1 单据编号 FROM rd_progress
                              WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY 单据编号 DESC);
DECLARE @cnt int = (SELECT COUNT(*) FROM rd_progress_detail WHERE 单据编号 = @doc);

DECLARE @m nvarchar(4000) = N'';
SELECT TOP 5 @m = @m + N'<' + ISNULL([单据编号], N'?')
       + N' | 名称=' + ISNULL(CONVERT(nvarchar(40), [项目名称]), N'-')
       + N' | 定级=' + ISNULL(CONVERT(nvarchar(20), [项目层级]), N'-')
       + N' | 发起人=' + ISNULL(CONVERT(nvarchar(40), [项目级]), N'-')
       + N' | 立项日期=' + ISNULL(CONVERT(nvarchar(19), [实施进度]), N'-')
       + N' | 内容=' + LEFT(ISNULL(CONVERT(nvarchar(200), [内容]), N'-'), 80)
       + N'> '
FROM rd_progress_detail WHERE 单据编号 = @doc;

IF @m = N'' SET @m = N'(该单无明细行)';
RAISERROR(N'TARGET_DOC=%s 明细行数=%d  %s', 16, 1, @doc, @cnt, @m);
GO
