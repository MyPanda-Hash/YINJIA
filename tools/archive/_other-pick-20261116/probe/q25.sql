SET NOCOUNT ON;
SELECT 'H|' + 单据编号 + '|' + CONVERT(VARCHAR(10),单据日期,120) + '|业务类型=' + ISNULL(业务类型,N'') + '|业务类型编码=' + ISNULL(业务类型编码,N'') + '|经手人=' + ISNULL(经手人,N'') + '|状态=' + ISNULL(单据状态,N'') + '|备注=' + ISNULL(备注,N'')
FROM bd_other_out WHERE 单据编号 = 'OO-2026-11-0005';
SELECT 'L|' + ISNULL(存货编码,N'') + '|' + ISNULL(存货名称,N'') + '|' + ISNULL(规格型号,N'') + '|' + ISNULL(计量单位,N'') + '|仓=' + ISNULL(仓库,N'') + '|批号=' + ISNULL(批号,N'') + '|数=' + CAST(ISNULL(数量,0) AS VARCHAR(20)) + '|单价=' + CAST(ISNULL(单价,0) AS VARCHAR(20)) + '|金额=' + CAST(ISNULL(金额,0) AS VARCHAR(20)) + '|备注=' + ISNULL(明细备注,N'')
FROM bl_other_out WHERE 单据编号 = 'OO-2026-11-0005';
SELECT 'ST|' + COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION;
