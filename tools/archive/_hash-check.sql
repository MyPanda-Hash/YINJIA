SET NOCOUNT ON; SELECT script_name + '|' + content_hash AS line FROM yj_schema_log WHERE script_name LIKE '%qc-unit%' OR script_name LIKE '%qcrecv-unit%';
