SET NOCOUNT ON;
SELECT '混杂标签剩余' AS k, CAST(COUNT(*) AS nvarchar(6)) AS v FROM yj_field WHERE panel_code='MATERIAL_OUT'
  AND (label LIKE N'%\_%' ESCAPE N'\' OR label NOT LIKE N'%[^a-zA-Z0-9_]%')
UNION ALL SELECT '旧列名剩余(bd)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
  AND name IN (N'单据状态_bill_status',N'审核时间_audit_time',N'审核人_auditor_name',N'dept_id',N'creator_id',N'modifier_id',N'bill_type_id',N'auditor_id',N'emp_id',N'pick_use_id')
UNION ALL SELECT '新列名就位(bd)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out')
  AND name IN (N'金蝶单据状态',N'金蝶审核时间',N'金蝶审核人',N'部门id',N'创建人id',N'修改人id',N'单据类型id',N'审核人id',N'经手人id',N'领料用途id')
UNION ALL SELECT '新标签 en 译名', CAST(COUNT(*) AS nvarchar(6)) FROM yj_translation WHERE scope='field' AND locale='en'
  AND ref_key IN (N'金蝶单据状态',N'金蝶审核时间',N'金蝶审核人',N'部门id',N'创建人id',N'修改人id',N'单据类型id',N'审核人id',N'经手人id',N'领料用途id')
UNION ALL SELECT '新标签 ja 译名', CAST(COUNT(*) AS nvarchar(6)) FROM yj_translation WHERE scope='field' AND locale='ja'
  AND ref_key IN (N'金蝶单据状态',N'金蝶审核时间',N'金蝶审核人',N'部门id',N'创建人id',N'修改人id',N'单据类型id',N'审核人id',N'经手人id',N'领料用途id')
UNION ALL SELECT '旧标签译名保留(采购入库还在用)', CAST(COUNT(*) AS nvarchar(6)) FROM yj_translation WHERE scope='field' AND ref_key=N'单据状态_bill_status'
UNION ALL SELECT '旧列数据是否丢(金蝶单据状态有值行)', CAST(COUNT(*) AS nvarchar(6)) FROM bd_material_out WHERE 金蝶单据状态 IS NOT NULL;
GO
