SET NOCOUNT ON;
/* 演示账号只在验证期间存在(仅测试账套):用完即删,不留后门 */
DELETE FROM dbo.yj_user WHERE username = 'qcflowdemo';
SELECT N'剩余演示账号' AS k, COUNT(*) AS v FROM dbo.yj_user WHERE username = 'qcflowdemo';
