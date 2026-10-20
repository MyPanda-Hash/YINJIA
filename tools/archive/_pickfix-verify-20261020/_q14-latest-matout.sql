SET NOCOUNT ON;
SELECT TOP 6 单据编号, 单据日期, 业务类型, 仓库, 加工单号, asp_time1 FROM dbo.bd_material_out ORDER BY id DESC;
