-- migrate-whloc-drop-stale-cols-20261008.sql
-- 清理 2026-10-08 事故留下的**废弃列、漂移字段与孤儿译名**(与 migrate-whloc-fix-dup-zone-field 同一事故)
--
-- 【现状(实测)】bs_wh_loc 上多出两个**100% 为空**的列,列数由登记在册的 38 涨到 40:
--   · `厂区` —— 用户已定「厂区应该在仓库表而不是仓位表」,该列被 migrate-whloc-zone-logic 删掉、
--     改由 bs_wh.厂区 承载;但 migrate-whloc-area-a-raw §2 的 `IF COL_LENGTH('厂区') IS NULL ALTER TABLE ADD`
--     在重跑时把它**"自愈"补了回来**,随后 §3 的字段登记守卫放行 ⇒ 又插了一行 yj_field,
--     **该字段挂在仓位表上却没有对应语义**(体检 05 项「元数据漂移」由此 FAIL)。
--   · `库区` —— 被 migrate-whloc-clean-coord 改名成 `存储分区`;同理被 area-a-raw §2 重跑补回(空列);
--     area-a-raw 旧版 §4 还把 9 条 `库区` 译名又插了回来(改名后成为孤儿)。
--
-- 【根因已同批修掉】area-a-raw 的 §2/§3/§5.4/§6 已改为:厂区 整段摘除、库区 直接用最终名
--   `存储分区` ⇒ **本脚本清掉之后不会再被补回来**(否则清了也白清)。
--
-- 【步骤顺序很重要】必须**先 DROP 列、再删漂移行** —— 漂移的判据是「字段的 col_name 在本表不存在」,
--   若列还在就判不出来(初版就是这个顺序,白跑一次)。
--   1. 丢弃废弃空列(非空则拒绝删除并告警,绝不静默丢数据);
--   2. 删除元数据漂移行(字段的 col_name 在 bs_wh_loc 上不存在);
--   3. 删除孤儿译名(没有任何 yj_field 用到的 field/库区);
--   4. 自检:列数回 38、WHLOC 字段 12、漂移 0、重复 0、数据未动。
--
-- 【幂等】DROP 前置 `COL_LENGTH ... IS NOT NULL` + 空列校验;漂移行按"列不存在"判删;
--   孤儿译名按"无字段引用"判删。已清则全 0 行。
-- 【执行】两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 丢弃废弃空列(空列校验不过就拒绝) ══════════
-- ⚠ 必须用**动态 SQL**:T-SQL 对「存在的表 + 不存在的列」是**编译期**绑定,即使写在
--   `IF COL_LENGTH(...) IS NOT NULL` 的未执行分支里也会报 `Invalid column name`(实测踩到)。
--   所以列名只能出现在字符串里,由 sp_executesql / EXEC 在运行期解析。
-- 1.1 厂区(已在 bs_wh 承载)
IF COL_LENGTH('dbo.bs_wh_loc', N'厂区') IS NOT NULL
BEGIN
  DECLARE @n1 int;
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM dbo.bs_wh_loc WHERE [厂区] IS NOT NULL', N'@c int OUTPUT', @c = @n1 OUTPUT;
  IF @n1 > 0 PRINT N'  ⚠ bs_wh_loc.厂区 仍有 ' + CAST(@n1 AS nvarchar(10)) + N' 行非空数据,拒绝 DROP(请人工核对后再处理)';
  ELSE
  BEGIN
    EXEC(N'ALTER TABLE dbo.bs_wh_loc DROP COLUMN [厂区]');
    PRINT N'  ✓ DROP bs_wh_loc.厂区(全空列;厂区归 bs_wh.厂区)';
  END
END
ELSE PRINT N'  · bs_wh_loc.厂区 不存在,跳过';
GO
-- 1.2 库区(已改名为 存储分区)
IF COL_LENGTH('dbo.bs_wh_loc', N'库区') IS NOT NULL
BEGIN
  DECLARE @n2 int;
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM dbo.bs_wh_loc WHERE [库区] IS NOT NULL', N'@c int OUTPUT', @c = @n2 OUTPUT;
  IF @n2 > 0 PRINT N'  ⚠ bs_wh_loc.库区 仍有 ' + CAST(@n2 AS nvarchar(10)) + N' 行非空数据,拒绝 DROP(请人工核对后再处理)';
  ELSE
  BEGIN
    EXEC(N'ALTER TABLE dbo.bs_wh_loc DROP COLUMN [库区]');
    PRINT N'  ✓ DROP bs_wh_loc.库区(全空列;该列已改名为 存储分区)';
  END
END
ELSE PRINT N'  · bs_wh_loc.库区 不存在,跳过';
GO

-- ══════════ 2. 删除元数据漂移行(字段的 col_name 在 bs_wh_loc 上不存在) ══════════
-- 放在 §1 之后:列已 DROP,漂移行才判得出来。
DECLARE @drift int;
DELETE f FROM yj_field f
WHERE f.panel_code = N'WHLOC'
  AND COL_LENGTH('dbo.bs_wh_loc', f.col_name) IS NULL;
SET @drift = @@ROWCOUNT;
PRINT N'  ✓ 删除 WHLOC 元数据漂移字段行 ' + CAST(@drift AS nvarchar(10)) + N' 行';
GO

-- ══════════ 3. 删除孤儿译名(没有任何字段在用) ══════════
-- `库区` 已改名为 `存储分区`,但 area-a-raw 旧版重跑又插了 9 条 field/库区 ⇒ 无人引用,清掉。
DECLARE @orph int;
DELETE t FROM yj_translation t
WHERE t.scope = N'field' AND t.ref_key = N'库区'
  AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.label = t.ref_key);
SET @orph = @@ROWCOUNT;
PRINT N'  ✓ 删除孤儿字段译名 ' + CAST(@orph AS nvarchar(10)) + N' 条(field/库区)';
GO

-- ══════════ 4. 自检 ══════════
SELECT N'bs_wh_loc 列数(应 38)' AS 检查项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc')
UNION ALL SELECT N'厂区 列残留(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc') AND name=N'厂区'
UNION ALL SELECT N'库区 列残留(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc') AND name=N'库区'
UNION ALL SELECT N'库区 译名残留(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE scope='field' AND ref_key=N'库区'
UNION ALL SELECT N'WHLOC 字段行数(应 12)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC'
UNION ALL SELECT N'元数据漂移(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field f WHERE f.panel_code=N'WHLOC' AND COL_LENGTH('dbo.bs_wh_loc', f.col_name) IS NULL
UNION ALL SELECT N'重复登记组(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM (SELECT col_name,label FROM yj_field WHERE panel_code=N'WHLOC' GROUP BY col_name,label HAVING COUNT(*)>1) t
UNION ALL SELECT N'存储分区 字段行(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'存储分区'
UNION ALL SELECT N'有效仓位数(应 679)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'存储分区非空行(应 259)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 存储分区 IS NOT NULL;
GO
SELECT id, seq, col_name AS 物理列, label AS 标签, data_type AS 类型, place, visible, hidden
FROM yj_field WHERE panel_code=N'WHLOC' ORDER BY seq, id;
GO
PRINT N'migrate-whloc-drop-stale-cols-20261008 完成';
GO
