SET NOCOUNT ON;
SELECT COUNT(*) AS 剩余英文可见 FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT','KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
  AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
  AND (label LIKE '%[a-z]%' OR label LIKE '%[A-Z]%') AND label NOT LIKE N'%[%]%' AND label NOT LIKE N'%id%' AND label NOT LIKE N'%ID%';
