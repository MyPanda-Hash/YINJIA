SET NOCOUNT ON;
PRINT N'=== 4. 物理区码没落列(只能从编码切);同一区码跨用途 ===';
SELECT LEFT(仓位编码, CHARINDEX(N'-', 仓位编码)-1) AS 切出的区码, COUNT(*) AS 行数,
       MIN(库区) AS 挂的库区, MAX(库区) AS 库区2
FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A'
GROUP BY LEFT(仓位编码, CHARINDEX(N'-', 仓位编码)-1) ORDER BY 1;
GO
PRINT N'=== 5. 空值/脏行统计 ===';
SELECT
  SUM(CASE WHEN ISNULL(仓库编码,N'')=N'' THEN 1 ELSE 0 END) AS 仓库编码空,
  SUM(CASE WHEN ISNULL(仓位编码,N'')=N'' THEN 1 ELSE 0 END) AS 仓位编码空,
  SUM(CASE WHEN ISNULL(仓位地址,N'')=N'' THEN 1 ELSE 0 END) AS 仓位地址空,
  SUM(CASE WHEN ISNULL(库区,N'')=N''    THEN 1 ELSE 0 END) AS 库区空,
  COUNT(*) AS 有效总行
FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
PRINT N'=== 6. 仓库名双写是否漂移 ===';
SELECT l.仓库编码, l.仓库 AS 仓位表存的名字, w.仓库名称 AS bs_wh里的名字,
       CASE WHEN w.仓库编码 IS NULL THEN N'档案不存在' WHEN l.仓库<>w.仓库名称 THEN N'名称不一致' ELSE N'一致' END AS 判定
FROM (SELECT DISTINCT 仓库编码, 仓库 FROM dbo.bs_wh_loc) l
LEFT JOIN dbo.bs_wh w ON w.仓库编码=l.仓库编码 ORDER BY l.仓库编码;
GO
PRINT N'=== 7. 编码段数分布(CK-A) ===';
SELECT LEN(仓位编码)-LEN(REPLACE(仓位编码,N'-',N''))+1 AS 段数, COUNT(*) AS 行数,
       MIN(仓位编码) AS 例1, MAX(仓位编码) AS 例2
FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' GROUP BY LEN(仓位编码)-LEN(REPLACE(仓位编码,N'-',N''))+1 ORDER BY 1;
GO