SET NOCOUNT ON;
PRINT N'=== 部门档案 bs_dept 列宽 ===';
SELECT c.name, t.name AS dtype, c.max_length/2 AS 字符数 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_dept') AND c.name IN (N'部门编码',N'部门名称');
GO
PRINT N'=== 各单 部门/部门编码/部门名称 列宽(比对) ===';
SELECT OBJECT_NAME(c.object_id) AS 表, c.name AS 列, t.name AS 类型, c.max_length/2 AS 字符数
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.name IN (N'部门',N'部门编码',N'部门名称') AND OBJECT_NAME(c.object_id) IN
 ('qc_insp','qc_recv','qc_insp_detail','sl_recv','sl_recv_detail','purchase_in','bl_purchase_in','bd_purchase_in','material_out')
ORDER BY 表, 列;
GO
