-- 测试用:模拟「外部程序把 GD-2026-10-0220 行1 写成已结案」(ja=Y),用于验证结案巡检/回正
UPDATE dbo.plang SET ja = N'Y', asp_user2 = N'external-sim(测试)', asp_time2 = GETDATE()
 WHERE id = 426 AND ISNULL(asp_cancel,'N') <> 'Y';
SELECT id, pl_no, pl_xc, ja, ISNULL(asp_user2,N'') AS u2, pl_sl, rk_sl FROM dbo.plang WHERE id = 426;
