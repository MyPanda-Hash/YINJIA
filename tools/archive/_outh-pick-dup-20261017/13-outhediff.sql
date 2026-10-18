SET NOCOUNT ON;
PRINT N'== outh:只在本地 / 只在服务器快照 的行(按 id)==';
SELECT N'只在本地' AS 侧, o.id, o.src, o.rid, o.单据编号, o.单据类型, o.工单号, ISNULL(o.asp_cancel,'N') AS cancel
  FROM dbo.outh o WHERE NOT EXISTS (SELECT 1 FROM [HSDZ_MES_SRV1017].dbo.outh s WHERE s.id=o.id)
UNION ALL
SELECT N'只在服务器', s.id, s.src, s.rid, s.单据编号, s.单据类型, s.工单号, ISNULL(s.asp_cancel,'N')
  FROM [HSDZ_MES_SRV1017].dbo.outh s WHERE NOT EXISTS (SELECT 1 FROM dbo.outh o WHERE o.id=s.id);
PRINT N'== 两边 outh 行数 / (src,rid) 键总数 ==';
SELECT (SELECT COUNT(*) FROM dbo.outh) 本地行,
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.outh) 服务器行,
       (SELECT COUNT(DISTINCT CONCAT(src,':',rid)) FROM dbo.outh) 本地键;
PRINT N'== 本地各表 vs 快照:结构对照(outh 索引/约束)==';
SELECT N'本地' AS 侧, i.name, i.is_unique, i.has_filter, i.filter_definition FROM sys.indexes i WHERE i.object_id=OBJECT_ID('dbo.outh')
UNION ALL
SELECT N'服务器', i.name, i.is_unique, i.has_filter, i.filter_definition FROM [HSDZ_MES_SRV1017].sys.indexes i
 WHERE i.object_id=OBJECT_ID('[HSDZ_MES_SRV1017].dbo.outh');
