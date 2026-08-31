-- 清理 _doc_part3_data.sql 已插入的部分数据(asp_user1='migration' 标记),以便整文件重跑
USE HSDZ_MES;
SET NOCOUNT ON;
DELETE FROM bl_dispatch WHERE asp_user1 = 'migration';
DELETE FROM bd_dispatch WHERE asp_user1 = 'migration';
DELETE FROM bl_manu_order WHERE asp_user1 = 'migration';
DELETE FROM bd_manu_order WHERE asp_user1 = 'migration';
DELETE FROM bl_material_out WHERE asp_user1 = 'migration';
DELETE FROM bd_material_out WHERE asp_user1 = 'migration';
DELETE FROM bl_outsource_order WHERE asp_user1 = 'migration';
DELETE FROM bd_outsource_order WHERE asp_user1 = 'migration';
DELETE FROM bl_pu_order WHERE asp_user1 = 'migration';
DELETE FROM bd_pu_order WHERE asp_user1 = 'migration';
SELECT 'cleanup done' AS s;
