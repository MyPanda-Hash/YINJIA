SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 单据状态, 审核人, 审核时间, 审批人, 备注 FROM sl_recv ORDER BY 单据编号 DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;
