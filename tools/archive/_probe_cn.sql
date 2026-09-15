CREATE TABLE ##probe_cn (t nvarchar(50));
INSERT INTO ##probe_cn VALUES (N'不合格报告(制程)-测试');
SELECT t, LEN(t) AS len FROM ##probe_cn;
DROP TABLE ##probe_cn;
