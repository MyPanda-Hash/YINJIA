-- migrate-date-field-types.sql — 时间/日期字段的 data_type 改为「日期」,前端自动渲染日期选择器
-- 原理:isDateField() 检查 dataType 含「日期」→ 渲染 el-date-picker(与单据日期同款)
SET NOCOUNT ON;

-- 所有面板:字段名含 时间/日期/到期日 → data_type 改为「日期」(仅改当前为「文本」的)
UPDATE yj_field SET data_type = N'日期'
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT','KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
  AND data_type = N'文本'
  AND (col_name LIKE N'%时间%' OR col_name LIKE N'%日期%' OR col_name LIKE N'%到期日%'
       OR label LIKE N'%时间%' OR label LIKE N'%日期%' OR label LIKE N'%到期日%');

GO
-- 自检:各面板日期类型字段数
SELECT panel_code, COUNT(*) AS 日期字段 FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT','KHDA','GFDA','INV','EMP','DEPT','WH')
  AND data_type = N'日期'
GROUP BY panel_code ORDER BY panel_code;
-- 抽查
SELECT panel_code, col_name, data_type FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND data_type = N'日期' AND (col_name LIKE N'%时间%' OR col_name LIKE N'%日期%' OR col_name LIKE N'%到期%')
ORDER BY panel_code, seq;
GO
PRINT N'日期字段类型修正完成';
GO
