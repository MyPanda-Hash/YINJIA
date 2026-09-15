SET NOCOUNT ON;
DELETE FROM yj_field WHERE panel_code='KHDA' AND col_name IN ('frdb','zczb','clrq');
DELETE FROM yj_field WHERE panel_code='DEPT' AND col_name = N'负责人';
DELETE FROM yj_field WHERE panel_code='SETTLE' AND col_name = N'备注';
SELECT panel_code, COUNT(*) AS 列数 FROM yj_field
WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
GROUP BY panel_code ORDER BY panel_code;
