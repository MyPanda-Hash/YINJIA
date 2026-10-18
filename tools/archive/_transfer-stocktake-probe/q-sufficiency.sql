SET NOCOUNT ON;
WITH L AS (
  SELECT * FROM (VALUES
   (N'YJ-AJ-016-1',N'CK00006',N'PC0000',10827.0),
   (N'YJ-AJ-016-2',N'CK00006',N'PC0000',10827.0),
   (N'YJ-SX-003-1',N'CK00006',N'PC0000',14000.0),
   (N'YJ-SX-003-2',N'CK00006',N'PC0000',14000.0),
   (N'YJ-HKB-003',N'CK00006',NULL,1000.0),
   (N'YJ-SX-029',N'CK00006',N'PC0000',6000.0),
   (N'YJ-DK-001',N'CK00005',NULL,2050.0),
   (N'HP-08',N'CK00006',N'PC0000',61.0),
   (N'HP-12',N'CK00006',N'PC0000',350.0)
  ) t(wzdm, ckdm, lot, qty)
)
SELECT L.wzdm, L.ckdm, ISNULL(L.lot,N'(无批号)') lot, L.qty AS 需调出,
       ISNULL(k.yl, 0) AS 该批现存,
       CASE WHEN ISNULL(k.yl,0) >= L.qty THEN N'够' ELSE N'不够' END AS 判定
FROM L LEFT JOIN kucun k ON k.wzdm=L.wzdm AND k.ckdm=L.ckdm
     AND ((L.lot IS NULL AND k.lot_no IS NULL) OR k.lot_no=L.lot);
