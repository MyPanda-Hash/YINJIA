SET NOCOUNT ON;
SELECT panel_code,
  COUNT(*) AS 总字段,
  SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示,
  SUM(CASE WHEN ISNULL(hidden,0)=1 OR ISNULL(visible,1)=0 THEN 1 ELSE 0 END) AS 隐藏
FROM yj_field
WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR','SO_ORDER','PU_ORDER')
GROUP BY panel_code ORDER BY panel_code;
