/* 只读取证:v_stock_pick 是什么(谁建的、怎么算的) */
SET NOCOUNT ON;

PRINT N'== A. v_stock_pick 定义 ==';
SELECT m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_stock_pick');

PRINT N'== B. 所有视图(按修改时间倒序,看最近新增)==';
SELECT name, CONVERT(varchar(19), modify_date, 120) AS 修改时间, create_date AS 创建时间
  FROM sys.views ORDER BY modify_date DESC;

PRINT N'== C. 名字带 pick/领料的视图/表 ==';
SELECT o.type_desc, o.name FROM sys.objects o
 WHERE o.name LIKE '%pick%' OR o.name LIKE N'%领料%' OR o.name LIKE '%Pick%';

PRINT N'== D. 用户存储过程(非 dt_/sp_)==';
SELECT name, CONVERT(varchar(19), modify_date, 120) AS 修改时间 FROM sys.procedures
 WHERE name NOT LIKE 'dt[_]%' AND name NOT LIKE 'sp[_]%' ORDER BY modify_date DESC;
