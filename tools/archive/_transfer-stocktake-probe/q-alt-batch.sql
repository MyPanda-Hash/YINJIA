SET NOCOUNT ON;
PRINT '=== 4 个问题行:若把批号改成该物料该仓库存量最大的真实批号,是否够 ===';
WITH Need AS (
  SELECT * FROM (VALUES
   (N'HKB-003',N'YJ-HKB-003',N'CK00006',1000.0),
   (N'DK-001',N'YJ-DK-001',N'CK00005',2050.0),
   (N'YKRS-007',N'YJ-YKRS-007',N'YCL-01',1900.0),
   (N'SX-062',N'YJ-SX-062',N'CK00006',1350.0)
  ) t(tag, wzdm, ckdm, qty)
)
SELECT N.wzdm, N.ckdm, N.qty 需调出,
  (SELECT TOP 1 ISNULL(k.lot_no,N'(NULL)') FROM kucun k WHERE k.wzdm=N.wzdm AND k.ckdm=N.ckdm AND k.yl>=N.qty ORDER BY k.yl DESC) 可满足的批号,
  (SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm=N.wzdm AND k.ckdm=N.ckdm) 合计,
  (SELECT COUNT(*) FROM kucun k WHERE k.wzdm=N.wzdm AND k.ckdm=N.ckdm AND k.yl>=N.qty) 单个够的批号数
FROM Need N;
