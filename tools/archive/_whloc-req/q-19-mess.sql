SET NOCOUNT ON;
PRINT N'=== 1. 当前 bs_wh_loc 全量(按 仓库/库区/排号 排) ===';
SELECT 仓库编码, 仓库, 库区, 排号, 位号, 层号, 仓位编码, 仓位地址, ISNULL(asp_user1,N'') AS 来源
FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
ORDER BY 仓库编码, 库区, 排号, 位号, 层号;
GO
PRINT N'=== 2. 乱点A:试录垃圾行(2026-09-28 的 5 行,编码无规律) ===';
SELECT id, 仓库, 仓库编码, 仓位编码, 仓位地址, 库区, 排号, 位号, 层号, asp_user1,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间
FROM dbo.bs_wh_loc WHERE ISNULL(asp_user1,N'') <> N'migration' ORDER BY id;
GO
PRINT N'=== 3. 乱点B:「排号」列语义不纯 —— 炭粉/胶粉是纯数字,货架区却塞了区码 ===';
SELECT 库区,
       COUNT(*) AS 行数,
       MIN(排号) AS 排号最小, MAX(排号) AS 排号最大,
       SUM(CASE WHEN 排号 LIKE N'%[^0-9]%' THEN 1 ELSE 0 END) AS 含非数字的排号,
       SUM(CASE WHEN 层号 IS NOT NULL THEN 1 ELSE 0 END) AS 有层号
FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' GROUP BY 库区 ORDER BY 库区;
GO
PRINT N'=== 4. 乱点C:物理区码没有落列(只能从编码里切);且同一区码跨用途 ===';
SELECT LEFT(仓位编码, CHARINDEX(N'-', 仓位编码)-1) AS 从编码切出的区码, COUNT(*) AS 行数,
       MIN(库区) AS 挂的库区_最小, MAX(库区) AS 挂的库区_最大
FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A'
GROUP BY LEFT(仓位编码, CHARINDEX(N'-', 仓位编码)-1) ORDER BY 区码;
GO
PRINT N'=== 5. 乱点D:仓库名称/编码双写,以及空编码/空仓库的脏行 ===';
SELECT
  SUM(CASE WHEN ISNULL(仓库编码,N'')=N'' THEN 1 ELSE 0 END) AS 仓库编码为空,
  SUM(CASE WHEN ISNULL(仓位编码,N'')=N'' THEN 1 ELSE 0 END) AS 仓位编码为空,
  SUM(CASE WHEN ISNULL(仓位地址,N'')=N'' THEN 1 ELSE 0 END) AS 仓位地址为空,
  SUM(CASE WHEN ISNULL(库区,N'')=N''    THEN 1 ELSE 0 END) AS 库区为空,
  COUNT(*) AS 总行
FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
PRINT N'=== 6. 乱点E:仓库名与 bs_wh 是否一致(名称双写漂移风险) ===';
SELECT l.仓库编码, l.仓库 AS 仓位列存的名字, w.仓库名称 AS bs_wh里的名字,
       CASE WHEN w.仓库编码 IS NULL THEN N'★档案不存在' WHEN l.仓库<>w.仓库名称 THEN N'★名称不一致' ELSE N'一致' END AS 判定
FROM (SELECT DISTINCT 仓库编码, 仓库 FROM dbo.bs_wh_loc) l
LEFT JOIN dbo.bs_wh w ON w.仓库编码=l.仓库编码 ORDER BY l.仓库编码;
GO
PRINT N'=== 7. 编码语法:同一表里几种段数 ===';
SELECT LEN(仓位编码)-LEN(REPLACE(仓位编码,N'-',N''))+1 AS 段数, COUNT(*) AS 行数,
       MIN(仓位编码) AS 例1, MAX(仓位编码) AS 例2
FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' GROUP BY LEN(仓位编码)-LEN(REPLACE(仓位编码,N'-',N''))+1;
GO
