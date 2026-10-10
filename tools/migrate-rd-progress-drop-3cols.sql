-- migrate-rd-progress-drop-3cols.sql
-- 项目进度查询(RD_PROGRESS)从面板上撤下 3 列:技术目标达成 / 是否市场转化 / 未转换原因
-- 幂等;两个账套都要执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)
--
-- 用户口径(2026-10-09):「从面板上删掉这三列」。
-- 处置 = **只改元数据 hidden=1(不上纸面)**,不注销 yj_field 行、不删物理列、不动数据 ——
--   项目铁律「col_name 永不改,改则历史单据数据键全丢」;先例是 2026-09-22 那 4 列
--   (开发复杂度/重要程度/紧急程度/项目定及变更,migrate-rd-progress-offsheet-cols.sql 同样只置 hidden=1)。
--   前端纸面列由 frontend/src/core/progress/progressColumns.js 的 PROGRESS_COLUMNS 决定(第 3 步删),
--   但那一步只影响显示;这里先把元数据对齐,免得其它读取路径(导出/参照/查询列)还把这三列当可见列。
SET NOCOUNT ON;
GO

-- ① 闸门:先数这三列现在有多少行(期望 3:一列一行,place 不限)——计数不符即中止,一条不改
DECLARE @before int = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code = N'RD_PROGRESS'
                          AND label IN (N'技术目标达成', N'是否市场转化', N'未转换原因'));
IF @before <> 3
BEGIN
  RAISERROR(N'ABORT 目标列命中 %d 行,期望 3,未改动', 16, 1, @before);
  SET NOEXEC ON;
END
GO

DECLARE @n int;
UPDATE yj_field SET hidden = 1
 WHERE panel_code = N'RD_PROGRESS'
   AND label IN (N'技术目标达成', N'是否市场转化', N'未转换原因')
   AND ISNULL(hidden, 0) <> 1;
SET @n = @@ROWCOUNT;
RAISERROR(N'OK 置 hidden=1 影响 %d 行(0 = 本来就已经撤下)', 16, 1, @n);
GO

-- ② 自检:这三列必须全部 hidden=1,且物理列仍在(没被误删)
DECLARE @h int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'RD_PROGRESS'
                     AND label IN (N'技术目标达成', N'是否市场转化', N'未转换原因')
                     AND ISNULL(hidden, 0) = 1);
DECLARE @t int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'RD_PROGRESS'
                     AND label IN (N'技术目标达成', N'是否市场转化', N'未转换原因'));
IF @h = 3 AND @t = 3
  RAISERROR(N'SELFCHECK OK 三列全部 hidden=1(3/3),yj_field 行保留', 16, 1);
ELSE
  RAISERROR(N'SELFCHECK FAIL hidden=%d/3 命中=%d/3', 16, 1, @h, @t);
GO
