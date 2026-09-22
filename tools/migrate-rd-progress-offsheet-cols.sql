-- migrate-rd-progress-offsheet-cols.sql — RD_PROGRESS 控制列表定为 14 列,4 列列标 hidden(2026-09-22)
--
-- 背景(用户口径):用户拿设计截图确认控制列表就是 **14 列**;`migrate-rd-progress-18cols.sql`
--   当初按设计文件表头行的 18 格建了 18 列,其中 4 格不上纸面:
--     · 开发复杂度 / 重要程度 / 紧急程度 —— 设计里每行都填着占位符 `n n n`,从无真实数据
--       (三列物理列由 18cols 迁移新增,无旧列对应)
--     · 项目定及变更 —— 18cols 迁移为承接「设计 O 列(状态)的手填说明」而建;
--       用户确认不上控制列表
--
-- 本脚本**只改元数据,不动任何物理列、不删任何数据**:
--   把 4 行的 yj_field.hidden 置 1(保留 visible=1,与"旧列退隐"同款处理),
--   并同步表注明 —— 于是"加面板/字段只改元数据"的口径与纸面一致;
--   前端纸面列由 progressColumns.js 的 PROGRESS_COLUMNS(14 项)决定,数据键与保存链不受影响
--   (QueryService.selectCols 不过滤 hidden,行模型里这 4 个键照旧存在 ⇒ 不会丢值)。
--
-- 幂等:UPDATE 直写同值,可重复执行。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
GO

-- §1 4 列标 hidden=1(保留 visible=1,表单/纸面都不出;数据与物理列原样保留)
UPDATE yj_field SET hidden = 1
 WHERE panel_code = N'RD_PROGRESS' AND place = N'detail'
   AND col_name IN (N'开发复杂度', N'重要程度', N'紧急程度', N'项目定及变更');
GO

-- §2 表注明:写清 14 列纸面 + 4 列不上纸面但保留
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('rd_progress_detail') AND name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'项目进度查询行表(产品开发二三四级项目控制列表;纸面 14 列:项目定级=col 项目层级/项目名称/子项目/尺寸/项目编号/内容/项目发起人=col 项目级/项目负责人=col 项目负责/立项日期=col 实施进度/预计完成日期=col 里程完成/状态(按实施计划阶段派生,只读)/测试情况=col 测试员/技术目标达成/是否市场转化/未转换原因。另 4 列 开发复杂度/重要程度/紧急程度/项目定及变更 保留物理列与数据但不上纸面(hidden=1,2026-09-22 用户口径);[说明] 是 RD_PLAN→RD_PROGRESS 同步的匹配键,与 [项目编号] 同值)',
    N'schema', N'dbo', N'table', N'rd_progress_detail';
GO

-- §3 自检:4 列 hidden=1 且 visible=1;物理列与数据仍在;纸面 14 列的数据键都在
SELECT N'①不上纸面 4 列已标 hidden=1 且 visible=1(应 4)' AS k, COUNT(*) AS n
  FROM yj_field WHERE panel_code = N'RD_PROGRESS' AND place = N'detail'
   AND col_name IN (N'开发复杂度', N'重要程度', N'紧急程度', N'项目定及变更')
   AND hidden = 1 AND visible = 1;
SELECT N'②物理列仍在(应 4)' AS k, COUNT(*) AS n
  FROM sys.columns WHERE object_id = OBJECT_ID('rd_progress_detail')
   AND name IN (N'开发复杂度', N'重要程度', N'紧急程度', N'项目定及变更');
-- 纸面 14 列的数据键(与 progressColumns.js 的 PROGRESS_COLUMNS 逐项对应):
--   其中 5 个键是"退隐"的旧列(项目级/项目负责/实施进度/里程完成/测试员,hidden=1)——
--   控制列表仍读它们(QueryService.selectCols 不过滤 hidden),故 hidden=0 的只有 9 个,这是预期
SELECT N'③纸面 14 列的数据键都有字段行(应 14)' AS k, COUNT(*) AS n
  FROM yj_field WHERE panel_code = N'RD_PROGRESS' AND place = N'detail'
   AND col_name IN (N'项目层级', N'项目名称', N'子项目/尺寸', N'项目编号', N'内容', N'项目级',
                    N'项目负责', N'实施进度', N'里程完成', N'状态', N'测试员',
                    N'技术目标达成', N'是否市场转化', N'未转换原因');
SELECT N'④其中 hidden=0(应 9:另 5 个是退隐旧列)' AS k, COUNT(*) AS n
  FROM yj_field WHERE panel_code = N'RD_PROGRESS' AND place = N'detail' AND hidden = 0;
GO
