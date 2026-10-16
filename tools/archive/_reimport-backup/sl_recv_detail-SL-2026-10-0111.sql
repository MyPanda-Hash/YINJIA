/* 安全重灌:sl_recv_detail / SL-2026-10-0111 —— 由 _safe-reimport-details.mjs 生成 2026-10-16T06:39:57.807Z */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
BEGIN TRAN;
DELETE FROM [sl_recv_detail] WHERE [单据编号] = N'SL-2026-10-0111';
DECLARE @del int = @@ROWCOUNT;
INSERT INTO [sl_recv_detail] ([单据编号], [物料编码], [物料名称], [数量], [批次号]) VALUES (N'SL-2026-10-0111', N'YJ-GL-001', N'甘油', N'100', N'GL-20260924');
DECLARE @ins int = @@ROWCOUNT;
IF @ins <> 1 BEGIN ROLLBACK TRAN; RAISERROR(N'[中止] 插入行数与 CSV 不符,已回滚', 16, 1); END
ELSE BEGIN COMMIT TRAN; PRINT N'[OK] 删除 ' + CAST(@del AS nvarchar(10)) + N' 行,插入 ' + CAST(@ins AS nvarchar(10)) + N' 行'; END
GO
