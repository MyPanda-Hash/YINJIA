/* ============================================================================
 * 送料批次台账**独立面板回退**(BATCH_LEDGER 下线)
 * ----------------------------------------------------------------------------
 * 背景(用户口径 2026-09-21):「再回退 —— 方案 A 更轻:连页签都不加,只在表头字段区
 *   「采购订单号」旁边加一小行只读摘要,点开浮层看批次窄表」。
 *   故 2026-09-21 上午落地的独立台账面板(上一版方案 A)整体下线,
 *   台账信息改由**采购订单单据表头的一行只读摘要 + 点击浮层窄表**承载。
 *
 * 本脚本做三件事(幂等,可重复执行;全新库上为无操作):
 *   ① DROP VIEW v_batch_ledger(若存在)
 *   ② 删 BATCH_LEDGER 的 yj_field 字段行
 *   ③ 删 BATCH_LEDGER 的 yj_panel 面板行 + 该面板名/菜单分组译名(仅当无面板再无引用)
 *   **不动**通用字段词条(订单数量/本批送料数量/去向单据… 属全局共享词条,可能被其它面板引用)
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('dbo.v_batch_ledger', 'V') IS NOT NULL
BEGIN
    DROP VIEW dbo.v_batch_ledger;
    PRINT N'已删除视图 v_batch_ledger';
END

DELETE FROM yj_field WHERE panel_code = 'BATCH_LEDGER';
PRINT N'已删除 yj_field: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

DELETE FROM yj_panel WHERE panel_code = 'BATCH_LEDGER';
PRINT N'已删除 yj_panel: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- 面板域译名:仅当全库已无同名面板引用时删除(避免误伤将来同名物料/菜单词条)
DELETE t FROM yj_translation t
 WHERE t.scope = 'panel' AND t.ref_key IN (N'送料批次台账', N'台账')
   AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = t.ref_key);
PRINT N'已删除 panel 域译名: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* 自检:面板/字段/视图三处均无残留 */
IF OBJECT_ID('dbo.v_batch_ledger', 'V') IS NOT NULL RAISERROR(N'视图 v_batch_ledger 仍存在', 16, 1);
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'BATCH_LEDGER') RAISERROR(N'yj_panel 仍有 BATCH_LEDGER', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'BATCH_LEDGER') RAISERROR(N'yj_field 仍有 BATCH_LEDGER 字段', 16, 1);
PRINT N'✅ 送料批次台账独立面板已下线(改由采购订单表头摘要 + 浮层承载)';
GO
