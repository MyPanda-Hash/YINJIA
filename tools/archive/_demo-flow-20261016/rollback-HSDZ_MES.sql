/* rollback-HSDZ_MES.sql —— 回滚 demo-flow-20261016 生产链演示数据(按标记;由 _seed-demo-flow.mjs 生成) */
SET NOCOUNT ON;
DELETE FROM yj_doc_status WHERE panel_code = N'WO_REPORT' AND doc_no LIKE N'BG-%';   -- yj_doc_status 无标记列,按"报工单面板 + BG 单号前缀"识别(库里原本没有 BG 单)
DELETE FROM scjl WHERE asp_user1 = N'demo-flow-20261016';
DELETE FROM s_allno WHERE asp_user1 = N'demo-flow-20261016';
UPDATE bs_prod_line SET 日产能 = NULL, asp_user1 = NULL WHERE asp_user1 = N'demo-flow-20261016';
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 426;   -- GD-2026-10-0220#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 403;   -- GD-2026-10-0206#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 341;   -- GD-2026-10-0172#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 330;   -- GD-2026-10-0166#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 283;   -- GD-2026-10-0143#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 228;   -- GD-2026-10-0112#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 27;   -- GD-2026-10-0010#1
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 427;   -- GD-2026-10-0220#2
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 404;   -- GD-2026-10-0206#2
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 342;   -- GD-2026-10-0172#2
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 331;   -- GD-2026-10-0166#2
UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = 284;   -- GD-2026-10-0143#2
GO
