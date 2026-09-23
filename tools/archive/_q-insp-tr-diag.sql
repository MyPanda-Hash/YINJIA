SET NOCOUNT ON;
DECLARE @tr int = (SELECT COUNT(*) FROM (
    SELECT DISTINCT ref_key, locale FROM yj_translation WHERE scope='field'
      AND ref_key IN (N'检验编号',N'执行标准',N'检验类型',N'报废数量',N'损耗',N'损耗率',N'条码',N'成品编号',N'生产日期')
      AND locale IN ('en','ja','ko','de','fr','es','ru','th','vi','zh-TW')) d);
PRINT N'自检口径计数 = ' + CAST(@tr AS nvarchar(10));
PRINT '== 等值查询 生产日期/en ==';
SELECT COUNT(*) AS eq_count FROM yj_translation WHERE scope='field' AND ref_key = N'生产日期' AND locale = 'en';
PRINT '== 该行列名实际码点 ==';
SELECT ref_key, CAST(ref_key AS varbinary(20)) AS ref_hex, locale, CAST(locale AS varbinary(10)) AS loc_hex
  FROM yj_translation WHERE scope='field' AND ref_key LIKE N'%生产日期%' AND locale LIKE '%en%';
GO
