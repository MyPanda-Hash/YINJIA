SET NOCOUNT ON;
SELECT '=== qc tables ===' AS x;
SELECT t.name, SUM(p.rows) rows
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE 'qc%' OR t.name LIKE '%insp%' OR t.name LIKE '%catalog%'
GROUP BY t.name ORDER BY t.name;

SELECT '=== sl_recv head status ===' AS x;
SELECT 单据状态, COUNT(*) n FROM sl_recv GROUP BY 单据状态;

SELECT '=== recv lines need inspection ===' AS x;
SELECT COUNT(*) total_lines,
       SUM(CASE WHEN LTRIM(RTRIM(i.来料检验))='是' THEN 1 ELSE 0 END) need_insp,
       SUM(CASE WHEN ISNULL(LTRIM(RTRIM(i.来料检验)),'')<>'是' THEN 1 ELSE 0 END) no_insp
FROM sl_recv_detail d
LEFT JOIN bs_inv i ON LTRIM(RTRIM(i.存货编码))=LTRIM(RTRIM(d.物料编码))
WHERE ISNULL(d.asp_cancel,'N')<>'Y';

SELECT '=== recv docs with need-insp lines ===' AS x;
SELECT COUNT(DISTINCT d.单据编号) docs
FROM sl_recv_detail d
JOIN bs_inv i ON LTRIM(RTRIM(i.存货编码))=LTRIM(RTRIM(d.物料编码))
WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND LTRIM(RTRIM(i.来料检验))='是';

SELECT '=== products requiring inspection ===' AS x;
SELECT i.存货编码, i.存货名称, i.所属类别, i.来料检验
FROM bs_inv i WHERE LTRIM(RTRIM(i.来料检验))='是' ORDER BY i.存货编码;

SELECT '=== qc_insp columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_insp') ORDER BY c.column_id;

SELECT '=== qc_insp_detail columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_insp_detail') ORDER BY c.column_id;

SELECT '=== qc_insp_rec columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_insp_rec') ORDER BY c.column_id;

SELECT '=== qc_catalog columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_catalog') ORDER BY c.column_id;

SELECT '=== qc_catalog_detail columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_catalog_detail') ORDER BY c.column_id;

SELECT '=== qc_return columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_return') ORDER BY c.column_id;

SELECT '=== qc_return_detail columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_return_detail') ORDER BY c.column_id;

SELECT '=== qc_insp_detail rows ===' AS x;
SELECT * FROM qc_insp_detail ORDER BY id;

SELECT '=== qc_return rows ===' AS x;
SELECT * FROM qc_return ORDER BY id;

SELECT '=== qc_return_detail rows ===' AS x;
SELECT * FROM qc_return_detail ORDER BY id;
