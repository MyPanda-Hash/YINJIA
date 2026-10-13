/* ============================================================
   _clean-report-approve-probe.sql — 清理「报工审批/完工结案」探针产物
   (⚠ 只允许在测试账套 HSDZ_MES_TEST 执行,脚本内有 DB_NAME() 守卫)

   背景:tools/archive/_verify-report-approve-and-close.mjs 与
        tools/archive/_verify-close-after-asm-insp.mjs 会在 fixture **MO-2026-09-0004** 上
        造报工单(BG-*)、并审核其自动生成的组装成品检验单(ZJ-*)与产成品入库单(FI-*)。
        界面「删除」只写 yj_doc_status.canceled,不写业务表 asp_cancel ⇒ 反复跑回归会留下存活单;
        而一旦留下**已审核**的入库单,下次报工会被「已结案,不能报工」正确拦下 ⇒ 探针误判。
   本脚本按 fixture 精确圈定把业务表软删补齐,并把该工单行**复原成未结案**(ja='N')。

   幂等可重跑;正式库禁止执行。
   ============================================================ */
SET NOCOUNT ON;
GO
DECLARE @db sysname = DB_NAME();
IF @db <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s),已中止', 16, 1, @db);
    RETURN;
END
GO
DECLARE @wo nvarchar(30) = N'MO-2026-09-0004';

-- ① 产成品入库单(含明细):软删 + 状态作废
UPDATE f SET f.asp_cancel='Y', f.asp_user2=N'probe-cleanup', f.asp_time2=GETDATE()
  FROM dbo.bd_finish_in f WHERE f.[加工单号]=@wo AND ISNULL(f.asp_cancel,'N')<>'Y';
UPDATE s SET s.canceled='Y', s.update_at=GETDATE() FROM dbo.yj_doc_status s
 WHERE s.panel_code='FINISH_IN'
   AND s.doc_no IN (SELECT [单据编号] FROM dbo.bd_finish_in WHERE [加工单号]=@wo);
PRINT N'产成品入库单已作废';

-- ② 工序检验单(成型/切炭/组装):软删 + 状态作废
UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'probe-cleanup', d.asp_time2=GETDATE()
  FROM dbo.qc_mold_insp_detail d WHERE d.单据编号 IN (SELECT [单据编号] FROM dbo.qc_mold_insp_head WHERE [工单号]=@wo) AND ISNULL(d.asp_cancel,'N')<>'Y';
UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'probe-cleanup', h.asp_time2=GETDATE()
  FROM dbo.qc_mold_insp_head h WHERE h.[工单号]=@wo AND ISNULL(h.asp_cancel,'N')<>'Y';
UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'probe-cleanup', d.asp_time2=GETDATE()
  FROM dbo.qc_cut_insp_detail d WHERE d.单据编号 IN (SELECT [单据编号] FROM dbo.qc_cut_insp_head WHERE [工单号]=@wo) AND ISNULL(d.asp_cancel,'N')<>'Y';
UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'probe-cleanup', h.asp_time2=GETDATE()
  FROM dbo.qc_cut_insp_head h WHERE h.[工单号]=@wo AND ISNULL(h.asp_cancel,'N')<>'Y';
UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'probe-cleanup', d.asp_time2=GETDATE()
  FROM dbo.qc_asm_insp_detail d WHERE d.单据编号 IN (SELECT [单据编号] FROM dbo.qc_asm_insp_head WHERE [工单号]=@wo) AND ISNULL(d.asp_cancel,'N')<>'Y';
UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'probe-cleanup', h.asp_time2=GETDATE()
  FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=@wo AND ISNULL(h.asp_cancel,'N')<>'Y';
UPDATE s SET s.canceled='Y', s.update_at=GETDATE() FROM dbo.yj_doc_status s
 WHERE s.panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP')
   AND s.doc_no IN (SELECT [单据编号] FROM dbo.qc_mold_insp_head WHERE [工单号]=@wo
                    UNION SELECT [单据编号] FROM dbo.qc_cut_insp_head WHERE [工单号]=@wo
                    UNION SELECT [单据编号] FROM dbo.qc_asm_insp_head WHERE [工单号]=@wo);
PRINT N'工序检验单已作废';

-- ③ 报工单(scjl 单表式):软删 + 状态作废
UPDATE dbo.scjl SET asp_cancel='Y', asp_user2=N'probe-cleanup', asp_time2=GETDATE(), wgzt=NULL, wgsj=NULL
 WHERE gldh=@wo AND ISNULL(asp_cancel,'N')<>'Y';
UPDATE s SET s.canceled='Y', s.update_at=GETDATE() FROM dbo.yj_doc_status s
 WHERE s.panel_code='WO_REPORT'
   AND s.doc_no IN (SELECT [报工单号] FROM dbo.scjl WHERE gldh=@wo);
PRINT N'报工单已作废';

-- ④ 复原该工单:清入库量 + 结案翻回 N(让下次探针能正常报工)
UPDATE dbo.plang SET rk_sl=0, rk_no=NULL, ja='N', 完工状态=N'未开工', 当前工序=NULL, 当前工序完工量=0,
       asp_user2=N'probe-cleanup', asp_time2=GETDATE()
 WHERE pl_no=@wo AND ISNULL(asp_cancel,'N')<>'Y';
PRINT N'工单行已复原(入库 0 / 未结案)';

SELECT DB_NAME() AS 库, (SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y') AS 存活报工;
GO
PRINT N'提示:如需恢复 plang 工序状态缓存,再跑一次 tools/migrate-plang-row-state-backfill-20261015.sql';
GO
