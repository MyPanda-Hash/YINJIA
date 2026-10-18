SET NOCOUNT ON;
PRINT N'== SRV1017 rid=579 ==';
SELECT id, src, rid, 单据编号, 单据类型, 工单号, 工单项次, asp_user1, asp_cancel FROM [HSDZ_MES_SRV1017].dbo.outh WHERE src=6 AND rid=579;
PRINT N'== SRV1017 id 6437/8075 ==';
SELECT id, src, rid, 单据编号, 单据类型, 工单号 FROM [HSDZ_MES_SRV1017].dbo.outh WHERE id IN (6437, 8075);
PRINT N'== 本地 id 8075 ==';
SELECT id, src, rid, 单据编号, 单据类型, 工单号 FROM dbo.outh WHERE id IN (6437, 8075);
PRINT N'== 各库 outh 唯一索引 ==';
DECLARE @sql nvarchar(max);
SET @sql = N'SELECT N''HSDZ_MES'' 库, name, is_unique, has_filter, filter_definition FROM dbo.sys.indexes WHERE object_id=OBJECT_ID(''dbo.outh'') AND is_unique=1
 UNION ALL SELECT N''SRV1017'', name, is_unique, has_filter, filter_definition FROM [HSDZ_MES_SRV1017].sys.indexes WHERE object_id=OBJECT_ID(''[HSDZ_MES_SRV1017].dbo.outh'') AND is_unique=1
 UNION ALL SELECT N''SRV1015'', name, is_unique, has_filter, filter_definition FROM [HSDZ_MES_SRV1015].sys.indexes WHERE object_id=OBJECT_ID(''[HSDZ_MES_SRV1015].dbo.outh'') AND is_unique=1
 UNION ALL SELECT N''TEST'', name, is_unique, has_filter, filter_definition FROM [HSDZ_MES_TEST].sys.indexes WHERE object_id=OBJECT_ID(''[HSDZ_MES_TEST].dbo.outh'') AND is_unique=1;';
EXEC sp_executesql @sql;
PRINT N'== SRV1017 里 LL/生产领料 同类行的 rid 分布(是否有同 rid 多行)==';
SELECT rid, COUNT(*) AS 行数 FROM [HSDZ_MES_SRV1017].dbo.outh WHERE 单据类型 = N'生产领料' GROUP BY rid;
