-- 探针7:计数确认剩余 key
SET NOCOUNT ON;
SELECT t.scope + N' :: ' + t.ref_key + N' :: n=' + CAST(COUNT(*) AS nvarchar(3)) + N' :: ' + ISNULL(MAX(CASE t.locale WHEN 'en' THEN t.text END), N'(无en)')
FROM yj_translation t
WHERE (t.scope='field' AND t.ref_key IN (N'联系人',N'供应商名称',N'供应商级别',N'业务员编码',N'业务员名称',N'业务员',N'客户编码',N'供应商编码'))
   OR (t.scope='panel' AND t.ref_key IN (N'业务员档案',N'供应商档案',N'厂商档案'))
GROUP BY t.scope, t.ref_key ORDER BY t.ref_key;
