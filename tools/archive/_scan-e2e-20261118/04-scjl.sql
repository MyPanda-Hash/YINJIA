SET NOCOUNT ON;
SELECT ISNULL(报工单号,N'') AS 报工单号, gldh AS 工单号, ISNULL(工单行号,0) AS 工单行号, gxdm AS 工序,
       sl AS 数量, ISNULL(wgzt,N'N') AS 完工, ISNULL(bz,N'') AS 备注, sc_date AS 日期
FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
