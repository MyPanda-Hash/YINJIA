SET NOCOUNT ON;
-- 校验:族档(B-46-09 折叠复合阻垢炭棒/滤芯 48*30*231)取到的是不是家庭里最近一次
SELECT TOP 5 p.id, p.pl_no, p.dm, p.mc, p.gg, p.[工艺路线], CONVERT(varchar(10),p.pl_date,120) AS 日期
FROM plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.mc=N'折叠复合阻垢炭棒/滤芯' AND ISNULL(p.gg,N'')=N'48*30*231'
ORDER BY p.pl_date DESC, p.id DESC;
-- 家庭里各编码的最近一次对照(看是否同类产品的多编码历史)
SELECT p.dm, COUNT(*) 次数, MAX(CONVERT(varchar(10),p.pl_date,120)) 最近日期
FROM plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.mc=N'折叠复合阻垢炭棒/滤芯' AND ISNULL(p.gg,N'')=N'48*30*231'
GROUP BY p.dm ORDER BY 最近日期 DESC;
