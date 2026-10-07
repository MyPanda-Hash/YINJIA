-- 临时探针:商品·来料检验拉取后核对(真实账套 359205/3852 商品)—— sync --refresh=BD_MATERIAL 之后跑
SET NOCOUNT ON;

SELECT N'① bs_inv 行数' AS 项, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM bs_inv
UNION ALL SELECT N'② 金蝶同步行', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 外部数据ID IS NOT NULL
UNION ALL SELECT N'③ 来料检验=是', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 来料检验 = N'是'
UNION ALL SELECT N'④ 来料检验 非空', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N''
UNION ALL SELECT N'⑤ 带自定义字段复核戳的指纹行(应=近31天改动数)',
       CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 外部指纹 LIKE N'%|CF%';

SELECT 存货编码, 存货名称, 来料检验, ERP更新时间, 外部数据ID
FROM bs_inv WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N'' ORDER BY 存货编码;
