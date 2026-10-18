-- 模拟「外部程序一次把多张工单写成已结案」(用户报障场景)
UPDATE dbo.plang SET ja = N'Y', asp_user2 = N'external-sim(测试)', asp_time2 = GETDATE()
 WHERE pl_no IN ('GD-2026-10-0220','GD-2026-10-0221','GD-2026-10-0222') AND ISNULL(asp_cancel,'N') <> 'Y';
SELECT COUNT(*) AS 已改成Y的行数 FROM dbo.plang WHERE ISNULL(asp_user2,N'')='external-sim(测试)' AND ISNULL(ja,'N')='Y';
