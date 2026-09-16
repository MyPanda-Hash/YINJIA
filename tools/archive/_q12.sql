SET NOCOUNT ON;
-- 1) 面板上标签含英文字母的已显示字段
SELECT panel_code, col_name, label
FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
  AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
  AND label LIKE '%[a-zA-Z]%'
  AND label NOT LIKE N'%[%]%'
ORDER BY panel_code, seq;
