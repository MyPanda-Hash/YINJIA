-- _t-guard-restore.sql — 守卫用例还原:MO-2026-09-0108 恢复 ja=N / pl_sl=100(测试账套原值,见 _q-topicking-guard.sql)
SET NOCOUNT ON;
UPDATE plang SET ja = N'N', pl_sl = 100 WHERE pl_no = N'MO-2026-09-0108' AND ISNULL(asp_cancel,'N') <> 'Y';
SELECT pl_no, pl_xc, ja, ISNULL(pl_sl,0) AS pl_sl FROM plang WHERE pl_no = N'MO-2026-09-0108';
