SET NOCOUNT ON;
SELECT id AS id,
       RTRIM([仓库编码]) AS 仓库编码,
       RTRIM([仓库名称]) AS 仓库名称,
       ISNULL(RTRIM([仓库分类]), N'') AS 仓库分类,
       ISNULL(RTRIM([状态]), N'') AS 状态,
       ISNULL(停用, 0) AS 停用,
       ISNULL(asp_cancel, N'N') AS 作废,
       ISNULL(外部数据ID, N'') AS 外部数据ID,
       ISNULL(asp_user1, N'') AS 创建者,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间
FROM bs_wh
ORDER BY id;

SET NOCOUNT ON;
SELECT COUNT(*) AS bs_wh行数,
       SUM(CASE WHEN ISNULL(停用,0)=0 AND ISNULL(asp_cancel,N'N')<>N'Y' THEN 1 ELSE 0 END) AS 启用行数,
       SUM(CASE WHEN ISNULL(外部数据ID,N'')<>N'' THEN 1 ELSE 0 END) AS 有外部数据ID行数
FROM bs_wh;

SET NOCOUNT ON;
SELECT RTRIM(ckdm) AS 仓库编码, RTRIM(wzdm) AS 物料编码, COUNT(*) AS 行数, SUM(yl) AS 现存量
FROM kucun GROUP BY RTRIM(ckdm), RTRIM(wzdm) ORDER BY 仓库编码, 物料编码;

SET NOCOUNT ON;
SELECT RTRIM(ckdm) AS 仓库编码, COUNT(DISTINCT RTRIM(wzdm)) AS 物料数, SUM(yl) AS 现存量合计
FROM kucun GROUP BY RTRIM(ckdm) ORDER BY 仓库编码;
