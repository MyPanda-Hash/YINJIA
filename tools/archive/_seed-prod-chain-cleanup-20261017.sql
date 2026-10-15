/* _seed-prod-chain-cleanup-20261017.sql — 回滚「YJ-20261017 生产链造数」在**正式库**留下的全部痕迹。
 *
 * 为什么是硬删:这批行是我一次造数尝试的产物(用户随后改口径「不需要实现数据」),
 * 不是业务数据;软删(asp_cancel='Y')会让 SO 行的占用链仍然占着(剩余数量回不去),
 * 反而留下"转不了单"的假故障 ⇒ 按仓库既有做法(清测试数据直接 DELETE)硬删。
 *
 * 范围内的东西(全部按**我造的精确 id/单号**收窄,不碰任何既有数据):
 *   plang  id IN (1130,1131)                      —— 订单结转生出(GD-2026-10-0009/0010)
 *   plang_pc plang_id IN (1130,1131)              —— 排产记录(577/578)
 *   scjl   [报工单号] IN (BG-2026-10-0048..0053)   —— 误建/重建的**空**报工草稿(都 gd_id=0 且 sl=0)
 *   form_flow_link SO_ORDER → PLANG 的两条占用链   —— 不清会把两张 SO 行的剩余数量锁死
 *   yj_doc_status  上述工单号与报工单号的状态行
 * 不动:yj_usage_log(审计留痕,与"下架迁移不删留痕"同口径)。
 *
 * 幂等:重复执行 = 0 行。用法:sqlcmd -i 本文件(或由 _seed-prod-chain-cleanup-20261017.mjs 调用)。
 */
SET NOCOUNT ON;
GO
PRINT N'--- 执行前 ---';
SELECT N'plang(我造)' AS 对象, COUNT(*) AS 行数 FROM dbo.plang WHERE id IN (1130, 1131)
UNION ALL SELECT N'plang_pc(我造)', COUNT(*) FROM dbo.plang_pc WHERE plang_id IN (1130, 1131)
UNION ALL SELECT N'scjl(空草稿)', COUNT(*) FROM dbo.scjl WHERE [报工单号] IN ('BG-2026-10-0048','BG-2026-10-0049','BG-2026-10-0050','BG-2026-10-0051','BG-2026-10-0052','BG-2026-10-0053') AND gd_id = 0 AND ISNULL(sl, 0) = 0
UNION ALL SELECT N'form_flow_link', COUNT(*) FROM dbo.form_flow_link WHERE target_form_no IN ('GD-2026-10-0009','GD-2026-10-0010')
UNION ALL SELECT N'yj_doc_status', COUNT(*) FROM dbo.yj_doc_status WHERE doc_no IN ('GD-2026-10-0009','GD-2026-10-0010','BG-2026-10-0048','BG-2026-10-0049','BG-2026-10-0050','BG-2026-10-0051','BG-2026-10-0052','BG-2026-10-0053');
GO

BEGIN TRAN;

/* ① 占用链(必须先删:否则 SO 行剩余数量回不去) */
DELETE FROM dbo.form_flow_link
 WHERE source_panel_code = N'SO_ORDER' AND target_panel_code = N'PLANG'
   AND target_form_no IN (N'GD-2026-10-0009', N'GD-2026-10-0010');
PRINT N'[OK] 占用链删除 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ② 报工草稿(只删**空**行:gd_id=0 且 sl=0 —— 有内容的一律不动) */
DELETE FROM dbo.scjl
 WHERE [报工单号] IN ('BG-2026-10-0048','BG-2026-10-0049','BG-2026-10-0050','BG-2026-10-0051','BG-2026-10-0052','BG-2026-10-0053')
   AND gd_id = 0 AND ISNULL(sl, 0) = 0;
PRINT N'[OK] 空报工草稿删除 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 排产记录 */
DELETE FROM dbo.plang_pc WHERE plang_id IN (1130, 1131);
PRINT N'[OK] 排产记录删除 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ④ 工单 */
DELETE FROM dbo.plang WHERE id IN (1130, 1131);
PRINT N'[OK] 工单删除 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ⑤ 单据状态行 */
DELETE FROM dbo.yj_doc_status
 WHERE doc_no IN ('GD-2026-10-0009','GD-2026-10-0010','BG-2026-10-0048','BG-2026-10-0049','BG-2026-10-0050','BG-2026-10-0051','BG-2026-10-0052','BG-2026-10-0053');
PRINT N'[OK] 状态行删除 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT;
GO

PRINT N'--- 执行后(应全 0)---';
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM dbo.plang WHERE id IN (1130, 1131)) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.plang_pc WHERE plang_id IN (1130, 1131)) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.scjl WHERE [报工单号] IN ('BG-2026-10-0048','BG-2026-10-0049','BG-2026-10-0050','BG-2026-10-0051','BG-2026-10-0052','BG-2026-10-0053') AND gd_id = 0 AND ISNULL(sl, 0) = 0) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.form_flow_link WHERE target_form_no IN ('GD-2026-10-0009','GD-2026-10-0010')) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.yj_doc_status WHERE doc_no IN ('GD-2026-10-0009','GD-2026-10-0010')) SET @bad = @bad + 1;
SELECT N'plang 总数(基线 3)=' + CAST(COUNT(*) AS nvarchar(10)) FROM dbo.plang
UNION ALL SELECT N'plang_pc 总数(基线 2)=' + CAST(COUNT(*) AS nvarchar(10)) FROM dbo.plang_pc
UNION ALL SELECT N'scjl 总数(基线 4)=' + CAST(COUNT(*) AS nvarchar(10)) FROM dbo.scjl;
IF @bad = 0 PRINT N'[OK] 造数痕迹已全部清掉';
ELSE RAISERROR(N'[FAIL] 仍有 %d 项残留', 16, 1, @bad);
GO
