SET NOCOUNT ON;
PRINT '=== 9月调拨涉及的三键当前结存(补录前) ===';
SELECT wzdm, ckdm, lot_no, yl, rkl, ckl FROM kucun WHERE (ckdm='CK00006' OR ckdm='YCL-01' OR ckdm='CK00005')
 AND wzdm IN (N'YJ-AJ-016-1',N'YJ-AJ-016-2',N'YJ-SX-003-1',N'YJ-SX-003-2',N'YJ-HKB-003',N'YJ-SX-029',N'YJ-DK-001',N'HP-08',N'HP-12')
 ORDER BY ckdm, wzdm, lot_no;
