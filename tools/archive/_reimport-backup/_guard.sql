SET NOCOUNT ON;
SELECT N''状态'' AS t, ISNULL(单据状态, N''(空)'') AS 状态 FROM [sl_recv] WHERE 单据编号 = N'SL-2026-10-0111';
