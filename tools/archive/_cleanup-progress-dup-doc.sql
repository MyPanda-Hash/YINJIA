-- _cleanup-progress-dup-doc.sql
-- 【测试库 HSDZ_MES_TEST 专用】把项目中多余的进度单据 LXJ2609040100 软取消,只留 LXJ-2026-09-0006。
--
-- 用户口径(2026-10-09):「数据少的那一张」保留 ⇒ 留 LXJ-2026-09-0006(明细 1 行),
--   清 LXJ2609040100(明细 51 行)。
-- 为什么用**软取消**而不是 DELETE:
--   ① 可回退 —— 把 asp_cancel/canceled 改回 'N' 就恢复(物理删除不可逆);
--   ② 不用建备份表 —— 库内备份表会被数据库体检第 10 项判 FAIL(棘轮基线 0);
--   ③ 同步链本身就认这个标记 —— syncPlanToProgress 选写入目标的 SQL 是
--      `SELECT TOP 1 单据编号 FROM rd_progress WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 单据编号 DESC`,
--      取消后它不再被选中,剩下的 LXJ-2026-09-0006 成为唯一目标 ⇒ 之后自动同步都写进它。
--
-- ⚠ 只打测试库。正式库 HSDZ_MES 里 RD_PROGRESS 只有 LXJ-2026-09-0006 一张,无需处理。
-- 用法:cd C:\INCER\YINJIA-MES\tools
--   $env:YINJIA_SQL_DB='HSDZ_MES_TEST'
--   java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run ..\tools\archive\_cleanup-progress-dup-doc.sql
SET NOCOUNT ON;
GO
USE HSDZ_MES_TEST;
GO

DECLARE @dup nvarchar(60) = N'LXJ2609040100';
DECLARE @keep nvarchar(60) = N'LXJ-2026-09-0006';
DECLARE @n int;

-- ① 网关:目标单必须存在且仍活着,明细行数必须 = 51(与只读探针实测一致);否则中止,一条不改
SELECT @n = COUNT(*) FROM rd_progress WHERE 单据编号 = @dup AND ISNULL(asp_cancel, N'N') <> N'Y';
IF @n <> 1
BEGIN
  RAISERROR(N'ABORT 待清单据不存在或已取消,count=%d,未改动', 16, 1, @n);
  SET NOEXEC ON;
END

IF @n = 1
BEGIN
  DECLARE @d int = (SELECT COUNT(*) FROM rd_progress_detail WHERE 单据编号 = @dup);
  IF @d <> 51
  BEGIN
    RAISERROR(N'ABORT 待清单据明细行数=%d,期望 51,未改动', 16, 1, @d);
    SET NOEXEC ON;
  END
  ELSE
  BEGIN
    -- ② 保留单必须健在(否则取消完就一张都不剩了)
    DECLARE @k int = (SELECT COUNT(*) FROM rd_progress WHERE 单据编号 = @keep AND ISNULL(asp_cancel, N'N') <> N'Y');
    IF @k <> 1
      RAISERROR(N'ABORT 保留单 %s 不存在或已取消,未改动', 16, 1, @keep);
    ELSE
    BEGIN
      -- ③ 软取消(head + 状态表;明细不动 —— 头取消了就取不到)
      UPDATE rd_progress SET asp_cancel = N'Y' WHERE 单据编号 = @dup;
      UPDATE yj_doc_status SET canceled = N'Y' WHERE panel_code = N'RD_PROGRESS' AND doc_no = @dup;
      RAISERROR(N'OK 已软取消 %s(head + yj_doc_status),保留 %s', 16, 1, @dup, @keep);
    END
  END
END
GO

-- ④ 残留检查:同步目标的实际取值(取消后应只剩保留单)
DECLARE @m nvarchar(400);
SELECT TOP 1 @m = N'自检: 同步将写入 ' + ISNULL(单据编号, N'?')
  FROM rd_progress WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY 单据编号 DESC;
RAISERROR(N'%s (期望 LXJ-2026-09-0006)', 16, 1, ISNULL(@m, N'自检: 已没有任何可用进度单据!'));
GO
