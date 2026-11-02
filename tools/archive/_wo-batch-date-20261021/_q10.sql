SET NOCOUNT ON;
SELECT N'kucun 批号=20261014' k, COUNT(*) n FROM dbo.kucun WHERE lot_no=N'20261014'
UNION ALL SELECT N'inh 批号=20261014', COUNT(*) FROM dbo.inh WHERE 批号=N'20261014'
UNION ALL SELECT N'outh 批号=20261014', COUNT(*) FROM dbo.outh WHERE 批号=N'20261014';
GO
SELECT N'kucun 批号=20260917' k, COUNT(*) n FROM dbo.kucun WHERE lot_no=N'20260917'
UNION ALL SELECT N'inh 批号=20260917', COUNT(*) FROM dbo.inh WHERE 批号=N'20260917'
UNION ALL SELECT N'outh 批号=20260917', COUNT(*) FROM dbo.outh WHERE 批号=N'20260917';
GO
SELECT TOP 10 单据编号,单据类型,CONVERT(varchar(10),单据日期,120) 单据日期,物料编码,仓库编码,批号,数量,asp_user2
FROM dbo.inh WHERE 单据编号 LIKE N'FI-%' ORDER BY id DESC;
GO
SELECT TOP 10 单据编号,单据类型,CONVERT(varchar(10),单据日期,120) 单据日期,物料编码,仓库编码,批号,数量 FROM dbo.inh WHERE 批号=N'20261014';
GO
SELECT COUNT(*) AS docbatch FROM dbo.yj_doc_batch WHERE batch_no=N'20261014';
GO
