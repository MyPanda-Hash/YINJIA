SET NOCOUNT ON;
-- 软删留痕:本次迁移打标行
SELECT RTRIM([仓库编码]) AS 仓库编码, RTRIM([仓库名称]) AS 仓库名称, [状态], [停用],
       ISNULL(asp_cancel, N'N') AS 作废, ISNULL(asp_user2, N'') AS 改者,
       CONVERT(varchar(19), asp_time2, 120) AS 改时间
FROM dbo.bs_wh
WHERE asp_user2 = N'wh-kingdee-only'
ORDER BY [仓库编码];

SET NOCOUNT ON;
-- 全表一览(含软删):核对只剩金蝶 6 行在册
SELECT RTRIM([仓库编码]) AS 仓库编码, RTRIM([仓库名称]) AS 仓库名称,
       ISNULL([外部数据ID], N'') AS 外部数据ID, [状态], [停用],
       ISNULL(asp_cancel, N'N') AS 作废, ISNULL(asp_user1, N'') AS 建者
FROM dbo.bs_wh
ORDER BY ISNULL(asp_cancel, N'N'), [仓库编码];

SET NOCOUNT ON;
-- 自检口径(越界数=0):启用中非金蝶来源 / 金蝶 6 仓缺失
SELECT (SELECT COUNT(*) FROM dbo.bs_wh WHERE ISNULL(asp_cancel,N'N')<>N'Y' AND ISNULL([外部数据ID],N'')=N'') AS 启用中非金蝶来源,
       (SELECT COUNT(*) FROM dbo.bs_wh WHERE ISNULL(asp_cancel,N'N')<>N'Y') AS 启用中总行数,
       (SELECT COUNT(*) FROM (VALUES (N'YJ-08'),(N'CP-02'),(N'CK00003'),(N'YCL-01'),(N'CK00006'),(N'CK00005')) v(code)
         WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_wh w WHERE RTRIM(w.[仓库编码])=v.code AND ISNULL(w.asp_cancel,N'N')<>N'Y')) AS 金蝶仓缺失数;
