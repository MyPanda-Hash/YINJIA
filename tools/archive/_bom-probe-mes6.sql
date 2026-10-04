-- 探针:SO_ORDER 字段 place 约定 + 待建字段标签的既有 en 译名情况
SELECT '=== 1. SO_ORDER 字段 place 分布 ===' AS x;
SELECT place, COUNT(*) AS n FROM yj_field WHERE panel_code = 'SO_ORDER' GROUP BY place;
GO
SELECT '=== 2. SO_ORDER 表头字段样例 ===' AS x;
SELECT TOP 8 seq, col_name, label, data_type, place, editable, required, visible, hidden FROM yj_field WHERE panel_code = 'SO_ORDER' ORDER BY seq;
GO
SELECT '=== 3. BOM_KD / BOM单 是否已存在 ===' AS x;
SELECT panel_code, panel_name FROM yj_panel WHERE panel_code = 'BOM_KD' OR panel_name IN (N'BOM单');
GO
SELECT '=== 4. 各拟用标签的 en 译名现状(有则复用) ===' AS x;
SELECT t.ref_key, t.text FROM yj_translation t WHERE t.scope='field' AND t.locale='en' AND t.ref_key IN (
 N'单据编号',N'产品编码',N'产品名称',N'版本号',N'成品率',N'BOM备注',N'审核状态',N'是否启用',N'数据来源',
 N'产品单位',N'基本单位',N'辅助属性',N'属性组1',N'属性组2',N'属性组3',N'属性组4',N'属性组5',
 N'跳过该层级领用下级物料',N'审核人',N'审核时间',N'行号',N'子料编码',N'子料名称',N'子料单位',N'子料基本单位',
 N'材料用量',N'产品产量',N'单位用量',N'损耗率',N'固定损耗',N'发料方式',N'关键件',N'替代件',N'工位',
 N'发料仓库',N'发料仓库编码',N'发料仓位',N'发料仓位编码',N'物料备注',N'物料备注1',N'物料备注2',N'物料备注3',
 N'产品单位编码',N'基本单位编码',N'辅助属性编码',N'状态',N'停用',N'创建人',N'创建时间',N'修改人',N'修改时间');
GO
SELECT '=== 5. BOM单 panel 译名现状 ===' AS x;
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key = N'BOM单';
