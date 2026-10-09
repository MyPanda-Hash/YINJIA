SET NOCOUNT ON;
PRINT N'=== 文档所述现状核对 ===';
SELECT N'仓位总数(应 679)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'仓库档案数(应 10)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'四个仓(应 4)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh WHERE 仓库编码 IN (N'CK-A',N'CP-02',N'CK-C',N'CK-D')
UNION ALL SELECT N'仓位编码 三段式(A/B/C/D 成品等,应 679)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc
  WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓位编码 LIKE N'%-%-%'
UNION ALL SELECT N'仓位编码 两段式(应 0 — 新厂区那批已删)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc
  WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓位编码 NOT LIKE N'%-%-%';
GO
PRINT N'=== 四层全景(文档 §一 对照) ===';
SELECT w.厂区, w.仓库名称 AS 仓, ISNULL(l.大区,N'(不分区)') AS 大区, ISNULL(l.存储分区,N'(—)') AS 分区, COUNT(*) AS 仓位数
FROM dbo.bs_wh_loc l JOIN dbo.bs_wh w ON w.仓库编码=l.仓库编码
WHERE ISNULL(l.asp_cancel,'N')<>'Y'
GROUP BY w.厂区, w.仓库名称, l.大区, l.存储分区 ORDER BY w.厂区 DESC, w.仓库名称, l.大区, l.存储分区;
GO