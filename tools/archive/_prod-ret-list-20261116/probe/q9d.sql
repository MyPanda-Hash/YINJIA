SET NOCOUNT ON;
SELECT 'TEST_RET|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) FROM bd_material_ret;
SELECT TOP 6 'TEST_RETDOC|' + 单据编号 + '|' + ISNULL(业务类型,N'') + '|' + ISNULL(加工单号,N'') + '|' + ISNULL(单据状态,N'') FROM bd_material_ret ORDER BY id DESC;
SELECT 'TEST_INH13|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) FROM inh WHERE src=13;
