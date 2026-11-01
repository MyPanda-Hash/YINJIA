SET NOCOUNT ON;
SELECT t.name,
  STUFF((SELECT ', '+c.name+'('+ty.name+')'
         FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
         WHERE c.object_id=t.object_id ORDER BY c.column_id
         FOR XML PATH(''), TYPE).value('.','nvarchar(max)'),1,2,'') AS cols
FROM sys.tables t
WHERE t.name IN ('qc_insp','qc_insp_detail','qc_insp_rec','qc_insp_rec_detail')
ORDER BY t.name;
