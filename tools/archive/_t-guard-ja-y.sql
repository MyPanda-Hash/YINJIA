-- _t-guard-ja-y.sql — 守卫用例造数①:把测试账套的 MO-2026-09-0108 标记为已结案(仅 HSDZ_MES_TEST!)
-- ⚠ 只允许在测试账套执行;用例跑完由 _t-guard-restore.sql 还原。
SET NOCOUNT ON;
UPDATE plang SET ja = N'Y' WHERE pl_no = N'MO-2026-09-0108' AND ISNULL(asp_cancel,'N') <> 'Y';
SELECT pl_no, pl_xc, ja, ISNULL(pl_sl,0) AS pl_sl FROM plang WHERE pl_no = N'MO-2026-09-0108';
