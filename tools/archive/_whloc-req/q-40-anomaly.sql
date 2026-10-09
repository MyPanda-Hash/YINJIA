SET NOCOUNT ON;
PRINT N'=== 正式库:大区/存储分区 异常值全扫描(白名单之外) ===';
SELECT 仓库编码, 仓位编码, ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区,
       asp_user1, asp_user2, asp_time1, asp_time2
FROM bs_wh_loc
WHERE 仓库编码 IN (N'CK-A',N'CP-02',N'CK-C',N'CK-D')
  AND ( (ISNULL(大区,N'')<>N'' AND 大区 NOT IN (N'原料区',N'辅料及配件区',N'成品仓区'))
     OR (ISNULL(存储分区,N'')<>N'' AND 存储分区 NOT IN (N'炭粉区',N'胶粉区',N'货架区',N'纸箱区',N'端盖区',N'PP棉区',N'无纺布区',N'网套区',N'标签区')) )
ORDER BY asp_time2 DESC;
GO
PRINT N'=== 时间点分布:今天 21:00 之后被改过的行 ===';
SELECT 仓库编码, 仓位编码, ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区, asp_user1, asp_user2, asp_time2
FROM bs_wh_loc WHERE asp_time2 >= '2026-10-08 20:00:00' ORDER BY asp_time2 DESC;
GO