UPDATE plang SET [工艺路线] = N'GY-2026-10-0001', [批次号] = N'PROBE211021',
       xq_sl = 100, pl_sl = 0, yl = 100, scx = NULL, [当前工序] = NULL, ja = N'N',
       asp_user2 = N'probe', asp_time2 = SYSDATETIME()
 WHERE id = 2 AND pl_no = N'GD2608100002';
SELECT id, pl_no, [工艺路线], [批次号], pl_sl, xq_sl, ISNULL(scx, N'(null)') AS scx, ISNULL(ja, N'(null)') AS ja FROM plang WHERE id = 2;
