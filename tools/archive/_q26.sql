SET NOCOUNT ON;
-- 全部14面板:标签含英文的已显示字段(含隐藏的也列出来看全貌)
SELECT panel_code, place, col_name, label, CASE WHEN ISNULL(hidden,0)=1 OR ISNULL(visible,1)=0 THEN '隐' ELSE '显' END AS vis
FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER','KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
  AND (label LIKE '%[a-z]%' OR label LIKE '%[A-Z]%')
  AND label NOT LIKE N'%[%]%'
ORDER BY panel_code, vis DESC, seq;
