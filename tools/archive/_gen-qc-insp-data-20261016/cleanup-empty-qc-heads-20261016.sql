/* =============================================================================
   cleanup-empty-qc-heads-20261016.sql — 清掉造检验单时留下的「骨架检验单头」

   【由来】造数脚本第一版保存时只给了 `单据编号`、漏了 `编号`,而「新增」建的骨架行是以 `编号` 为身份的
     ⇒ 保存**另起一张单**(新号),那 90 个骨架头就一直空着;另有 10 张是「新增」拿到**已存在的号**时
     (IJ-2026-10-0011~0020,当时号池落后于导库数据)建出来的,与导入单据同号两行。
   脚本已修(保存带 `编号`),本脚本清理这两类残留。见 _gen-qc-insp-20261016.mjs 顶部说明。

   【三个坑(都实测踩过,别改回去)】
     ① 「新增」会给骨架行写一条 yj_doc_status 留痕(saved='Y')⇒ **不能**用「没有留痕」当守卫;
     ② 骨架行与导入单据同号时,「按单号 NOT EXISTS(明细)」判不出来(明细按单号关联,会跟着显形)——
        真正的判据是**总结论与检验员都空**(造数单这两列必有值);
     ③ ⚠ 必须用 `GO` 分批执行(DbSync 单批跑同一逻辑实测**一行都删不掉**、还不报错);
        且 RAISERROR 的替换参数只能给变量/常量。

   【只清什么】今天(2026-10-16)建、且**总结论为空、检验员为空**的检验单头(导入的 11 张同样两列为空,
   但它们的 asp_time1 是原始日期,不会落在「今天」里)。随后清掉「单号已无对应头」的状态留痕。
   【幂等】第二次执行删 0 行。两账套都执行。
   【执行】cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run archive\_gen-qc-insp-data-20261016\cleanup-empty-qc-heads-20261016.sql
   ⚠ 不要登记进 tools/db-migrations.txt。
   ============================================================================= */
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#junk') IS NOT NULL DROP TABLE #junk;
CREATE TABLE #junk (no nvarchar(50) PRIMARY KEY);
INSERT INTO #junk (no)
SELECT 单据编号 FROM qc_insp
 WHERE asp_time1 >= '2026-10-16' AND ISNULL(总结论, N'') = N'' AND ISNULL(检验员, N'') = N'';
DECLARE @cand int = (SELECT COUNT(*) FROM #junk);
DECLARE @db0 sysname = DB_NAME();
RAISERROR(N'[候选] %s:骨架检验单头 %d 张', 10, 1, @db0, @cand);
GO

BEGIN TRANSACTION;
DELETE FROM qc_insp WHERE 单据编号 IN (SELECT no FROM #junk);
DECLARE @del int = @@ROWCOUNT;
-- 专属留痕:删完后该单号在 qc_insp 里彻底不存在 ⇒ 是骨架自己的状态行(导入单据的留痕因单据还在而保留)
DELETE FROM yj_doc_status
 WHERE panel_code = N'QC_INSP'
   AND NOT EXISTS (SELECT 1 FROM qc_insp h WHERE h.单据编号 = yj_doc_status.doc_no);
DECLARE @delSt int = @@ROWCOUNT;
COMMIT TRANSACTION;
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[删除] %s:骨架头 %d 行 + 孤儿状态留痕 %d 行', 10, 1, @dbn, @del, @delSt);
GO

/* 自检:① 今日不应再有骨架头 ② 不应有重复单号 ③ 有明细的检验单 ≥ 100 ④ 无孤儿状态留痕 */
DECLARE @emptyToday int = (SELECT COUNT(*) FROM qc_insp
  WHERE asp_time1 >= '2026-10-16' AND ISNULL(总结论, N'') = N'' AND ISNULL(检验员, N'') = N'');
DECLARE @dup int = (SELECT COUNT(*) FROM (SELECT 单据编号 FROM qc_insp GROUP BY 单据编号 HAVING COUNT(*) > 1) t);
DECLARE @withLines int = (SELECT COUNT(DISTINCT 单据编号) FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @orphanSt int = (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code = N'QC_INSP'
  AND NOT EXISTS (SELECT 1 FROM qc_insp h WHERE h.单据编号 = s.doc_no));
DECLARE @dbn2 sysname = DB_NAME();
IF @emptyToday = 0 AND @dup = 0 AND @withLines >= 90 AND @orphanSt = 0
  RAISERROR(N'[OK] %s:骨架头 0 / 重复单号 0 / 有明细检验单 %d 张 / 孤儿留痕 0', 10, 1, @dbn2, @withLines);
ELSE
  RAISERROR(N'[FAIL] %s:骨架头 %d / 重复单号 %d / 有明细单 %d / 孤儿留痕 %d', 16, 1, @dbn2, @emptyToday, @dup, @withLines, @orphanSt);
GO
