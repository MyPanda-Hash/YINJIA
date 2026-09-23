SET NOCOUNT ON;
-- 三单 + 特采/紧急放行 + 采购入库 的真实列
SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('qc_recv','qc_recv_line','qc_insp','qc_insp_line',
                     'qc_return','qc_return_line','qc_tc','qc_tc_line',
                     'qc_jjf','qc_jjf_line','pur_inbound','pur_inbound_line',
                     'sl_recv','qc_recv_head')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
SELECT name FROM sys.tables WHERE name LIKE 'qc%' OR name LIKE '%recv%' OR name LIKE '%insp%'
   OR name LIKE '%return%' OR name LIKE '%tc%' OR name LIKE '%jjf%' OR name LIKE 'pur%' OR name LIKE 'rkd%' OR name LIKE 'ckd%'
ORDER BY name;
GO
SELECT name, type_desc FROM sys.objects WHERE type IN ('V','P','FN','TF','IF') ORDER BY name;
GO
