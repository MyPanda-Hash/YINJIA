-- 临时探针:INV 面板「来料检验」字段注册现状 + bs_inv 取值分布(回填前)
SET NOCOUNT ON;
SELECT panel_code, place, seq, col_name, label, data_type, editable, hidden, visible,
       ISNULL(alias, N'') AS alias, ISNULL(dict_sql, N'') AS dict_sql
FROM yj_field WHERE col_name = N'来料检验' ORDER BY panel_code, place, seq;

SELECT N'① bs_inv 总行' AS 项, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM bs_inv
UNION ALL SELECT N'② 金蝶同步行', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 外部数据ID IS NOT NULL
UNION ALL SELECT N'③ 本地手录/非同步行', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 外部数据ID IS NULL
UNION ALL SELECT N'④ 来料检验=是', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 来料检验 = N'是'
UNION ALL SELECT N'⑤ 来料检验 空/NULL(待回填否)', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv
       WHERE 来料检验 IS NULL OR LTRIM(RTRIM(来料检验)) = N''
UNION ALL SELECT N'⑥ 其它取值(既非是也非否)', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv
       WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N'' AND 来料检验 NOT IN (N'是', N'否');

SELECT 来料检验, COUNT(*) AS 行数 FROM bs_inv GROUP BY 来料检验 ORDER BY 行数 DESC;
