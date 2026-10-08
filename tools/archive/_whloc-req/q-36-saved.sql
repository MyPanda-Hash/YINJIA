SET NOCOUNT ON;
PRINT N'=== 测试库 bs_wh_loc:刚才那行 ===';
SELECT 仓库编码, 仓位编码, ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区,
       asp_user1 AS 操作人, asp_time2 AS 最后修改
FROM bs_wh_loc WHERE 仓位编码=N'B4-24-2';
GO
PRINT N'=== 测试库 存储分区 取值分布(看新值是否入库 + 是否进了候选源) ===';
SELECT ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区, COUNT(*) AS 仓位数
FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 大区, 存储分区 ORDER BY 大区, 存储分区;
GO