SET NOCOUNT ON;
SELECT 存货编码, 存货名称, 检验方式, 是否来料检验 FROM bs_inv WHERE 存货编码 IN ('CL004','CL001') OR 存货名称 LIKE N'%切削液%';
SELECT COUNT(*) AS 总数 FROM bs_inv;
