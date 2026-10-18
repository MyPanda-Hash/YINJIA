SET NOCOUNT ON;
SELECT wzdm, ckdm, lot_no, yl, rkl, ckl, asp_cancel FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
PRINT '=== 对照备份表 ===';
SELECT wzdm, ckdm, lot_no, yl FROM kucun_bak_20261018 WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
PRINT '=== kucun 总行数/总量 ===';
SELECT COUNT(*) n, SUM(yl) yl FROM kucun;
