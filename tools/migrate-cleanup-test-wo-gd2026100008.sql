/* migrate-cleanup-test-wo-gd2026100008.sql — 2026-10-16
   清掉「工艺路线审核闸门」验证时实调产生的一张测试工单 GD-2026-10-0008。

   背景:为确认"已审核路线能正常放行",用已审核订单 LZW-20261012-01#7451 转出 1 件、
        绑 GY-CB-STD 生成该单;验证通过(GD-2026-10-0008 生成成功)后按用户要求删除。

   删除范围(仅此单,不碰其它数据):
     · plang / plang_pc:软删该工单行 + 删其排产薄记录
     · form_flow_link:释放 SO_ORDER#7451 → PLANG 的占用(否则订单行剩余量一直被占)
     · yj_doc_status:删该工单的状态行(plang 不进状态机的单可无此行,有则清)
   幂等:按单号定向,重复执行无副作用。 */
SET NOCOUNT ON;
GO

DECLARE @ids TABLE (id int);
INSERT INTO @ids (id)
SELECT id FROM dbo.plang WHERE pl_no = N'GD-2026-10-0008' AND ISNULL(asp_cancel,'N') <> 'Y';

/* ① 排产薄记录(plang_pc)先删 */
DELETE FROM dbo.plang_pc WHERE plang_id IN (SELECT id FROM @ids);

/* ② 占用链释放:该工单占用的 SO_ORDER 行 */
UPDATE dbo.form_flow_link SET link_status = 'RELEASED', release_time = SYSDATETIME()
 WHERE source_panel_code = 'SO_ORDER' AND target_panel_code = 'PLANG'
   AND target_form_no = N'GD-2026-10-0008' AND link_status = 'ACTIVE';

/* ③ 工单行软删 */
UPDATE dbo.plang SET asp_cancel = 'Y', asp_user2 = N'cleanup-test', asp_time2 = GETDATE()
 WHERE id IN (SELECT id FROM @ids);

/* ④ 状态行(如存在) */
DELETE FROM dbo.yj_doc_status WHERE panel_code = 'PLANG' AND doc_no = N'GD-2026-10-0008';

/* 自检 */
DECLARE @live int;
SELECT @live = COUNT(*) FROM dbo.plang WHERE pl_no = N'GD-2026-10-0008' AND ISNULL(asp_cancel,'N') <> 'Y';
IF @live > 0 RAISERROR(N'测试工单未清干净(仍有 %d 行存活)', 16, 1, @live);
ELSE PRINT N'已清理测试工单 GD-2026-10-0008(软删 + 释放占用 + 清状态)';
GO
