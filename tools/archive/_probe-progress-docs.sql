/* 只读探针(2026-10-09):列出 rd_progress 里的全部单据 + 各自明细行数
   用 RAISERROR 报数(DbSync 吞 PRINT)。不改任何数据。 */
SET NOCOUNT ON;
GO
DECLARE @m nvarchar(2000) = N'';
SELECT @m = @m + N'[' + ISNULL(h.单据编号, N'?')
              + N' 明细行=' + CAST((SELECT COUNT(*) FROM rd_progress_detail d WHERE d.单据编号 = h.单据编号) AS nvarchar(10))
              + N'] '
FROM rd_progress h ORDER BY h.单据编号;
IF @m = N'' SET @m = N'(rd_progress 无行)';
RAISERROR(N'RD_PROGRESS 单据清单: %s', 16, 1, @m);
GO
