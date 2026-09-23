-- migrate-rd-progress-drop-orphan-cols.sql — 删除 RD_PROGRESS 的 5 个孤儿物理列(2026-09-22)
--
-- 设计源:tools/migrate-rd-progress-18cols.sql(2026-09-18,为 rd_progress_detail 加了 13 个物理列)
-- 会话:2026-09-22。本次只删「无人读写」的 5 列,不动另外 8 列。
--
-- 【为什么删这 5 列】
--   18cols 迁移加的 13 列里,这 5 列自加列起就没有真正的写入路径,值永远停在 2026-09-18 的回填快照:
--     · 项目发起人 / 立项日期 / 测试情况 —— 全仓无任何读写(只有那次迁移的回填 UPDATE)
--     · 项目负责人 / 预计完成日期       —— 曾被 ButtonService.syncPlanToProgress **双写**
--       (2026-09-22 之前 UPDATE/INSERT 同时写 [项目负责人]+[项目负责]、[预计完成日期]+[里程完成],
--        同一事实存两份,COALESCE 参数为 NULL 时两侧必然分叉);2026-09-22 后端已改为**只写旧列**
--        [项目负责]/[里程完成],这两个新列随即变成无人读写的孤儿,与本脚本一并清理。
--   为什么界面不认这 5 个名字:前端 ProgressControlSheet.vue 用 K[label] 取落库键,而 K 来自
--   progressColumns.js 的 PROGRESS_COLUMNS,那 5 个**显示名被刻意映射到旧物理列**
--   (项目发起人→项目级、项目负责人→项目负责、立项日期→实施进度、预计完成日期→里程完成、
--     测试情况→测试员);Excel 导入导出也用 col.key。2026-09-18 的决策是 col_name 永不改
--   (改了历史单据的数据键就全丢),所以**旧列是在用的一侧,新列才是孤儿**。
--   表注明里的映射口径「界面显示名 = col 旧列名」保持不变,本脚本只更新注明文字。
--
-- 【为什么另外 8 列绝对不动】
--   项目编号 / 开发复杂度 / 重要程度 / 紧急程度 / 项目定及变更 / 技术目标达成 / 是否市场转化 /
--   未转换原因 —— 这 8 列是界面与后端**真正在读写在用**的列(progressColumns.js 的 key、
--   Excel 导入导出的 col.key、ButtonService 写 [项目编号])。删它们会直接丢业务数据。
--
-- 【备份】基线备份表 rd_progress_detail_bak_20260918 存在(由 18cols 迁移创建),本脚本**不**重建、
--   不覆盖它。⚠ 但 2026-09-22 复核发现它是**0 行的空快照**(建表当时主表尚无数据),所以它
--   **不能**当作这 5 列的回滚数据源。本次不丢数据的依据是闸门:10 行里这 5 列的非空计数全为 0、
--   5 对 diff 全为 0(见 §1 闸门与 §5 自检)。
--
-- 【幂等】删列前 COL_LENGTH 守卫 + 一致性闸门 + 条件 DELETE,可重复执行;在从未执行过
--   18cols 迁移的库(例如克隆库/测试库)上,删列与 yj_field 清理均为 no-op(无列可删、无行可删),
--   仅 §4 的表注明仍会按本脚本口径更新。
--
-- 【安全闸门】删列前逐对比对「旧列 vs 新列」的不一致行数,任何一列 >0 就 RAISERROR 中止 ——
--   宁可不删也不丢数据。⚠ 闸门批次与 DROP 批次之间**必须有 GO**:RAISERROR 不终止同一批次内
--   后续语句,只能靠批边界阻断后面的 DROP(本脚本闸门批次内不含任何 DDL)。
--
-- ⚠ 已核验(2026-09-22,正式库 HSDZ_MES):
--   · 这 5 列均无默认约束、无索引、无计算列/视图/约束依赖(sys.sql_expression_dependencies 空)
--   · 字段元数据表只有 yj_field 带 col_name(其它 yj_* 表只到 panel_code 粒度)
--   · RD_PROGRESS 的 header 侧 15 个字段里**没有**这 5 个同名字段(故无同名冲突;§3 仍限定
--     place='detail' 作防御)
--   · 删前列内值:10 行中这 5 列全为空(非空计数 0),闸门 diff=0
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ 0. 上下文 ═══
PRINT N'=== migrate-rd-progress-drop-orphan-cols.sql 开始 ===';
SELECT DB_NAME() AS 当前库, OBJECT_ID('rd_progress_detail') AS 表存在,
       OBJECT_ID('rd_progress_detail_bak_20260918') AS 备份表存在;
GO

-- ═══ 1. 安全闸门:新旧列值一致性(不一致即 RAISERROR 中止,后面的 DROP 一律不执行)═══
PRINT N'--- 1. 安全闸门:孤儿列 vs 对应旧列 ---';
DECLARE @bad int;

-- ① 项目发起人 ← 项目级
IF COL_LENGTH('rd_progress_detail', N'项目发起人') IS NOT NULL
BEGIN
  IF COL_LENGTH('rd_progress_detail', N'项目级') IS NULL
    RAISERROR(N'闸门①:旧列 [项目级] 不存在,无法核对 [项目发起人] → 中止', 16, 1);
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM rd_progress_detail WHERE ISNULL([项目级], N'''') <> ISNULL([项目发起人], N'''')',
                     N'@c int OUTPUT', @c = @bad OUTPUT;
  IF @bad > 0
    RAISERROR(N'闸门①:[项目发起人] 与 [项目级] 有 %d 行值不一致 → 有人在写新列,删列会丢数据,中止', 16, 1, @bad);
  PRINT N'  闸门① 通过:[项目发起人] 与 [项目级] 无不一致值';
END
ELSE PRINT N'  闸门① 跳过:[项目发起人] 已不存在(幂等)';
GO
-- ② 项目负责人 ← 项目负责
DECLARE @bad int;
IF COL_LENGTH('rd_progress_detail', N'项目负责人') IS NOT NULL
BEGIN
  IF COL_LENGTH('rd_progress_detail', N'项目负责') IS NULL
    RAISERROR(N'闸门②:旧列 [项目负责] 不存在,无法核对 [项目负责人] → 中止', 16, 1);
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM rd_progress_detail WHERE ISNULL([项目负责], N'''') <> ISNULL([项目负责人], N'''')',
                     N'@c int OUTPUT', @c = @bad OUTPUT;
  IF @bad > 0
    RAISERROR(N'闸门②:[项目负责人] 与 [项目负责] 有 %d 行值不一致 → 有人在写新列,删列会丢数据,中止', 16, 1, @bad);
  PRINT N'  闸门② 通过:[项目负责人] 与 [项目负责] 无不一致值';
END
ELSE PRINT N'  闸门② 跳过:[项目负责人] 已不存在(幂等)';
GO
-- ③ 立项日期 ← 实施进度
DECLARE @bad int;
IF COL_LENGTH('rd_progress_detail', N'立项日期') IS NOT NULL
BEGIN
  IF COL_LENGTH('rd_progress_detail', N'实施进度') IS NULL
    RAISERROR(N'闸门③:旧列 [实施进度] 不存在,无法核对 [立项日期] → 中止', 16, 1);
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM rd_progress_detail WHERE ISNULL([实施进度], N'''') <> ISNULL([立项日期], N'''')',
                     N'@c int OUTPUT', @c = @bad OUTPUT;
  IF @bad > 0
    RAISERROR(N'闸门③:[立项日期] 与 [实施进度] 有 %d 行值不一致 → 有人在写新列,删列会丢数据,中止', 16, 1, @bad);
  PRINT N'  闸门③ 通过:[立项日期] 与 [实施进度] 无不一致值';
END
ELSE PRINT N'  闸门③ 跳过:[立项日期] 已不存在(幂等)';
GO
-- ④ 预计完成日期 ← 里程完成
DECLARE @bad int;
IF COL_LENGTH('rd_progress_detail', N'预计完成日期') IS NOT NULL
BEGIN
  IF COL_LENGTH('rd_progress_detail', N'里程完成') IS NULL
    RAISERROR(N'闸门④:旧列 [里程完成] 不存在,无法核对 [预计完成日期] → 中止', 16, 1);
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM rd_progress_detail WHERE ISNULL([里程完成], N'''') <> ISNULL([预计完成日期], N'''')',
                     N'@c int OUTPUT', @c = @bad OUTPUT;
  IF @bad > 0
    RAISERROR(N'闸门④:[预计完成日期] 与 [里程完成] 有 %d 行值不一致 → 有人在写新列,删列会丢数据,中止', 16, 1, @bad);
  PRINT N'  闸门④ 通过:[预计完成日期] 与 [里程完成] 无不一致值';
END
ELSE PRINT N'  闸门④ 跳过:[预计完成日期] 已不存在(幂等)';
GO
-- ⑤ 测试情况 ← 测试员
DECLARE @bad int;
IF COL_LENGTH('rd_progress_detail', N'测试情况') IS NOT NULL
BEGIN
  IF COL_LENGTH('rd_progress_detail', N'测试员') IS NULL
    RAISERROR(N'闸门⑤:旧列 [测试员] 不存在,无法核对 [测试情况] → 中止', 16, 1);
  EXEC sp_executesql N'SELECT @c = COUNT(*) FROM rd_progress_detail WHERE ISNULL([测试员], N'''') <> ISNULL([测试情况], N'''')',
                     N'@c int OUTPUT', @c = @bad OUTPUT;
  IF @bad > 0
    RAISERROR(N'闸门⑤:[测试情况] 与 [测试员] 有 %d 行值不一致 → 有人在写新列,删列会丢数据,中止', 16, 1, @bad);
  PRINT N'  闸门⑤ 通过:[测试情况] 与 [测试员] 无不一致值';
END
ELSE PRINT N'  闸门⑤ 跳过:[测试情况] 已不存在(幂等)';
GO
PRINT N'  五个闸门全部通过(或列已删除跳过)→ 继续删列';
GO

-- ═══ 2. 删除 5 个孤儿物理列(COL_LENGTH 守卫,可重复执行)═══
-- 删列不做 TRY/CATCH 静默吞错:这是删数据的动作,失败必须显式失败。
PRINT N'--- 2. DROP COLUMN(仅当列存在)---';
IF COL_LENGTH('rd_progress_detail', N'项目发起人') IS NOT NULL
BEGIN
  ALTER TABLE rd_progress_detail DROP COLUMN [项目发起人];
  PRINT N'  已 DROP COLUMN [项目发起人]';
END
ELSE PRINT N'  跳过 [项目发起人](列不存在)';
GO
IF COL_LENGTH('rd_progress_detail', N'项目负责人') IS NOT NULL
BEGIN
  ALTER TABLE rd_progress_detail DROP COLUMN [项目负责人];
  PRINT N'  已 DROP COLUMN [项目负责人]';
END
ELSE PRINT N'  跳过 [项目负责人](列不存在)';
GO
IF COL_LENGTH('rd_progress_detail', N'立项日期') IS NOT NULL
BEGIN
  ALTER TABLE rd_progress_detail DROP COLUMN [立项日期];
  PRINT N'  已 DROP COLUMN [立项日期]';
END
ELSE PRINT N'  跳过 [立项日期](列不存在)';
GO
IF COL_LENGTH('rd_progress_detail', N'预计完成日期') IS NOT NULL
BEGIN
  ALTER TABLE rd_progress_detail DROP COLUMN [预计完成日期];
  PRINT N'  已 DROP COLUMN [预计完成日期]';
END
ELSE PRINT N'  跳过 [预计完成日期](列不存在)';
GO
IF COL_LENGTH('rd_progress_detail', N'测试情况') IS NOT NULL
BEGIN
  ALTER TABLE rd_progress_detail DROP COLUMN [测试情况];
  PRINT N'  已 DROP COLUMN [测试情况]';
END
ELSE PRINT N'  跳过 [测试情况](列不存在)';
GO

-- ═══ 3. 删掉这 5 列在 yj_field 的登记行 ═══
-- ⚠ 只删 place='detail' 的行。已核验(2026-09-22):RD_PROGRESS 的 header 侧 16 个字段里没有
--   同名项,所以这次删除实际只命中 detail 行;仍显式限定 place='detail' 作防御 —— header 侧
--   将来若出现同名字段(例如表头里的日期类信息)属**另一种用途**,不在本次范围,不得删。
-- ⚠ 不动 yj_translation:那 5 个中文名字仍是界面表头标签(progressColumns.js 的 label),
--   词条(tools/i18n-rd-progress-18cols.sql)继续在用。
PRINT N'--- 3. 清理 yj_field(panel_code=''RD_PROGRESS'', place=''detail'')---';
DECLARE @hdr int, @del int;
SELECT @hdr = COUNT(*) FROM yj_field
WHERE panel_code = 'RD_PROGRESS' AND place = N'header'
  AND col_name IN (N'项目发起人', N'项目负责人', N'立项日期', N'预计完成日期', N'测试情况');
IF @hdr > 0
  PRINT N'  ⚠ header 侧存在同名登记行 ' + CAST(@hdr AS nvarchar(10)) + N' 行:已按 place=''detail'' 限定,本次未删除';
ELSE
  PRINT N'  header 侧无同名登记行(已核验)';
DELETE FROM yj_field
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail'
  AND col_name IN (N'项目发起人', N'项目负责人', N'立项日期', N'预计完成日期', N'测试情况');
SET @del = @@ROWCOUNT;
PRINT N'  已删除 yj_field detail 行 ' + CAST(@del AS nvarchar(10)) + N' 行(首次应为 5,重复执行应为 0)';
GO

-- ═══ 4. 更新表注明 ═══
-- 保留「界面显示名 = col 旧物理列名」的映射口径(该口径本身是对的、也是界面实际读写的一侧),
-- 只是不再把这 5 个已删的物理列写进描述;另 8 个在用的新列照旧列名,无需特别说明。
PRINT N'--- 4. 更新 rd_progress_detail 的 MS_Description ---';
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('rd_progress_detail') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'项目进度查询行表(产品开发二三四级项目控制列表 18 列。界面显示名与物理列名的映射口径:项目定级=col 项目层级、项目发起人=col 项目级、项目负责人=col 项目负责、立项日期=col 实施进度、预计完成日期=col 里程完成、测试情况=col 测试员,其余列同名;状态=按实施计划阶段派生(只读);[说明] 是 RD_PLAN→RD_PROGRESS 同步的匹配键,与 [项目编号] 同值。旧列 说明/项目级/项目负责/实施进度/里程完成/测试员 是界面实际读写的一侧,保留兼容)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_progress_detail';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'项目进度查询行表(产品开发二三四级项目控制列表 18 列;详见表结构)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_progress_detail';
PRINT N'  表注明已更新';
GO

-- ═══ 5. 自检 ═══
PRINT N'--- 5. 自检 ---';
SELECT N'项目发起人' AS col_name, CASE WHEN COL_LENGTH('rd_progress_detail', N'项目发起人') IS NULL THEN N'已不存在(OK)' ELSE N'仍存在(FAIL)' END AS state
UNION ALL SELECT N'项目负责人',   CASE WHEN COL_LENGTH('rd_progress_detail', N'项目负责人')   IS NULL THEN N'已不存在(OK)' ELSE N'仍存在(FAIL)' END
UNION ALL SELECT N'立项日期',     CASE WHEN COL_LENGTH('rd_progress_detail', N'立项日期')     IS NULL THEN N'已不存在(OK)' ELSE N'仍存在(FAIL)' END
UNION ALL SELECT N'预计完成日期', CASE WHEN COL_LENGTH('rd_progress_detail', N'预计完成日期') IS NULL THEN N'已不存在(OK)' ELSE N'仍存在(FAIL)' END
UNION ALL SELECT N'测试情况',     CASE WHEN COL_LENGTH('rd_progress_detail', N'测试情况')     IS NULL THEN N'已不存在(OK)' ELSE N'仍存在(FAIL)' END;
PRINT N'  ↑ 5 行应全部为「已不存在(OK)」';
GO
SELECT COUNT(*) AS yj_field_残留行数_应为0
FROM yj_field
WHERE panel_code = 'RD_PROGRESS'
  AND col_name IN (N'项目发起人', N'项目负责人', N'立项日期', N'预计完成日期', N'测试情况');
GO
SELECT place, COUNT(*) AS cnt
FROM yj_field
WHERE panel_code = 'RD_PROGRESS'
  AND col_name IN (N'项目发起人', N'项目负责人', N'立项日期', N'预计完成日期', N'测试情况')
GROUP BY place;
PRINT N'  ↑ 无结果集(即 detail/header 均 0 行)为通过';
GO
SELECT CAST(value AS nvarchar(4000)) AS 表注明现值
FROM sys.extended_properties
WHERE class = 1 AND major_id = OBJECT_ID('rd_progress_detail') AND minor_id = 0 AND name = 'MS_Description';
GO
SELECT COUNT(*) AS detail字段数_删前27应变为22
FROM yj_field WHERE panel_code = 'RD_PROGRESS' AND place = N'detail';
GO
PRINT N'migrate-rd-progress-drop-orphan-cols.sql 完成';
GO
