-- bd_manu_order.合同号 类型修复:date -> nvarchar(50)
-- 种子表结构错误:合同号(单号语义,YINJIA 以其为 MANU_ORDER 的 group_col)被建成 date,
-- 引擎保存(头表 upsert WHERE 合同号=? / INSERT)必然触发"从字符串转换日期失败"。
-- ALTER 隐式转换存量值(date -> 'YYYY-MM-DD' 字符串),单条语句保持 NOT NULL。
USE HSDZ_MES;
SET NOCOUNT ON;
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
           WHERE c.object_id = OBJECT_ID('bd_manu_order') AND c.name = N'合同号' AND ty.name = 'date')
  ALTER TABLE bd_manu_order ALTER COLUMN 合同号 nvarchar(50) NOT NULL;

-- 校验
SELECT c.name, ty.name AS type FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('bd_manu_order') AND c.name = N'合同号';
PRINT N'manu-contract-fix 完成';
