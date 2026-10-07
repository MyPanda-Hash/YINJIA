-- _t-guard-plsl0.sql — 守卫用例造数②:测试账套 MO-2026-09-0108 排产数量置 0(未排产;仅 HSDZ_MES_TEST!)
SET NOCOUNT ON;
UPDATE plang SET pl_sl = 0, ja = N'N' WHERE pl_no = N'MO-2026-09-0108' AND ISNULL(asp_cancel,'N') <> 'Y';
SELECT pl_no, pl_xc, ja, ISNULL(pl_sl,0) AS pl_sl FROM plang WHERE pl_no = N'MO-2026-09-0108';
