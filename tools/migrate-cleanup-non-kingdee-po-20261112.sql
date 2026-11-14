/* ============================================================================
 * migrate-cleanup-non-kingdee-po-20261112.sql
 * 清理 3 张「不是从金蝶来的」采购订单(用户口径 2026-11-12:「不是从金蝶来的删除掉」)
 * ----------------------------------------------------------------------------
 * 目标单据(全部 外部数据ID 为空、数据来源为空 ⇒ MES 本地/演示遗留,不是金蝶同步来的):
 *   PO-2026-08-0001(2 行明细,演示供应商「华东铝业」)
 *   PO-2026-08-0002(1 行明细,演示供应商「北方机械」)
 *   PO-2026-10-0001(0 行明细;2026-10-28 已在界面删过,只剩表头与一条已作废状态)
 * 金蝶同步的采购订单单号形如 YJ-YYYYMMDD-NN,且必带 外部数据ID/外部指纹;这三张都没有 ⇒ 判据成立。
 *
 * 删除范围(逐张,按单号硬删):
 *   bd_pu_order(头) / bl_pu_order(行) / yj_doc_status(状态) / yj_doc_annotation(批注)
 *   / yj_doc_modify_log(修改留痕) / yj_doc_batch(分批送料预约)
 *   —— yj_usage_log(使用记录)是审计留痕,**保留不动**。
 *
 * 三道守卫(任一不满足即整体不删):
 *   ① 命中的头必须都 `ISNULL(外部数据ID,'')=''`(确实是本地单,不会误删金蝶单);
 *   ② 不得被下游引用:送料暂收 `sl_recv.采购订单号` / 来料检验 `qc_insp.采购订单号`
 *      / 暂收退回 `qc_return.采购订单号` / 采购入库 `bd_purchase_in.采购订单号` / `form_flow_link`;
 *   ③ 命中头数 ≤ 3(单号写死在脚本里,数量对不上就是环境不对)。
 *
 * 幂等:全部 DELETE 都按单号,重跑删 0 行;守卫在"单据不存在"时自然跳过。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST(先正式后测试)。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-cleanup-non-kingdee-po-20261112 ==';

DECLARE @no TABLE (n nvarchar(50) PRIMARY KEY);
INSERT INTO @no (n) VALUES (N'PO-2026-08-0001'), (N'PO-2026-08-0002'), (N'PO-2026-10-0001');

/* ── 先看库里到底有没有这三张单:一张都没有就整段跳过(测试库/已清理过的库) ──
 * 为什么必须放在守卫②之前:测试库里 `SL-2026-10-0121`(演示单)的「采购订单号」挂着 PO-2026-10-0001,
 * 但那张采购订单**本来就不存在**(悬空引用)。这种库上没有要删的东西,不该被一条历史悬空引用挡住。 */
DECLARE @heads int = (SELECT COUNT(*) FROM bd_pu_order WHERE 单据编号 IN (SELECT n FROM @no));
DECLARE @lines int = (SELECT COUNT(*) FROM bl_pu_order WHERE 单据编号 IN (SELECT n FROM @no));
IF @heads = 0
BEGIN
  PRINT N'[跳过] 本库没有这三张采购订单(头 0 张);仅作提示:明细残留 ' + CAST(@lines AS nvarchar(10)) + N' 行';
  IF @lines > 0 DELETE FROM bl_pu_order WHERE 单据编号 IN (SELECT n FROM @no);
  PRINT N'[跳过] 本库无需清理,脚本结束';
END
ELSE
BEGIN
    /* ── 守卫 ①:命中的必须都是本地单(外部数据ID 为空) ── */
    DECLARE @foreign int = (SELECT COUNT(*) FROM bd_pu_order
                             WHERE 单据编号 IN (SELECT n FROM @no) AND ISNULL(外部数据ID, N'') <> N'');
    IF @foreign > 0
      RAISERROR(N'[中止] 命中单里有 %d 张带外部数据ID(金蝶同步来的),拒绝删除', 16, 1, @foreign);

    /* ── 守卫 ②:不得被下游单据引用(只有真要删时才检) ── */
    DECLARE @ref int = 0, @m nvarchar(200) = N'';
    SELECT @ref = COUNT(*), @m = N'sl_recv(送料暂收单).采购订单号'
      FROM sl_recv WHERE 采购订单号 IN (SELECT n FROM @no);
    IF @ref > 0 RAISERROR(N'[中止] 仍有下游单据引用: %s 共 %d 张', 16, 1, @m, @ref);
    SELECT @ref = COUNT(*), @m = N'qc_insp(来料检验单).采购订单号'
      FROM qc_insp WHERE 采购订单号 IN (SELECT n FROM @no);
    IF @ref > 0 RAISERROR(N'[中止] 仍有下游单据引用: %s 共 %d 张', 16, 1, @m, @ref);
    SELECT @ref = COUNT(*), @m = N'qc_return(暂收退回单).采购订单号'
      FROM qc_return WHERE 采购订单号 IN (SELECT n FROM @no);
    IF @ref > 0 RAISERROR(N'[中止] 仍有下游单据引用: %s 共 %d 张', 16, 1, @m, @ref);
    SELECT @ref = COUNT(*), @m = N'bd_purchase_in(采购入库单).采购订单号'
      FROM bd_purchase_in WHERE 采购订单号 IN (SELECT n FROM @no);
    IF @ref > 0 RAISERROR(N'[中止] 仍有下游单据引用: %s 共 %d 张', 16, 1, @m, @ref);
    SELECT @ref = COUNT(*), @m = N'form_flow_link(链路占用)'
      FROM form_flow_link WHERE source_form_no IN (SELECT n FROM @no) OR target_form_no IN (SELECT n FROM @no);
    IF @ref > 0 RAISERROR(N'[中止] 仍有下游单据引用: %s 共 %d 行', 16, 1, @m, @ref);

    /* ── 守卫 ③:命中头数对账 ── */
    IF @heads > 3 RAISERROR(N'[中止] 命中采购订单头 %d 张,超过预期 3 张', 16, 1, @heads);
    PRINT N'[前置] 命中采购订单头 ' + CAST(@heads AS nvarchar(10)) + N' 张; 明细 ' + CAST(@lines AS nvarchar(10)) + N' 行';

/* ── 逐表删除(先子后主) ── */
DELETE FROM yj_doc_annotation WHERE panel_code = N'PU_ORDER' AND doc_no IN (SELECT n FROM @no);
PRINT N'[删除] yj_doc_annotation = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

DELETE FROM yj_doc_modify_log WHERE panel_code = N'PU_ORDER' AND doc_no IN (SELECT n FROM @no);
PRINT N'[删除] yj_doc_modify_log = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

DELETE FROM yj_doc_batch WHERE source_panel_code = N'PU_ORDER' AND source_form_no IN (SELECT n FROM @no);
PRINT N'[删除] yj_doc_batch = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

DELETE FROM yj_doc_status WHERE panel_code = N'PU_ORDER' AND doc_no IN (SELECT n FROM @no);
PRINT N'[删除] yj_doc_status = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

DELETE FROM bl_pu_order WHERE 单据编号 IN (SELECT n FROM @no);
PRINT N'[删除] bl_pu_order = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

DELETE FROM bd_pu_order WHERE 单据编号 IN (SELECT n FROM @no) AND ISNULL(外部数据ID, N'') = N'';
PRINT N'[删除] bd_pu_order = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* ── 自检:三张单彻底消失,且剩余采购订单里不再有「非金蝶 + 非已审核」残留 ── */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM bd_pu_order WHERE 单据编号 IN (SELECT n FROM @no)) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM bl_pu_order WHERE 单据编号 IN (SELECT n FROM @no)) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code = N'PU_ORDER' AND doc_no IN (SELECT n FROM @no)) SET @bad = @bad + 1;

DECLARE @rest int = (SELECT COUNT(*) FROM bd_pu_order WHERE ISNULL(外部数据ID, N'') = N'');
IF @rest > 0
  PRINT N'[提示] 仍有 ' + CAST(@rest AS nvarchar(10)) + N' 张采购订单没有外部数据ID(非金蝶来源),请人工确认是否需要清理';
IF @bad > 0 RAISERROR(N'清理自检失败:目标单据仍有残留', 16, 1);
ELSE PRINT N'清理完成:3 张非金蝶采购订单(头/行/状态/留痕)已删除;金蝶同步单据一律未动';
END   /* ELSE BEGIN(@heads > 0) */
GO
