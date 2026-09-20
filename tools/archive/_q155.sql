SET NOCOUNT ON;
-- MES PURCHASE_IN 头表现有相关列
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_purchase_in') AND (c.name LIKE N'%订单%' OR c.name LIKE N'%检验%');
-- 行表
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND (c.name LIKE N'%订单%' OR c.name LIKE N'%检验%');
-- 面板字段注册
SELECT col_name, place FROM yj_field WHERE panel_code='PURCHASE_IN' AND (col_name LIKE N'%订单%' OR col_name LIKE N'%检验%');
