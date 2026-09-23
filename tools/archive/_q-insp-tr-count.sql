SET NOCOUNT ON;
SELECT COUNT(*) AS distinct_pairs FROM (
    SELECT DISTINCT ref_key, locale FROM yj_translation WHERE scope='field'
      AND ref_key IN (N'检验编号',N'执行标准',N'检验类型',N'报废数量',N'损耗',N'损耗率',N'条码',N'成品编号',N'生产日期')
      AND locale IN ('en','ja','ko','de','fr','es','ru','th','vi','zh-TW')) d;
GO
