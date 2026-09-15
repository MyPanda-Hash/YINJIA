-- 探针6:剩余候选 key 的翻译行
SET NOCOUNT ON;
SELECT t.scope + N' :: ' + t.ref_key + N' :: ' + t.locale + N' :: ' + t.text
FROM yj_translation t
WHERE (t.scope='field' AND t.ref_key IN (N'客户名称',N'联系人',N'供应商名称',N'供应商级别',N'业务员编码',N'业务员名称',N'业务员',N'姓名',N'客户级别',N'厂商代码',N'厂商名称'))
   OR (t.scope='panel' AND t.ref_key IN (N'客户档案',N'业务员档案'))
ORDER BY t.ref_key, t.locale;
