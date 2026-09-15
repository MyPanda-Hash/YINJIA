-- 探针5:翻译缺口统计(按 key×locale 计数)
SET NOCOUNT ON;
SELECT t.scope + N' :: ' + t.ref_key + N' :: ' + t.locale + N' :: source=' + t.source
FROM yj_translation t
WHERE (t.scope='field' AND t.ref_key IN (N'客户编码',N'客户名称',N'联系人',N'供应商编码',N'供应商名称',N'供应商级别',N'到货地址',N'业务员编码',N'业务员名称',N'业务员',N'仓库编码'))
   OR (t.scope='panel' AND t.ref_key IN (N'供应商档案',N'厂商档案',N'客户档案',N'业务员档案',N'仓库档案'))
ORDER BY t.ref_key, t.locale;
GO
SELECT N'== zh-TW sample ==' AS m;
SELECT TOP 5 scope + N' :: ' + ref_key + N' :: source=' + source FROM yj_translation WHERE locale='zh-TW' ORDER BY ref_key;
