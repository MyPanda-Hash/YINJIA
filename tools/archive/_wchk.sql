SET NOCOUNT ON
SELECT '窄列体检: '+t.name+'.'+c.name+' = nvarchar('+CAST(c.max_length/2 AS varchar)+')' 
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name IN ('ckdm','仓库编码','wzdm','存货编码','khdm','客户编码','批号','lot_no','批次号') 
  AND c.system_type_id=231 AND c.max_length/2 < 8
ORDER BY t.name
