SET NOCOUNT ON;
PRINT N'== qc_first_insp_head 关键列 ==';
SELECT c.name AS col, t.name AS typ, c.max_length AS len, c.is_nullable AS nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.qc_first_insp_head') AND c.name IN (N'单据编号',N'单据日期',N'检验日期',N'生产日期',N'批次号',N'工单号',N'工单行号')
ORDER BY c.column_id;
PRINT N'== scjl 日期列 ==';
SELECT c.name AS col, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.scjl') AND c.name IN (N'sc_date',N'wgsj',N'asp_time1',N'kssj') ORDER BY c.column_id;
PRINT N'== 首件单最近 8 张(单据日期分布) ==';
SELECT TOP 8 单据编号, 工单号, ISNULL(工单行号,0) AS xc, 单据日期, 检验日期, ISNULL(生产日期,N'') AS prod_date, ISNULL(批次号,N'') AS lot, CONVERT(varchar(19),asp_time1,120) AS created
FROM dbo.qc_first_insp_head ORDER BY id DESC;
