-- migrate-whloc-newplant-drop-20261008.sql
-- 用户口径 2026-10-08:「不对删除上面一条的,然后这是编码规则 对于仓位的编码规则
--   B1-01-1/2 = B仓1区-01排-1#位/2#位」 —— 即仓位编码统一为「<区>-<排>-<位>」三段式。
-- 上一批 migrate-whloc-newplant-20261008.sql 给 新厂区原料区/辅料及配件区 用了
--   「<区码>-<序号>」的两段式(纸箱区-14 / 炭1区-36),**规则不对 ⇒ 整批删除**,待按三段式重做。
--
-- 删除范围(精确圈定,不碰 D仓 成品那 168 个):
--   仓库编码 = CK-D 且 asp_user1='migration' 且 仓位编码 NOT LIKE 'D[0-9]%-%'
--   (成品仓位编码形如 D1-01-1 / D11-08-2,均以 D+数字 开头;本批的以 炭/胶粉/纸箱区/H 开头)
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

PRINT N'=== 删除前核对 ===';
SELECT N'本次将删(应 622)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM dbo.bs_wh_loc
  WHERE 仓库编码=N'CK-D' AND asp_user1=N'migration' AND ISNULL(asp_cancel,'N')<>'Y' AND 仓位编码 NOT LIKE N'D[0-9]%-%'
UNION ALL SELECT N'D仓 成品保留(应 168)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc
  WHERE 仓库编码=N'CK-D' AND ISNULL(asp_cancel,'N')<>'Y' AND 仓位编码 LIKE N'D[0-9]%-%'
UNION ALL SELECT N'其它仓不受影响(应 511 = 679-168)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc
  WHERE 仓库编码<>N'CK-D' AND ISNULL(asp_cancel,'N')<>'Y';
GO

PRINT N'=== 待删编码抽样(每分区首条) ===';
SELECT 大区, 存储分区, MIN(仓位编码) AS 首条, COUNT(*) AS 行数
FROM dbo.bs_wh_loc
WHERE 仓库编码=N'CK-D' AND asp_user1=N'migration' AND ISNULL(asp_cancel,'N')<>'Y' AND 仓位编码 NOT LIKE N'D[0-9]%-%'
GROUP BY 大区, 存储分区 ORDER BY 大区, 存储分区;
GO

PRINT N'=== 执行删除 ===';
DECLARE @del int;
DELETE FROM dbo.bs_wh_loc
WHERE 仓库编码=N'CK-D' AND asp_user1=N'migration' AND ISNULL(asp_cancel,'N')<>'Y' AND 仓位编码 NOT LIKE N'D[0-9]%-%';
SET @del = @@ROWCOUNT;
PRINT N'  ✓ 已删除 ' + CAST(@del AS nvarchar(10)) + N' 行';
GO

PRINT N'=== 删除后核对 ===';
SELECT N'总仓位(应 1301-622=679)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'D仓(应 168,只剩成品仓区)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-D' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'D仓 大区=成品仓区(应 168)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-D' AND 大区=N'成品仓区' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'仓位地址为空(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(仓位地址,N'')=N''
UNION ALL SELECT N'仓位编码重复组(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM (
    SELECT 仓位编码 FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 仓位编码 HAVING COUNT(*)>1) d;
GO
PRINT N'=== 删后层次全景 ===';
SELECT w.厂区, w.仓库名称 AS 仓, ISNULL(l.大区,N'(不分区)') AS 大区, ISNULL(l.存储分区,N'(—)') AS 分区, COUNT(*) AS 仓位数
FROM dbo.bs_wh_loc l JOIN dbo.bs_wh w ON w.仓库编码=l.仓库编码
WHERE ISNULL(l.asp_cancel,'N')<>'Y'
GROUP BY w.厂区, w.仓库名称, l.大区, l.存储分区 ORDER BY w.厂区 DESC, w.仓库名称, l.大区, l.存储分区;
GO
PRINT N'migrate-whloc-newplant-drop-20261008 完成';
GO
