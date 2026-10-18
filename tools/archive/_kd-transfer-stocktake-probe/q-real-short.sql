SET NOCOUNT ON;
PRINT '=== 4 个被拦行的 (物料,仓库) 汇总可用量 vs 需求 ===';
SELECT t.wzdm, t.ckdm, t.need AS 需调出,
       (SELECT ISNULL(SUM(CASE WHEN k.yl>0 THEN k.yl ELSE 0 END),0) FROM kucun k WHERE k.wzdm=t.wzdm AND k.ckdm=t.ckdm) AS 汇总可用,
       (SELECT COUNT(*) FROM kucun k WHERE k.wzdm=t.wzdm AND k.ckdm=t.ckdm) AS 行数
FROM (VALUES
  (N'YJ-AJ-016-1',N'CK00006',10827.0),
  (N'YJ-SX-003-1',N'CK00006',14000.0),
  (N'YJ-SX-029',N'CK00006',6000.0),
  (N'YJ-YKRS-007',N'YCL-01',1900.0)
) t(wzdm,ckdm,need);
PRINT '=== YJ-SX-029 / CK00006 明细 ===';
SELECT ISNULL(lot_no,'<NULL>') lot, yl, rkl, ckl FROM kucun WHERE wzdm=N'YJ-SX-029' AND ckdm=N'CK00006';
