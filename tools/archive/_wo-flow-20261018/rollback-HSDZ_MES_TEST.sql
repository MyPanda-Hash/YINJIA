/* rollback-HSDZ_MES_TEST.sql —— 回滚 wo-flow-20261018 生产工单全流程推进(由 _seed-wo-flow.mjs 生成) */
SET NOCOUNT ON;
DELETE FROM dbo.yj_doc_status WHERE (panel_code=N'WO_REPORT' AND doc_no IN (SELECT [报工单号] FROM dbo.scjl WHERE asp_user1=N'wo-flow-20261018')) OR (panel_code=N'QC_ASM_INSP' AND doc_no IN (SELECT [单据编号] FROM dbo.qc_asm_insp_head WHERE asp_user1=N'wo-flow-20261018')) OR (panel_code=N'FINISH_IN' AND doc_no IN (SELECT [单据编号] FROM dbo.bd_finish_in WHERE asp_user1=N'wo-flow-20261018'));
DELETE FROM dbo.bl_finish_in WHERE [单据编号] IN (SELECT [单据编号] FROM dbo.bd_finish_in WHERE asp_user1=N'wo-flow-20261018');
DELETE FROM dbo.bd_finish_in WHERE asp_user1=N'wo-flow-20261018';
DELETE FROM dbo.qc_asm_insp_detail WHERE [单据编号] IN (SELECT [单据编号] FROM dbo.qc_asm_insp_head WHERE asp_user1=N'wo-flow-20261018');
DELETE FROM dbo.qc_asm_insp_head WHERE asp_user1=N'wo-flow-20261018';
DELETE FROM dbo.scjl WHERE asp_user1=N'wo-flow-20261018';
DELETE FROM dbo.wo_progress WHERE asp_user1=N'wo-flow-20261018';
DELETE FROM dbo.s_allno WHERE asp_user1=N'wo-flow-20261018';
DELETE FROM dbo.plang_pc WHERE asp_user1=N'wo-flow-20261018';
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=3;   -- GD2608190001#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=4;   -- GD2608190002#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=5;   -- GD2608190003#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=6;   -- GD2608190004#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=7;   -- GD2608190005#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=8;   -- GD2608190006#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=9;   -- GD2608190007#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260819', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=11;   -- GD2608190009#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=13;   -- GD2608260001#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=14;   -- GD2608260002#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=15;   -- GD2608260003#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=16;   -- GD2608260004#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=17;   -- GD2608260005#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=18;   -- GD2608260006#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=19;   -- GD2608260007#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=20;   -- GD2608260008#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=21;   -- GD2608260009#1
UPDATE dbo.plang SET scx=N'2号机', rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=22;   -- GD2608260010#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260826', asp_user1=N'Admin', asp_user2=N'migration' WHERE id=24;   -- GD2608260012#1
UPDATE dbo.plang SET scx=N'成型2线', rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928', asp_user1=N'admin', asp_user2=N'migration' WHERE id=28;   -- MO-2026-09-0006#1
UPDATE dbo.plang SET scx=N'成型2线', rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928-2', asp_user1=N'admin', asp_user2=N'migration' WHERE id=29;   -- MO-2026-09-0006#1
UPDATE dbo.plang SET scx=N'1号车间', rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928-3', asp_user1=N'admin', asp_user2=N'migration' WHERE id=30;   -- MO-2026-09-0006#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928', asp_user1=N'admin', asp_user2=N'migration' WHERE id=31;   -- MO-2026-09-0007#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928', asp_user1=N'admin', asp_user2=N'migration' WHERE id=32;   -- MO-2026-09-0007#2
UPDATE dbo.plang SET scx=N'1号车间', rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928-4', asp_user1=N'admin', asp_user2=N'migration' WHERE id=33;   -- MO-2026-09-0006#1
UPDATE dbo.plang SET scx=NULL, rk_sl=0, rk_no=NULL, [完工状态]=N'未开工', [当前工序]=N'成型', [当前工序完工量]=0, [完工时间]=NULL, cp_date2=NULL, ja=N'N', [批次号]=N'20260928', asp_user1=N'admin', asp_user2=N'admin' WHERE id=36;   -- MO-2026-09-0007#2
GO
