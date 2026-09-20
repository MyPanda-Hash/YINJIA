-- _q_rail_i18n.sql — 左栏「单据选择」全部显示文案的译名覆盖核对(逐键 EN/JA)
SET NOCOUNT ON;
PRINT '── 左栏文案键 × 库表译名(en/ja;scope=ui|field|panel) ──';
SELECT v.k AS ref_key,
       MAX(CASE WHEN t.locale='en' THEN t.text END) AS en_text,
       MAX(CASE WHEN t.locale='ja' THEN t.text END) AS ja_text,
       COUNT(t.ref_key) AS hits
FROM (VALUES (N'单号'),(N'日期'),(N'客户'),(N'供应商'),(N'审核状态'),(N'共有数据'),(N'条'),
             (N'部门'),(N'输入搜索'),(N'查找'),(N'暂无数据'),(N'收起'),(N'拖动调整宽度'),(N'选择')) v(k)
LEFT JOIN yj_translation t ON t.ref_key = v.k AND t.locale IN ('en','ja') AND t.scope IN ('ui','field','panel')
GROUP BY v.k
ORDER BY v.k;
GO

PRINT '── 面板名译名:采购订单/销售订单(en/ja) ──';
SELECT ref_key,
       MAX(CASE WHEN locale='en' THEN text END) AS en_text,
       MAX(CASE WHEN locale='ja' THEN text END) AS ja_text
FROM yj_translation WHERE scope='panel' AND ref_key IN (N'采购订单', N'销售订单')
GROUP BY ref_key;
GO
