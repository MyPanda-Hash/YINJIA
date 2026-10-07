-- migrate-inv-inspection-default-no.sql — 商品·来料检验 口径落定:未填写(空)= 否(2026-10-03)
-- 用户口径:「金蝶自定义字段新增的第 4 个字段 = 来料检验;拉下来后,没有填写是的默认为否」。
-- 背景:金蝶侧该字段是文本(值 是/否),未勾选时接口回**空串** ⇒ 同步器把空串写成 NULL,
--       界面上就是一片空白。本脚本把存量空值统一回填「否」,同步器侧同口径改造
--       (sync-core.mjs 的 cfInspection:登记键里取不到「是」即写「否」),此后不再产生空值。
-- 执行前现状(2026-10-03):bs_inv 3874 行 = 金蝶同步 3852 + 本地手录/非同步 22;
--       来料检验 = 是 9 行(含金蝶已勾选的 8 个商品)、空 3865 行、其它取值 0 行。
-- 幂等(重跑只见 0 行受影响),两个账套都执行。
SET NOCOUNT ON;
GO

-- ══ 1) 空值回填「否」(已填「是」的一律不动) ══
DECLARE @n int;
UPDATE bs_inv SET 来料检验 = N'否'
WHERE 来料检验 IS NULL OR LTRIM(RTRIM(来料检验)) = N'';
SET @n = @@ROWCOUNT;
PRINT N'[inv-inspection] 空值回填「否」:' + CAST(@n AS nvarchar(20)) + N' 行';
GO

-- ══ 2) 默认约束:以后新插入且**未带该列**的商品行自动落「否」(与口径一致) ══
-- 注:默认约束只在 INSERT 省略该列时生效;显式写 NULL 仍会是 NULL(同步器每次都显式写值,不受影响)。
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.bs_inv')
               AND name = N'DF_bs_inv_来料检验')
  ALTER TABLE dbo.bs_inv ADD CONSTRAINT DF_bs_inv_来料检验 DEFAULT N'否' FOR 来料检验;
PRINT N'[inv-inspection] 默认约束 DF_bs_inv_来料检验 就绪';
GO

-- ══ 3) 列注明补「未填写=否」口径(注明即契约,别只留在代码注释里) ══
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('dbo.bs_inv')
             AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_inv'), N'来料检验', 'ColumnId')
             AND name = N'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'来料检验(金蝶商品自定义字段同步,值 是/否;未填写=否 —— 2026-10-03 用户口径;金蝶界面维护,MES只读)',
    N'schema', N'dbo', N'table', N'bs_inv', N'column', N'来料检验';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
    N'来料检验(金蝶商品自定义字段同步,值 是/否;未填写=否 —— 2026-10-03 用户口径;金蝶界面维护,MES只读)',
    N'schema', N'dbo', N'table', N'bs_inv', N'column', N'来料检验';
GO

-- ══ 自检:空值必须为 0 ══
SELECT N'来料检验=是' AS 项, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM bs_inv WHERE 来料检验 = N'是'
UNION ALL SELECT N'来料检验=否', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv WHERE 来料检验 = N'否'
UNION ALL SELECT N'仍为空(应为 0)', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv
      WHERE 来料检验 IS NULL OR LTRIM(RTRIM(来料检验)) = N''
UNION ALL SELECT N'其它取值(应为 0)', CAST(COUNT(*) AS nvarchar(20)) FROM bs_inv
      WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N'' AND 来料检验 NOT IN (N'是', N'否');
PRINT N'商品·来料检验「未填写=否」口径落定完成';
GO
