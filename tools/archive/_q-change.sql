-- _q-change.sql —— 产品变更申请单(RD_CHANGE)开工前查库:部门映射 + 表结构 + 现有账号
SET NOCOUNT ON;
SELECT 'yj_user.cols' AS q, name FROM sys.columns WHERE object_id = OBJECT_ID('yj_user') ORDER BY column_id;
GO
SELECT 'yj_dept.cols' AS q, name FROM sys.columns WHERE object_id = OBJECT_ID('yj_dept') ORDER BY column_id;
GO
SELECT 'yj_field.cols' AS q, name FROM sys.columns WHERE object_id = OBJECT_ID('yj_field') ORDER BY column_id;
GO
SELECT 'rd_change_head.cols' AS q, name, TYPE_NAME(user_type_id) AS t, max_length FROM sys.columns WHERE object_id = OBJECT_ID('rd_change_head') ORDER BY column_id;
GO
SELECT 'rd_change_detail.cols' AS q, name, TYPE_NAME(user_type_id) AS t, max_length FROM sys.columns WHERE object_id = OBJECT_ID('rd_change_detail') ORDER BY column_id;
GO
