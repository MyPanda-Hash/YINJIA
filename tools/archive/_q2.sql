SET NOCOUNT ON;
SELECT panel_code + '|' + col_name + '|' + label
FROM yj_field
WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
ORDER BY panel_code, seq, id;
