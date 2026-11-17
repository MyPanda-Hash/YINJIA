SET NOCOUNT ON;
SELECT 'RET|' + 单据编号 + '|' + CONVERT(VARCHAR(10), 单据日期, 120) + '|' + ISNULL(业务类型,N'') + '|' + ISNULL(加工单号,N'') + '|' + ISNULL(单据状态,N'') + '|' + ISNULL(asp_user1,N'')
FROM bd_material_ret ORDER BY id DESC;
