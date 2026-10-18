SET NOCOUNT ON;
PRINT '=== 当前 YJ-AJ-016-1 / CK00006 真实值 ===';
SELECT yl, rkl, ckl FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006' AND lot_no IS NULL;
PRINT '=== 该单当前状态 ===';
SELECT h.单据编号, s.shr FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号 WHERE h.单据编号=N'YCD-20260908-00001';
PRINT '=== 该单明细 ===';
SELECT 存货编码, 数量, 调出仓库编码, 调入仓库编码 FROM bl_transfer WHERE 单据编号=N'YCD-20260908-00001';
