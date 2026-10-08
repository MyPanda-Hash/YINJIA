SET NOCOUNT ON;
PRINT N'=== 全库找 12123 / 临时测试痕迹 ===';
SELECT 仓库编码, 仓位编码, ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区, asp_user1, asp_time2
FROM bs_wh_loc
WHERE 大区 LIKE N'%12123%' OR 存储分区 LIKE N'%12123%' OR 大区 LIKE N'%ZZ%' OR 存储分区 LIKE N'%ZZ%'
   OR 大区 LIKE N'%测试%' OR 存储分区 LIKE N'%测试%';
GO
PRINT N'=== 面板第一行(仓库/id 倒序)看 大区 实际值 ===';
SELECT TOP 3 仓库编码, 仓位编码, ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区, id
FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
PRINT N'=== 大区 取值分布(应只有 3 个 + 空) ===';
SELECT ISNULL(大区,N'(空)') AS 大区, COUNT(*) AS 行数 FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 大区 ORDER BY 大区;
GO