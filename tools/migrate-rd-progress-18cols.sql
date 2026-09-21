-- migrate-rd-progress-18cols.sql — 项目进度查询(RD_PROGRESS)18 列重构(Phase 2)
--
-- 设计源:二三级四级项目控制表2026.xlsx → sheet《产品开发项目（二三级）2026》
--   B5:S5 共 18 个表头格;B/C 纵向合并表示 项目定级 是行组键。
-- 会话:2026-09-18。差异分析 docs/design/研发管理-面板与设计对照.md §2.3
--                  实施设计 docs/design/研发管理-新面板设计与改动方案.md §5
--
-- 【背景:现在是错的,不是"缺列"】现有 progressColumns.js 里 3 列标 pendingAlign(只显示不落库),
--   另 6 列把**显示名映射到语义无关的物理列**:立项日期↔实施进度、测试情况↔测试员、
--   项目编号↔说明、预计完成日期↔里程完成、项目负责人↔项目负责、项目发起人↔项目级。
--   本脚本补齐物理列并搬迁,消掉全部错位。
--
-- 【关键约束】后端 ButtonService.syncPlanToProgress 以 `ISNULL([说明],N'')=?` 匹配行 + 写
--   [项目层级]/[项目负责]/[里程完成]。故:
--   · 旧列 [说明] 的值**不搬迁、不清空** —— 它仍是同步链的匹配键(新列 项目编号 与之并存)
--   · 本脚本只**新增**列并只写新列,不 UPDATE 任何旧列 ⇒ 可安全回滚
--   · 后端改造(写新列)由 ButtonService 同步提交,脚本生效后即对齐
--
-- 幂等:COL_LENGTH / NOT EXISTS / 条件 UPDATE,可重复执行。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ 0. 备份(可重复执行:已存在则跳过,保留首次基线) ═══
IF OBJECT_ID('rd_progress_detail_bak_20260918') IS NULL
BEGIN
  SELECT * INTO rd_progress_detail_bak_20260918 FROM rd_progress_detail;
  PRINT N'  已建基线备份 rd_progress_detail_bak_20260918';
END
GO

-- ═══ 1. 新增 13 个物理列(设计列名)═══
BEGIN TRY
IF COL_LENGTH('rd_progress_detail', '项目编号')     IS NULL ALTER TABLE rd_progress_detail ADD [项目编号]     nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '开发复杂度')   IS NULL ALTER TABLE rd_progress_detail ADD [开发复杂度]   nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '重要程度')     IS NULL ALTER TABLE rd_progress_detail ADD [重要程度]     nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '紧急程度')     IS NULL ALTER TABLE rd_progress_detail ADD [紧急程度]     nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '项目发起人')   IS NULL ALTER TABLE rd_progress_detail ADD [项目发起人]   nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '项目负责人')   IS NULL ALTER TABLE rd_progress_detail ADD [项目负责人]   nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '立项日期')     IS NULL ALTER TABLE rd_progress_detail ADD [立项日期]     nvarchar(30)  NULL;
IF COL_LENGTH('rd_progress_detail', '预计完成日期') IS NULL ALTER TABLE rd_progress_detail ADD [预计完成日期] nvarchar(30)  NULL;
IF COL_LENGTH('rd_progress_detail', '项目定及变更') IS NULL ALTER TABLE rd_progress_detail ADD [项目定及变更] nvarchar(500) NULL;
IF COL_LENGTH('rd_progress_detail', '测试情况')     IS NULL ALTER TABLE rd_progress_detail ADD [测试情况]     nvarchar(200) NULL;
IF COL_LENGTH('rd_progress_detail', '技术目标达成') IS NULL ALTER TABLE rd_progress_detail ADD [技术目标达成] nvarchar(50)  NULL;
IF COL_LENGTH('rd_progress_detail', '是否市场转化') IS NULL ALTER TABLE rd_progress_detail ADD [是否市场转化] nvarchar(10)  NULL;
IF COL_LENGTH('rd_progress_detail', '未转换原因')   IS NULL ALTER TABLE rd_progress_detail ADD [未转换原因]   nvarchar(200) NULL;
END TRY BEGIN CATCH PRINT N'RD_PROGRESS 明细加列跳过(无 DDL 权限?)'; END CATCH;
GO

-- ═══ 2. yj_field 登记(seq 用高位段,避开既有 5~120 与 310~500)═══
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PROGRESS', v.col, v.col, N'文本', N'detail', v.seq, v.w, 1, 0, 0, 1
FROM (VALUES
  (N'项目编号',     200,  90),
  (N'开发复杂度',   210,  90),
  (N'重要程度',     220,  90),
  (N'紧急程度',     230,  90),
  (N'项目发起人',   240, 100),
  (N'项目负责人',   250, 100),
  (N'立项日期',     260, 100),
  (N'预计完成日期', 270, 110),
  (N'项目定及变更', 280, 220),
  (N'测试情况',     290, 200),
  (N'技术目标达成', 600, 100),
  (N'是否市场转化', 610, 100),
  (N'未转换原因',   620, 160)
) AS v(col, seq, w)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = 'RD_PROGRESS' AND f.col_name = v.col AND f.place = N'detail');
GO

-- ═══ 3. 项目定级口径统一(设计:二级/三级/四级;原 [项目层级] label=(一/二级))═══
--     只改 label + 字典,col_name 保持 [项目层级](数据键不改)
UPDATE yj_field SET label = N'项目定级', data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''二级''),(N''三级''),(N''四级'')) AS t(v)'
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail' AND col_name = N'项目层级';
GO

-- ═══ 4. 两个布尔型列改下拉(由 pendingAlign 转为真落库)═══
UPDATE yj_field SET data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''已达成''),(N''未达成''),(N''进行中'')) AS t(v)'
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail' AND col_name = N'技术目标达成';
UPDATE yj_field SET data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)'
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail' AND col_name = N'是否市场转化';
GO

-- ═══ 5. 数据搬迁(旧列错位值 → 新列)═══
--     幂等靠"新列 IS NULL";**不动旧列**([说明] 仍是同步键,旧值留作核对)
UPDATE rd_progress_detail SET [项目编号] = [说明]
 WHERE [项目编号] IS NULL AND ISNULL([说明], N'') <> N'';
UPDATE rd_progress_detail SET [预计完成日期] = LEFT([里程完成], 30)
 WHERE [预计完成日期] IS NULL AND ISNULL([里程完成], N'') <> N'';
UPDATE rd_progress_detail SET [项目负责人] = [项目负责]
 WHERE [项目负责人] IS NULL AND ISNULL([项目负责], N'') <> N'';
GO
-- ⚠ [实施进度] 一列存了两样东西,必须**拆分**:
--    同步写入的"实施进度 n/m"是派生状态文本 → 归 [项目定及变更](手填原意)
--    手填的立项日期形如 2026.1 / 2026-01-15 / 2025.12.20 → 归 [立项日期]
--   判据:是否以 4 位年份开头
UPDATE rd_progress_detail SET [项目定及变更] = [实施进度]
 WHERE [项目定及变更] IS NULL AND ISNULL([实施进度], N'') <> N''
   AND [实施进度] NOT LIKE N'[12][0-9][0-9][0-9]%';
UPDATE rd_progress_detail SET [立项日期] = LEFT([实施进度], 30)
 WHERE [立项日期] IS NULL AND ISNULL([实施进度], N'') <> N''
   AND [实施进度] LIKE N'[12][0-9][0-9][0-9]%';
GO

-- ═══ 6. 文档编号显示在标题右侧(设计要求;原来 hidden=1 只在表单可见)═══
UPDATE yj_field SET hidden = 0
WHERE panel_code = 'RD_PROGRESS' AND col_name = N'文档编号';
GO

-- ═══ 7. 派生列保持只读(状态 = 按项目名称关联最新实施计划算出的快照,不手填)═══
UPDATE yj_field SET editable = 0
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail' AND col_name = N'状态';
GO

-- ═══ 8. 旧列退隐(不进控制列表;**保留 visible=1** 以便表单/历史复核)═══
--     注意:[说明] 是同步链匹配键,退隐只影响列表显示,后端照常读写
UPDATE yj_field SET hidden = 1, visible = 1
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail'
  AND col_name IN (N'说明', N'项目级', N'项目负责', N'实施进度', N'里程完成', N'测试员');
-- 纯内部列(本来就与业务无关):列表与表单都不出
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'RD_PROGRESS' AND place = N'detail'
  AND col_name IN (N'谁来批准', N'谁来检验', N'未批准原因');
GO

-- ═══ 9. 表注明更新(2026-09-18 重构后原注明已误导:它列的是已退隐的旧列)═══
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('rd_progress_detail') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'项目进度查询行表(产品开发二三四级项目控制列表 18 列:项目定级=col 项目层级/项目编号/开发复杂度/重要程度/紧急程度/项目发起人=col 项目级/项目负责人=col 项目负责/立项日期=col 实施进度/预计完成日期=col 里程完成/项目定及变更/状态派生/测试情况=col 测试员/技术目标达成/是否市场转化/未转换原因;旧列 说明/项目负责/里程完成 保留兼容)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_progress_detail';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'项目进度查询行表(产品开发二三四级项目控制列表 18 列;详见表结构)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_progress_detail';
GO

-- ═══ 10. 核对 ═══
PRINT N'--- RD_PROGRESS 明细列最终状态 ---';
SELECT place, seq, col_name, label, data_type, editable, hidden, visible
FROM yj_field WHERE panel_code = 'RD_PROGRESS' AND place = N'detail'
ORDER BY seq;
GO

PRINT N'migrate-rd-progress-18cols.sql 完成';
GO
