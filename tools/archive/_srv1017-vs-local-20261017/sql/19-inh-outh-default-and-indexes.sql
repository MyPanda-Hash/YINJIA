SET NOCOUNT ON;
SELECT 'inh' AS 表,
  SUM(CASE WHEN asp_cancel = N'‘N’' THEN 1 ELSE 0 END) AS 值为中文引号的行,
  SUM(CASE WHEN asp_cancel = N'N' THEN 1 ELSE 0 END) AS 值为N的行,
  COUNT(*) AS 总行
FROM HSDZ_MES_SRV1017.dbo.inh
UNION ALL
SELECT 'outh',
  SUM(CASE WHEN asp_cancel = N'‘N’' THEN 1 ELSE 0 END),
  SUM(CASE WHEN asp_cancel = N'N' THEN 1 ELSE 0 END),
  COUNT(*)
FROM HSDZ_MES_SRV1017.dbo.outh;
PRINT '=== inh/outh 上的索引及其过滤条件 ===';
SELECT t.name AS 表, i.name AS 索引, i.is_unique AS 唯一, ISNULL(i.filter_definition,'(无过滤)') AS 过滤条件,
       ISNULL(STUFF((SELECT ','+c.name FROM HSDZ_MES_SRV1017.sys.index_columns ic JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                     WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,''),'') AS 键列
FROM HSDZ_MES_SRV1017.sys.indexes i JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=i.object_id
WHERE t.name IN ('inh','outh') AND i.type_desc<>'HEAP' ORDER BY t.name, i.name;
