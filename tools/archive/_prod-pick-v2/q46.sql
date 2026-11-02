SET NOCOUNT ON;
SELECT 存货编码, 仓库, 仓库编码, ISNULL(批号,'<null>') 批号, 现存量 FROM v_stock_pick WHERE 存货编码 IN ('YJ-ZZ-001','YJ-KBL-012');
