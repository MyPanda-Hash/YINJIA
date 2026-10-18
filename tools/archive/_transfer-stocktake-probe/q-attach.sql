SET NOCOUNT ON;
SELECT seq, label, data_type, place, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code='PURCHASE_IN' AND (label LIKE N'附件%' OR label IN (N'ERP单号',N'是否已转ERP',N'转ERP操作人',N'转ERP时间',N'金蝶单据状态',N'金蝶审核人',N'金蝶审核时间',N'批次号'))
ORDER BY seq;
PRINT '=== 列类型 ===';
SELECT c.name, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bd_purchase_in') AND c.name IN (N'附件1',N'ERP单号',N'是否已转ERP',N'转ERP操作人',N'转ERP时间',N'金蝶单据状态',N'金蝶审核人',N'金蝶审核时间',N'批次号') ORDER BY c.name;
