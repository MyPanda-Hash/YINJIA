SET NOCOUNT ON;
SELECT script_name, CONVERT(varchar(19), applied_at, 120) AS applied_at
FROM yj_schema_log
WHERE script_name LIKE '%lot-rename%' OR script_name LIKE '%doc-annotation%'
   OR script_name LIKE '%lot-normalize%' OR script_name LIKE '%stock-detail-hide-zero%'
   OR script_name LIKE '%prodinfo-name-required%' OR script_name LIKE '%prodinfo-project-link%'
   OR script_name LIKE '%change-title%' OR script_name LIKE '%share-file-spare%'
   OR script_name LIKE '%rd-approval-attach%' OR script_name LIKE '%rd-prod-info-od-before-id%'
   OR script_name LIKE '%stock-report-dup-fields%' OR script_name LIKE '%align-docdate-batch-time%'
ORDER BY script_name;
