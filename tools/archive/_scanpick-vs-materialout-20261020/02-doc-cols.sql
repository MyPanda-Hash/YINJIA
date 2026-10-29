/* 只读:认领方案能不能「照抄流水成单据」—— 先看单据头/行有没有这些字段 */
SET NOCOUNT ON;

PRINT N'== A. bl_material_out 列 ==';
SELECT c.name AS 列, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bl_material_out') ORDER BY c.column_id;

PRINT N'== B. bd_material_out 列(只看业务键,不看备用/审计) ==';
SELECT c.name AS 列, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bd_material_out')
   AND c.name NOT LIKE N'备用%' ORDER BY c.column_id;
