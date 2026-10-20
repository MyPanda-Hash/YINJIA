SELECT COUNT(*) AS CK00001存在 FROM bs_wh WHERE 仓库编码 = 'CK00001';
GO
SELECT 仓库编码, 仓库名称, 停用, asp_cancel FROM bs_wh WHERE 仓库编码 IN ('CK00001','CK-A','YJ-08') ;
GO
