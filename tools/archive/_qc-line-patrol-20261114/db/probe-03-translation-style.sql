/* probe-03-translation-style.sql — 只读:同源标签的既有 en 译名(保持风格一致) */
SET NOCOUNT ON;
PRINT '=== [1] 相关标签既有 en 译名 ===';
SELECT ref_key, text FROM yj_translation
WHERE scope = N'field' AND locale = N'en' AND ref_key IN (
  N'型号', N'规格型号', N'编号', N'样品序号', N'产品编码', N'长度', N'内径', N'重量',
  N'结果判断', N'判定', N'结果', N'表面状态', N'跌落强度', N'抗压强度', N'密度', N'人员', N'检验员', N'车间')
ORDER BY ref_key;

PRINT '=== [2] 形如 长度标准1 的既有标签(看命名习惯) ===';
SELECT ref_key, text FROM yj_translation
WHERE scope = N'field' AND locale = N'en' AND (ref_key LIKE N'%标准%' OR ref_key LIKE N'%实测%')
ORDER BY ref_key;

PRINT '=== [3] 面板译名既有 en 样例(品质类) ===';
SELECT ref_key, text FROM yj_translation
WHERE scope = N'panel' AND locale = N'en' AND ref_key IN (N'首件检验单', N'出厂检验报告', N'出货检验单功能', N'出货检验表观', N'检验目录');

PRINT '=== [4] qc_ 表实测张数(台账列数对照) ===';
SELECT COUNT(*) AS qc表数 FROM sys.tables WHERE name LIKE N'qc[_]%';
SELECT name FROM sys.tables WHERE name LIKE N'qc[_]%' ORDER BY name;
GO
