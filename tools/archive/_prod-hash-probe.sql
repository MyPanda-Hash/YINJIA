SET NOCOUNT ON;
SELECT script_name + '|' + content_hash AS line FROM yj_schema_log WHERE script_name LIKE '%manu%' OR script_name LIKE '%schedule%' OR script_name LIKE '%prod-%' OR script_name LIKE '%line-%' OR script_name LIKE '%wo-report%' OR script_name LIKE '%op-time%' OR script_name LIKE '%panel-flow%' OR script_name LIKE '%single-track%';
