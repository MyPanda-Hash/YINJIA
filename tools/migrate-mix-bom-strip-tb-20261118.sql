-- ============================================================================
-- 混料物料清单(MIX_BOM)「产品编号」去掉末尾 -tb 后缀(2026-11-18)
--
-- 用户口径(2026-11-18,截图 MIX-2026-11-0002):
--   「混料产品编码需要把末尾的-tb过滤了」
--
-- 背景:烧结工艺清单(RD_MOLD_PROC)/X烧结工艺清单(RD_X_SINTER)的「产品编号」按前端口径
--   带 -tb 后缀(core/panel/productCodeSuffix.js:只有 RD_MOLD_PROC 加,写法 `<原值>-tb`),
--   那是**单据上的产品键写法**;混料物料清单是基础数据,产品编号必须是**原始产品编码**
--   (A-48-41,不是 A-48-41-tb),否则与产品信息表 / 组装物料清单 / 商品档案对不上。
--
-- 本脚本只改**存量数据**:把 bs_mix_bom.产品编号 结尾的 -tb 剥掉。
--   代码侧同批修复:ProcBomArchiveSyncService.syncSinterProc 在写库前用
--   DevTaskService.baseProductCode(同一套规则:只剥结尾一层、大小写不敏感、去空格)归一化,
--   以后再归档的单直接写不带 -tb 的值。
--
-- 幂等:只 UPDATE 结尾带 -tb 的行,重跑影响 0 行。
-- 两账套:HSDZ_MES(正式)先、HSDZ_MES_TEST(测试)后,在 tools 目录执行:
--   java -cp lib/mssql-jdbc.jar DbSync.java run migrate-mix-bom-strip-tb-20261118.sql
--   YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run migrate-mix-bom-strip-tb-20261118.sql
-- ============================================================================
SET NOCOUNT ON;
GO

-- 0. 改前快照(只读)
PRINT N'== 0. 改前:混料物料清单里产品编号带 -tb 的行 ==';
SELECT 单据编号, 产品编号, 烧结类型, 来源单号, COUNT(*) AS rows_cnt
  FROM dbo.bs_mix_bom
 WHERE 产品编号 LIKE N'%-tb' AND LEN(RTRIM(产品编号)) > 3
 GROUP BY 单据编号, 产品编号, 烧结类型, 来源单号
 ORDER BY 单据编号;
GO

-- 1. 去掉结尾 -tb(大小写不敏感;只剥一层,与 baseProductCode 同口径)
DECLARE @n int;
UPDATE dbo.bs_mix_bom
   SET 产品编号 = RTRIM(LEFT(RTRIM(产品编号), LEN(RTRIM(产品编号)) - 3))
 WHERE 产品编号 LIKE N'%-tb' AND LEN(RTRIM(产品编号)) > 3;
SET @n = @@ROWCOUNT;
PRINT N'  影响行数(首次=带 -tb 的行数 / 重跑 0):' + CAST(@n AS nvarchar(10));
GO

-- 2. 列说明补一句(幂等:存在即更新为最新文案)
IF COL_LENGTH('dbo.bs_mix_bom', '产品编号') IS NOT NULL
  EXEC sp_updateextendedproperty N'MS_Description',
    N'产品编号(取自烧结单表头「产品编号」,**写入前去掉末尾 -tb 后缀** —— 单据上是 <原值>-tb,基础数据存原始产品编码;与 烧结类型 一起作为本表的定位键)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'产品编号';
GO

-- 3. 自检:不得再有结尾 -tb;同 产品编号+烧结类型 若有多张单只提示不阻断(允许历史多版本)
DECLARE @left int, @dup int;
SELECT @left = COUNT(*) FROM dbo.bs_mix_bom WHERE 产品编号 LIKE N'%-tb' AND LEN(RTRIM(产品编号)) > 3;
SELECT @dup = COUNT(*) FROM (
    SELECT 产品编号, 烧结类型 FROM dbo.bs_mix_bom
     WHERE ISNULL(asp_cancel,'N') <> 'Y'
     GROUP BY 产品编号, 烧结类型 HAVING COUNT(DISTINCT 单据编号) > 1
) x;
PRINT N'== 3. 自检: 仍带 -tb 的行=' + CAST(@left AS nvarchar(10))
    + N' / 同产品+烧结类型多张单的组合=' + CAST(@dup AS nvarchar(10));
IF @left > 0 RAISERROR(N'混料物料清单仍有产品编号带 -tb,归一化未完成', 16, 1);
GO

-- 4. 改后快照
PRINT N'== 4. 改后:混料物料清单全部单据 ==';
SELECT 单据编号, 产品编号, 产品名称, 烧结类型, 来源单号, COUNT(*) AS rows_cnt
  FROM dbo.bs_mix_bom
 GROUP BY 单据编号, 产品编号, 产品名称, 烧结类型, 来源单号
 ORDER BY 单据编号;
GO
PRINT N'[PASS] 混料物料清单产品编号已去掉 -tb 后缀';
GO
