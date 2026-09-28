SET NOCOUNT ON;
SELECT '旧列残留' AS k, CAST(COUNT(*) AS nvarchar(6)) AS v FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
  AND name IN (N'单据状态_bill_status',N'审核时间_audit_time',N'审核人_auditor_name',N'dept_id',N'creator_id',N'modifier_id',N'biller_id',N'bill_type_id',N'auditor_id',N'emp_id',N'pick_use_id')
UNION ALL SELECT '新列就位', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
  AND name IN (N'金蝶单据状态',N'金蝶审核时间',N'金蝶审核人',N'部门id',N'创建人id',N'修改人id',N'单据类型id',N'审核人id',N'经手人id',N'领料用途id')
UNION ALL SELECT '混杂标签剩余', CAST(COUNT(*) AS nvarchar(6)) FROM yj_field WHERE panel_code='MATERIAL_OUT'
  AND (label LIKE N'%\_%' ESCAPE N'\' OR label NOT LIKE N'%[^a-zA-Z0-9_]%')
UNION ALL SELECT '字段行总数(应117)', CAST(COUNT(*) AS nvarchar(6)) FROM yj_field WHERE panel_code='MATERIAL_OUT'
UNION ALL SELECT '字段行重复(col_name重复)', CAST(COUNT(*) AS nvarchar(6)) FROM (SELECT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' GROUP BY col_name HAVING COUNT(*)>1) d
UNION ALL SELECT '列数(bd,应54)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
UNION ALL SELECT '列数(bl,应85)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_material_out');
GO
