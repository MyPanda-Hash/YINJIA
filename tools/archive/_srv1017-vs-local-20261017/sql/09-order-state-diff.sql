SET NOCOUNT ON;
PRINT '=== 销售订单 出入库/关闭状态 不一致 ===';
SELECT l.单据编号, l.出入库状态 AS 本地出入库, s.出入库状态 AS 服务器出入库, l.单据关闭状态 AS 本地关闭, s.单据关闭状态 AS 服务器关闭
FROM HSDZ_MES.dbo.bd_so_order l JOIN HSDZ_MES_SRV1017.dbo.bd_so_order s ON s.单据编号=l.单据编号
WHERE ISNULL(l.出入库状态,'')<>ISNULL(s.出入库状态,'') OR ISNULL(l.单据关闭状态,'')<>ISNULL(s.单据关闭状态,'')
ORDER BY l.单据编号;
PRINT '=== 采购订单 入库/关闭状态 不一致 ===';
SELECT l.单据编号, l.[入库状态Z部分入库，C全部入库，A未入库] AS 本地入库, s.[入库状态Z部分入库，C全部入库，A未入库] AS 服务器入库, l.关闭状态 AS 本地关闭, s.关闭状态 AS 服务器关闭
FROM HSDZ_MES.dbo.bd_pu_order l JOIN HSDZ_MES_SRV1017.dbo.bd_pu_order s ON s.单据编号=l.单据编号
WHERE ISNULL(l.[入库状态Z部分入库，C全部入库，A未入库],'')<>ISNULL(s.[入库状态Z部分入库，C全部入库，A未入库],'') OR ISNULL(l.关闭状态,'')<>ISNULL(s.关闭状态,'')
ORDER BY l.单据编号;
