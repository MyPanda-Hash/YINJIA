SET NOCOUNT ON;
SELECT wzdm, ckdm, lot_no = ISNULL(lot_no,'<NULL>'), rkl, ckl, yl, 差 = yl - (rkl - ckl),
       asp_user1, asp_user2, asp_time1, asp_time2
FROM kucun WHERE ABS(yl - (rkl - ckl)) > 0.0001;

SELECT 流水净额 = SUM(q) FROM (
  SELECT 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 物料编码 = 'YJ-SLD-005'
  UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 物料编码 = 'YJ-SLD-005') z;
