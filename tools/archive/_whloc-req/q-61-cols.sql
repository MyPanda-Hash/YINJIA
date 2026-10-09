SET NOCOUNT ON;
PRINT N'=== A. bs_wh_loc 全部列(找 厂区/库区/存储分区 三个) ===';
SELECT c.column_id AS 序, c.name AS 列名, t.name AS 类型
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh_loc') ORDER BY c.column_id;
GO
PRINT N'=== B. 三个列的数据现状(含量非空行数) ===';
SELECT N'厂区 非空' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM bs_wh_loc WHERE 厂区 IS NOT NULL
UNION ALL SELECT N'库区 非空', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE 库区 IS NOT NULL
UNION ALL SELECT N'存储分区 非空', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE 存储分区 IS NOT NULL
UNION ALL SELECT N'总行数', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc;
GO

PRINT N'=== C. 实测:T-SQL 对「未执行分支里引用不存在的列」是否报编译错 ===';
IF COL_LENGTH('dbo.bs_wh_loc', N'这个列不存在') IS NOT NULL
  SELECT N'分支里引用了不存在的列' AS 说明, 这个列不存在 FROM bs_wh_loc;
PRINT N'  ↑ 若本批报 Invalid column name 说明会编译期失败;若打印本行说明只在运行期求值';
GO
