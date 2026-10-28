/* cleanup.sql — 2026-10-28 清理 NewOpProbe.java 在测试账套造的数据
 *
 * 只对 HSDZ_MES_TEST 执行!干的事:
 *   ① 删临时路线 GY-TEST-FX-20261028 与该工单的预排台账;
 *   ② 工单 GD2608100001 回「待排产」:路线恢复 GY-CB-STD、清排产线/班组、排产数量回需求数量;
 *   ③ 排产记录 plang_pc(id=511)清掉本次排入的线/数量。
 */
USE HSDZ_MES_TEST;
GO

DELETE FROM dbo.wo_process_line WHERE 工单号 = 'GD2608100001';
DELETE FROM dbo.bs_route WHERE 工艺路线编码 = 'GY-TEST-FX-20261028';

UPDATE dbo.plang
   SET [工艺路线] = N'GY-CB-STD', scx = NULL, pl_man = NULL, lb = NULL,
       pl_sl = ISNULL(xq_sl, pl_sl), asp_user2 = NULL, asp_time2 = NULL
 WHERE pl_no = 'GD2608100001' AND id = 1;

UPDATE dbo.plang_pc SET scx = NULL, pl_sl = NULL WHERE id = 511;
GO

SELECT (SELECT COUNT(*) FROM dbo.wo_process_line WHERE 工单号 = 'GD2608100001') AS 台账残留,
       (SELECT COUNT(*) FROM dbo.bs_route WHERE 工艺路线编码 = 'GY-TEST-FX-20261028') AS 路线残留;
GO
