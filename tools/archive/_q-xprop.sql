SET NOCOUNT ON;
SELECT 'yj_report_template' AS t, COUNT(*) AS n FROM sys.extended_properties WHERE major_id=OBJECT_ID('yj_report_template') AND minor_id=0 AND name='MS_Description';
SELECT 'qc_tc' AS t, COUNT(*) AS n FROM sys.extended_properties WHERE major_id=OBJECT_ID('qc_tc') AND minor_id=0 AND name='MS_Description';
SELECT 'qc_tc_cols' AS t, COUNT(*) AS n FROM sys.extended_properties WHERE major_id=OBJECT_ID('qc_tc') AND minor_id>0 AND name='MS_Description';
SELECT 'total_tables' AS t, COUNT(*) AS n FROM sys.tables;
SELECT 'commented_tables' AS t, COUNT(*) AS n FROM sys.tables tb JOIN sys.extended_properties ep ON ep.major_id=tb.object_id AND ep.minor_id=0 AND ep.name='MS_Description';
SELECT 'cur_user' AS t, USER_NAME() AS n;
SELECT 'db_owner_member' AS t, IS_ROLEMEMBER('db_owner') AS n;
