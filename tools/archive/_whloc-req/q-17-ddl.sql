SET NOCOUNT ON;
PRINT N'=== 1. bs_wh 关键列(自增/可空/默认值) ===';
SELECT c.name AS 列, ty.name AS 类型, c.max_length AS 长, c.is_nullable AS 可空,
       COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') AS 自增,
       ISNULL(dc.definition, N'') AS 默认值
FROM sys.columns c
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh') AND c.name IN ('id','仓库编码','仓库名称','仓库地址','负责人','停用','允许零库存出库','备注','状态','仓库类型','asp_user1','asp_time1','asp_cancel')
ORDER BY c.column_id;
GO
PRINT N'=== 2. 现存仓库的 状态/仓库类型 取值(照抄口径) ===';
SELECT 仓库编码, 仓库名称, 状态, ISNULL(仓库类型,N'(null)') AS 仓库类型, 允许零库存出库, asp_user1 FROM dbo.bs_wh ORDER BY 仓库编码;
GO
PRINT N'=== 3. bs_wh_loc 现有列(准备追加层次列) ===';
SELECT c.name AS 列, ty.name AS 类型, c.max_length AS 长 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh_loc') AND c.name NOT LIKE N'备用%' ORDER BY c.column_id;
GO
PRINT N'=== 4. 待新增字段标签的译名现状(避免 uq_translation 撞键) ===';
SELECT ref_key, scope, locale, text FROM yj_translation
WHERE ref_key IN (N'厂区', N'库区', N'排号', N'位号', N'层号') ORDER BY ref_key, locale;
SELECT label, COUNT(*) AS 已有面板数 FROM yj_field WHERE label IN (N'厂区', N'库区', N'排号', N'位号', N'层号') GROUP BY label;
GO