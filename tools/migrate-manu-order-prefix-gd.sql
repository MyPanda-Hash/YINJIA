/* migrate-manu-order-prefix-gd.sql(2026-10-05):生产工单前缀 MO → GD
 *
 * 用户口径:「行当前就修改生产工单即可」(前缀表:BOM配料单 PL / 生产工单 GD / 生产移转 YZ / 排产单号 PC;
 *   其余三张单系统里不存在,本轮只改生产工单)。
 * 改动范围:
 *   · 代码取号:QuickScheduleService → formNo.next("MO") 改为 formNo.next("GD")(唯一取号入口);
 *   · 面板元数据:MANU_ORDER(生产工单)prefix MO → GD,与代码保持一致。
 * 说明:**只影响以后新生成的单号**,历史工单号(MO-2026-xx-xxxx)概不修改;
 *   取号流水在 s_allno(按 前缀+年月 各自独立序列),新旧前缀不混号(实测新号 = GD-2026-10-0001)。
 * 撤回:UPDATE yj_panel SET prefix=N'MO' WHERE panel_code=N'MANU_ORDER'; 并把代码改回 "MO"。
 * 幂等可重跑;两账套均执行。
 */
UPDATE yj_panel SET prefix = N'GD' WHERE panel_code = N'MANU_ORDER' AND ISNULL(prefix, N'') <> N'GD';
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'MANU_ORDER' AND prefix = N'GD')
  RAISERROR(N'生产工单面板前缀未改为 GD', 16, 1);
ELSE PRINT N'生产工单前缀就绪:面板 = GD(代码取号同步为 GD;历史单号不变)';
GO