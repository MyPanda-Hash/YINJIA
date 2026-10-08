-- _cleanup-stray-whloc-cols-test.sql — 一次性清理:删掉「重跑演练」在测试账套上复活的两个空死列
--
-- 来龙去脉(2026-10-08,打包前的本地演练副产品):
--   为验证「包内脚本能被强制重跑」,对 HSDZ_MES_TEST 逐条跑了 to-run 的 11 条。其中
--   migrate-whloc-area-a-raw 的自愈守卫是裸 `IF COL_LENGTH(旧列) IS NULL THEN ADD`,而这两个旧列
--   在链条后段已被改掉:
--     · `库区`  → clean-coord 改名成 `存储分区`
--     · `厂区`  → zone-logic 从 bs_wh_loc DROP(厂区 归 bs_wh)
--   于是在**重跑**时会把它们建回来(空列):先出现 库区(38→39),清理后又出现 厂区(→39)。
--
--   ⚠ 为什么不改脚本根治(已实测定论,勿再尝试):
--     area-a-raw 的 INSERT 必须写 `库区`(它是 `存储分区` 的血统来源),而控制流**无法**让该语句在
--     列不存在时不被编译 —— 实测 `IF <列不存在> ... ELSE ...` 这种血统二择一在本环境不成立:SQL Server
--     整批编译,报 `Invalid column name`(见 tools/archive/_registry-audit-20261008/_probe-guard-compile.sql 的实测)。
--     要根治只能改成动态 SQL(而其数据源 @gen 是表变量,动态 SQL 里看不见)—— 属独立的重构任务。
--     ⇒ 首次应用(部署路径)**完全不受影响**(那时列都在);只有重跑这条脚本才会冒出死列,本脚本负责清掉。
--
-- 幂等:列不存在即跳过。只删列 + 其上的扩展属性 + 指向它的 yj_field 登记,不动任何数据
--   (两列恒为空;yj_field 的登记行是重跑时被重新插进来的)。
-- 口径:**两个账套都跑过** —— 演练先污染了 HSDZ_MES_TEST;整理正式库时(把 rest 的修复同步过去、
--   DbSync 顺带重跑了 area-a-raw)HSDZ_MES 也复现了同样的 40 列残留,故两账套各清一次。
SET NOCOUNT ON;
GO
DECLARE @c nvarchar(50), @cid int;
DECLARE cur CURSOR FOR SELECT v FROM (VALUES (N'厂区'), (N'库区')) t(v);
OPEN cur;
FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.bs_wh_loc', @c) IS NOT NULL
  BEGIN
    SET @cid = COLUMNPROPERTY(OBJECT_ID('dbo.bs_wh_loc'), @c, 'ColumnId');
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.bs_wh_loc') AND minor_id = @cid AND name = 'MS_Description')
      EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', @c;
    DELETE FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = @c;
    EXEC(N'ALTER TABLE dbo.bs_wh_loc DROP COLUMN [' + @c + N']');
    PRINT N'  ✓ 已删除残留空列 bs_wh_loc.' + @c;
  END
  ELSE PRINT N'  · bs_wh_loc.' + @c + N' 不存在,跳过';
  FETCH NEXT FROM cur INTO @c;
END
CLOSE cur; DEALLOCATE cur;
GO
-- 自检
SELECT N'bs_wh_loc 列数(应 38)' AS 检查项,
       CAST((SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_wh_loc')) AS nvarchar(10)) AS 值
UNION ALL SELECT N'厂区 已不存在(应 1)', CASE WHEN COL_LENGTH('dbo.bs_wh_loc', N'厂区') IS NULL THEN N'1' ELSE N'0' END
UNION ALL SELECT N'库区 已不存在(应 1)', CASE WHEN COL_LENGTH('dbo.bs_wh_loc', N'库区') IS NULL THEN N'1' ELSE N'0' END
UNION ALL SELECT N'WHLOC 字段登记行(应 12)', CAST((SELECT COUNT(*) FROM yj_field WHERE panel_code='WHLOC') AS nvarchar(10))
UNION ALL SELECT N'有效仓位(应 679)', CAST((SELECT COUNT(*) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y') AS nvarchar(10));
GO
