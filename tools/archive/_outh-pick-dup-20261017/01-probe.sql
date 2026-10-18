/* 只读取证:outh (src=6,rid=579) 唯一键冲突 & 生产领料流水来源 */
SET NOCOUNT ON;

PRINT N'== A. outh 唯一索引定义 ==';
SELECT i.name, i.is_unique, i.has_filter, i.filter_definition,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS key_cols
  FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.outh') AND i.is_unique = 1;

PRINT N'== B. 冲突行:outh src=6 rid=579 ==';
SELECT TOP 5 id, src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 仓库编码, 批号, 数量,
       工单号, 工单项次, 订单号, 成本单价, 成本金额, asp_user1, asp_user3, 审核, asp_cancel,
       CONVERT(varchar(19), asp_time1, 120) AS 写入时间
  FROM dbo.outh WHERE src = 6 AND rid = 579;

PRINT N'== C. 单据类型分布(outh)==';
SELECT 单据类型, src, COUNT(*) AS 行数, MIN(单据编号) AS 样例单号
  FROM dbo.outh GROUP BY 单据类型, src ORDER BY src;

PRINT N'== D. 生产领料流水样本 ==';
SELECT TOP 20 id, src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 批号, 数量,
       工单号, 工单项次, asp_user1, asp_user3, CONVERT(varchar(19), asp_time1, 120) AS 写入时间
  FROM dbo.outh WHERE 单据类型 = N'生产领料' ORDER BY id DESC;

PRINT N'== E. 生产领料按单号统计(有无同单多行/同rid重复)==';
SELECT COUNT(*) AS 行数, COUNT(DISTINCT 单据编号) AS 单数,
       SUM(CASE WHEN 工单号 IS NULL OR RTRIM(工单号) = '' THEN 1 ELSE 0 END) AS 无工单号行
  FROM dbo.outh WHERE 单据类型 = N'生产领料';

PRINT N'== F. bl_material_out id=579 / 单号 SCLL-20261004-00011 ==';
SELECT TOP 5 id, 单据编号, 材料编码, 数量, 批号, 加工单号 FROM dbo.bl_material_out WHERE id = 579;
SELECT TOP 5 单据编号, 单据日期, 加工单号, 工单行号, 领用人, 单据状态
  FROM dbo.bd_material_out WHERE 单据编号 = N'SCLL-20261004-00011';

PRINT N'== G. plang_pc id=579 ==';
SELECT TOP 1 * FROM dbo.plang_pc WHERE id = 579;

PRINT N'== H. 库内含 plang_pc + outh 的模块(存储过程/触发器/函数/视图)==';
SELECT o.type_desc, o.name FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
 WHERE m.definition LIKE '%plang_pc%' AND (m.definition LIKE '%outh%' OR m.definition LIKE '%OUTH%');

PRINT N'== I. outh 上的触发器 ==';
SELECT name, is_disabled FROM sys.triggers WHERE parent_id = OBJECT_ID('dbo.outh');

PRINT N'== J. 含 “INSERT INTO outh” 的模块(全部)==';
SELECT o.type_desc, o.name FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
 WHERE m.definition LIKE '%INSERT INTO outh%' OR m.definition LIKE '%INSERT INTO dbo.outh%';
