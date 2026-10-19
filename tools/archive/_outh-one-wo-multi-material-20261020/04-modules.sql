/* 只读取证:库内有没有"扫码领料"的存储过程/触发器/视图在写 outh */
SET NOCOUNT ON;

PRINT N'== A. 含 INSERT ... outh 的所有模块 ==';
SELECT o.type_desc AS 类型, o.name AS 名称, CONVERT(varchar(19), o.modify_date, 120) AS 修改时间
  FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
 WHERE m.definition LIKE '%INSERT INTO%outh%' OR m.definition LIKE '%INSERT%dbo.outh%' OR m.definition LIKE '%outh%'
 ORDER BY o.type_desc, o.name;

PRINT N'== B. 名字/正文带「领料」「扫码」的模块 ==';
SELECT o.type_desc AS 类型, o.name AS 名称
  FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
 WHERE m.definition LIKE N'%领料%' OR m.definition LIKE N'%扫码%' OR o.name LIKE N'%pick%' OR o.name LIKE N'%scan%';

PRINT N'== C. outh/inh 上的触发器 ==';
SELECT t.name AS 触发器, OBJECT_NAME(t.parent_id) AS 表, t.is_disabled AS 禁用 FROM sys.triggers t
 WHERE t.parent_id IN (OBJECT_ID('dbo.outh'), OBJECT_ID('dbo.inh'));

PRINT N'== D. 用户存储过程清单(排掉系统)==';
SELECT name, CONVERT(varchar(19), modify_date, 120) AS 修改时间 FROM sys.procedures ORDER BY modify_date DESC;
