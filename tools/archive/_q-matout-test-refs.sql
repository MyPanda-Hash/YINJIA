SET NOCOUNT ON;
SELECT TOP 6 存货编码, 存货名称, 计量单位 FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND 存货编码 IS NOT NULL ORDER BY id;
GO
SELECT TOP 6 仓库编码, 仓库名称 FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
SELECT TOP 6 部门编码, 部门名称 FROM bs_dept WHERE ISNULL(asp_cancel,'N')<>'Y' AND 部门名称 LIKE N'%车间%' ORDER BY id;
GO
SELECT TOP 6 员工编码, 员工名称 FROM bs_emp WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
