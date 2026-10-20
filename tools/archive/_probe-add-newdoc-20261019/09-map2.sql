SET NOCOUNT ON;
WITH nums AS (
  SELECT 'SL-2026-10-' + RIGHT('0000' + CAST(n AS varchar(4)),4) AS dh FROM (SELECT TOP 40 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) n FROM sys.objects) x
)
SELECT n.dh,
  (SELECT COUNT(*) FROM sl_recv r WHERE r.单据编号=n.dh) AS 头行数,
  (SELECT COUNT(*) FROM s_allno s WHERE s.dh=n.dh) AS 号池行,
  (SELECT MAX(r.单据日期) FROM sl_recv r WHERE r.单据编号=n.dh) AS 库日期,
  (SELECT MAX(s.asp_user1) FROM s_allno s WHERE s.dh=n.dh) AS 号池登记人
FROM nums n ORDER BY n.dh;
