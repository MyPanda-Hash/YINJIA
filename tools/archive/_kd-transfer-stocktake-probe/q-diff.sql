SET NOCOUNT ON;
SELECT wzdm, ckdm, ISNULL(lot_no,'(NULL)') lot, yl, 更新时间=update_date FROM kucun WHERE (wzdm=N'YJ-SX-029' AND ckdm=N'CK00006') OR (wzdm=N'YJ-YKRS-007' AND ckdm=N'YCL-01') OR (wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006');
PRINT '=== 备份表(补录前)对照 ===';
SELECT wzdm, ckdm, ISNULL(lot_no,'(NULL)') lot, yl FROM kucun_bak_20261018 WHERE (wzdm=N'YJ-SX-029' AND ckdm=N'CK00006') OR (wzdm=N'YJ-YKRS-007' AND ckdm=N'YCL-01') OR (wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006');
