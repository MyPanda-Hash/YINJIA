/* ============================================================
   _clean-insp-wo-line-probe.sql — 清理工序检验单探针的产物
   (⚠ 只允许在 **测试账套 HSDZ_MES_TEST** 执行;脚本内有 DB_NAME() 守卫)

   背景:tools/archive/_verify-insp-wo-line.mjs 会在测试账套**保存并审核**一张报工单
   (fixture MO-2026-09-0004 / 成型),从而自动生成一张成型检验单。
   探针自带「删除/弃审」清理,但**「删除」按钮只写 yj_doc_status.canceled,不写业务表 asp_cancel**
   (已知口径),所以反复跑回归会在业务表里留下存活草稿 —— 本脚本按 fixture 精确圈定,
   把业务表软删补齐(幂等,可反复跑)。

   圈定范围(**只用 fixture 常量,不按通配扫全库**):
     · 报工单:scjl.gldh = MO-2026-09-0004 且 gxdm = 成型 且 asp_user2/创建来自探针
       —— 直接用「工单号 + 成型 + 未作废」圈定(该 fixture 的成型报工只可能是探针造的);
     · 检验单:qc_mold_insp_head.报工单号 ∈ 上述报工单号。

   跑完后请再执行一次 tools/migrate-plang-row-state-backfill-20261015.sql 重算 plang 行状态
   (报工作废后该行应回到 未开工)。
   ============================================================ */
SET NOCOUNT ON;
GO
-- ⚠ RAISERROR 的替换参数只接受变量/常量,**不能直接写函数**(DB_NAME() 实测报
--   「Incorrect syntax near 'DB_NAME'」)⇒ 先落变量
DECLARE @db sysname = DB_NAME();
IF @db <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s),已中止', 16, 1, @db);
    RETURN;
END
GO
IF DB_NAME() <> N'HSDZ_MES_TEST' RETURN;   -- 双保险(上面 RAISERROR 后语句仍会继续)
GO
DECLARE @wo nvarchar(30) = N'MO-2026-09-0004', @op nvarchar(30) = N'成型';
DECLARE @reps TABLE (no nvarchar(30) PRIMARY KEY);
INSERT INTO @reps (no)
SELECT [报工单号] FROM dbo.scjl
 WHERE gldh = @wo AND gxdm = @op AND ISNULL(asp_cancel,'N') <> 'Y' AND [报工单号] IS NOT NULL;
DECLARE @n int = (SELECT COUNT(*) FROM @reps);
IF @n = 0 BEGIN PRINT N'无待清理的探针报工单(已清理过)'; END
ELSE
BEGIN
    -- ⚠ PRINT 里不能直接嵌子查询(实测「Subqueries are not allowed in this context」)⇒ 先落变量
    DECLARE @list nvarchar(400) = (SELECT STRING_AGG(no, N',') FROM @reps);
    PRINT N'待清理探针报工单 ' + CAST(@n AS nvarchar(10)) + N' 张:' + ISNULL(@list, N'');
    -- ① 释放占用链
    UPDATE dbo.form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()
     WHERE (source_form_no IN (SELECT no FROM @reps)
            OR target_form_no IN (SELECT no FROM @reps)
            OR target_form_no IN (SELECT [单据编号] FROM dbo.qc_mold_insp_head WHERE [报工单号] IN (SELECT no FROM @reps)))
       AND link_status='ACTIVE';
    -- ② 作废探针生成的检验单(头 + 明细 + 单据状态)
    UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'probe-cleanup', d.asp_time2=GETDATE()
      FROM dbo.qc_mold_insp_detail d
     WHERE d.单据编号 IN (SELECT [单据编号] FROM dbo.qc_mold_insp_head WHERE [报工单号] IN (SELECT no FROM @reps))
       AND ISNULL(d.asp_cancel,'N') <> 'Y';
    UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'probe-cleanup', h.asp_time2=GETDATE()
      FROM dbo.qc_mold_insp_head h WHERE h.[报工单号] IN (SELECT no FROM @reps);
    UPDATE s SET s.canceled='Y', s.update_at=GETDATE() FROM dbo.yj_doc_status s
     WHERE s.panel_code='QC_MOLD_INSP'
       AND s.doc_no IN (SELECT [单据编号] FROM dbo.qc_mold_insp_head WHERE [报工单号] IN (SELECT no FROM @reps));
    -- ③ 作废探针报工单(业务表软删 + 单据状态)
    UPDATE dbo.scjl SET asp_cancel='Y', asp_user2=N'probe-cleanup', asp_time2=GETDATE(), wgzt=NULL, wgsj=NULL
     WHERE [报工单号] IN (SELECT no FROM @reps);
    UPDATE s SET s.canceled='Y', s.update_at=GETDATE() FROM dbo.yj_doc_status s
     WHERE s.panel_code='WO_REPORT' AND s.doc_no IN (SELECT no FROM @reps);
    PRINT N'✅ 已清理(占用链释放 + 检验单/报工单软删)';
END
GO
PRINT N'提示:再跑一次 tools/migrate-plang-row-state-backfill-20261015.sql 重算 plang 行状态';
GO
