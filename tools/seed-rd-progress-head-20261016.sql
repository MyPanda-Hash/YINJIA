/* =============================================================================
   seed-rd-progress-head-20261016.sql — 只补「项目进度查询」那张单单据的头(**不带示例明细行**)

   【为什么需要】(2026-10-16 用户报障「服务器上填了立项申请表和项目实施计划,项目进度查询没有数据」)
     服务器实测:RD_PROGRESS 面板 **totalSize=0**(一张单都没有),而 RD_PLAN LXB-2026-10-0001、
     RD_APPROVAL LXA-2026-10-0001 都已归档。
     后端 `ButtonService.syncPlanToProgress(...)` 第一步是
       SELECT TOP 1 [单据编号] FROM rd_progress WHERE asp_cancel<>'Y' ORDER BY [单据编号] DESC
     取不到就 `return RES_SKIPPED` 并只打一行 WARN 日志 ⇒ **计划阶段数据一行都进不了进度表**,
     界面表现就是「项目进度查询:暂无数据」。
     （RD_PROGRESS 是"单单据面板":全库共用一张单,所有项目行都挂在它下面 ⇒ 没有头就没有任何行。）

   【与 seed-rd-progress.sql 的区别】那个脚本是"先删后插",连 8 行**示例明细**一起灌;
     本脚本**只建那张头**,不碰明细,幂等(已存在则跳过)。
   【执行后还要做一步】打开 项目进度查询 → 纸面上点「⟳ 同步阶段进度」;
     或回 项目实施计划 点一次「阶段完成」/ 重新归档一次 —— 两条路都会触发 RD_PLAN→RD_PROGRESS 导入。
   【两账套】都执行(先 HSDZ_MES 后 HSDZ_MES_TEST)。
   ============================================================================= */
SET NOCOUNT ON;

DECLARE @no nvarchar(50) = N'LXJ2609040100';   -- 与 seed-rd-progress.sql 同号,便于与历史数据对上
IF NOT EXISTS (SELECT 1 FROM rd_progress WHERE 单据编号 = @no)
BEGIN
  INSERT INTO rd_progress (单据编号, 单据日期, 密级, 文件使用范围, 文档编号, 备注, asp_user1, asp_time1)
  VALUES (@no, N'2026-09-04', N'保密', N'工程技术中心', N'YJ-XS002', N'项目进度查询单单据(全库共用)', N'migration', SYSDATETIME());
  PRINT N'[建头] rd_progress 已建 ' + @no;
END
ELSE PRINT N'[跳过] rd_progress 已存在 ' + @no;
GO

/* 自检:进度单头必须 ≥1 张(否则同步仍会 SKIPPED) */
DECLARE @n int = (SELECT COUNT(*) FROM rd_progress WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @dbn sysname = DB_NAME();
IF @n >= 1 RAISERROR(N'[OK] %s:项目进度查询单头 %d 张(可接收 RD_PLAN 导入)', 10, 1, @dbn, @n);
ELSE RAISERROR(N'[FAIL] %s:仍无进度单头,同步会被跳过', 16, 1, @dbn);
GO
