-- 临时探针:商品档案(bs_inv)来料检验字段现状 — 真实账套自定义字段接线用
SET NOCOUNT ON;

SELECT N'① bs_inv 行数/已同步行数' AS 项,
       CAST(COUNT(*) AS nvarchar(20)) AS 值
FROM bs_inv
UNION ALL
SELECT N'② 金蝶同步行(外部数据ID非空)', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 外部数据ID IS NOT NULL
UNION ALL
SELECT N'③ 来料检验 非空行', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N''
UNION ALL
SELECT N'④ 来料检验 空/未填行', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 来料检验 IS NULL OR LTRIM(RTRIM(来料检验)) = N'';

-- 取值分布
SELECT N'[' + ISNULL(来料检验, N'<NULL>') + N']' AS 来料检验值, COUNT(*) AS 行数
FROM bs_inv GROUP BY 来料检验 ORDER BY 行数 DESC;

-- 样例
SELECT TOP 10 存货编码, 存货名称, 来料检验, ISNULL(商品类型, N'') AS 商品类型
FROM bs_inv
WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N''
ORDER BY 存货编码;

-- INV 面板上该字段的注册情况
SELECT place, seq, col_name, label, data_type, editable, hidden, visible
FROM yj_field WHERE panel_code = N'INV' AND col_name IN (N'来料检验', N'商品类型', N'规格型号')
ORDER BY col_name;

-- bs_inv 全部列(确认是否有其它自定义字段落列)
SELECT c.column_id, c.name AS 列名, t.name AS 类型, c.max_length / 2 AS 字符数
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_inv') ORDER BY c.column_id;
