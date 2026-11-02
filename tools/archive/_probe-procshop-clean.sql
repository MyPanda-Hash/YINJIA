/* _probe-procshop-clean.sql —— 收尾:删掉 ProcessShop 端到端验证造出来的测试库数据
 * (只跑 HSDZ_MES_TEST;测试账套本来就是造数用的,这里只是把探针痕迹清干净) */

-- ① 删掉探针新写的预排台账(行 id > 170 且是本行这次写的)
DELETE FROM wo_process_line WHERE 工单号 = N'GD2608100002' AND 工单行id = 2 AND id > 170;

-- ② 删掉探针排产产生的排产镜像
DELETE FROM plang_pc WHERE plang_id = 2;

-- ③ 把工单行恢复成快照原样(GY-CB-STD / 批次 20260810 / 排产 500 / 未排产)
UPDATE plang
   SET [工艺路线] = N'GY-CB-STD', [批次号] = N'20260810',
       xq_sl = 500, pl_sl = 500, yl = 0, scx = NULL, [当前工序] = N'成型',
       [完工状态] = N'未开工', ja = N'N',
       asp_user2 = N'probe-clean', asp_time2 = SYSDATETIME()
 WHERE id = 2 AND pl_no = N'GD2608100002';

-- ④ 删掉探针路线
DELETE FROM bs_route WHERE 工艺路线编码 = 'GY-2026-10-0001' AND asp_user1 = N'probe';

SELECT id, pl_no, [工艺路线], [批次号], pl_sl, xq_sl, ISNULL(scx, N'(null)') AS scx, ISNULL([当前工序], N'(null)') AS cur
FROM plang WHERE id = 2;
SELECT COUNT(*) AS left_ledger FROM wo_process_line WHERE 工单号 = N'GD2608100002' AND 工单行id = 2 AND id > 170;
SELECT COUNT(*) AS left_route FROM bs_route WHERE 工艺路线编码 = 'GY-2026-10-0001' AND asp_user1 = N'probe';
