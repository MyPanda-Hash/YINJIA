SET NOCOUNT ON;
SELECT 单据编号, 物料编码, 数量, 入库数量, 仓库, 批次号 FROM sl_recv_detail
WHERE 单据编号 IN ('SL-2026-09-0189','SL-2026-10-0011','SL-2026-10-0131') AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号,id;
