SET NOCOUNT ON;
SELECT 单据编号, COUNT(*) n FROM qc_insp_commission_detail GROUP BY 单据编号;
SELECT id, 单据编号, 单据日期, 联系人, 样品名称, 合计收费 FROM qc_insp_commission_head;
SELECT TOP 20 单据编号, 行号, 检测元素, 测试方法, 收费 FROM qc_insp_commission_detail ORDER BY id;
GO
