-- migrate-record-group-relabel-20261028.sql
-- 修「标准库下拉变无数据」—— 分组字段与表头字段同名,把表头字段的元数据顶掉了(2026-10-28)。
--
-- 现象(用户报):「这个标准库启用之后,并没有可以下拉」——「仪器名称/型号」副标题下拉展开是「无数据」,
--   而标准库维护弹窗里 3 条都显示「已启用」。
--
-- 根因(已实测):
--   ① migrate-record-group-20261028.sql 给三张行表补的分组字段**与表头字段同名**
--      (设备名称 / 仪器名称/型号 / 测试项目),data_type=文本、hidden=1;
--   ② 前端纸面字段集 = [...表头字段, ...明细字段](PanelxList.sheetAllFields),
--      而 RecordSheetPanels 的 fieldMap 按 dataName 建 Map ⇒ **后写覆盖** ⇒
--      同名的那一格取到的是"文本、无 options"的明细定义 ⇒ selectOptions() 返回 [] ⇒ 下拉「无数据」;
--   ③ 后端下发本身正常(正式账套该字段 options = 测试1/222/PH计-梅特勒FE28 三条都在)。
--
-- 改法:分组字段换 label(物理列名不动,仍是 设备名称 / 仪器名称/型号 / 测试项目):
--   RD_EQUIP_USE  : 设备名称        → 设备归属
--   RD_INSTR_USE  : 仪器名称/型号    → 仪器归属
--   RD_SPIKE_WATER: 测试项目        → 项目归属
--   这样表头字段与行归属字段在字段集里不再同名,下拉、参照、标准库维护都各取各的。
--   行模型里的键随 label 变(前端 groupBy.detailKey 同步改),保存仍按 label→col_name 落到原列。
--
-- 幂等:按 panel_code + place='detail' + 原 label 精确更新;两账套都要跑。
SET NOCOUNT ON;

UPDATE yj_field SET label = N'设备归属'
WHERE panel_code = 'RD_EQUIP_USE' AND place = 'detail' AND label = N'设备名称';
IF @@ROWCOUNT > 0 PRINT N'[OK] RD_EQUIP_USE 明细分组字段改名为「设备归属」';

UPDATE yj_field SET label = N'仪器归属'
WHERE panel_code = 'RD_INSTR_USE' AND place = 'detail' AND label = N'仪器名称/型号';
IF @@ROWCOUNT > 0 PRINT N'[OK] RD_INSTR_USE 明细分组字段改名为「仪器归属」';

UPDATE yj_field SET label = N'项目归属'
WHERE panel_code = 'RD_SPIKE_WATER' AND place = 'detail' AND label = N'测试项目';
IF @@ROWCOUNT > 0 PRINT N'[OK] RD_SPIKE_WATER 明细分组字段改名为「项目归属」';

-- 字段译名(多语言强制规范:新增显示词条至少给 en)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'设备归属' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'设备归属', 'en', N'Equipment (row owner)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'仪器归属' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器归属', 'en', N'Instrument (row owner)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'项目归属' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目归属', 'en', N'Test item (row owner)', 'manual');

-- 自检:三行都必须是新 label,且表头同名字段未被误改
SELECT panel_code, col_name, label, place, data_type, hidden
FROM yj_field
WHERE (panel_code = 'RD_EQUIP_USE' AND place = 'detail' AND label = N'设备归属')
   OR (panel_code = 'RD_INSTR_USE' AND place = 'detail' AND label = N'仪器归属')
   OR (panel_code = 'RD_SPIKE_WATER' AND place = 'detail' AND label = N'项目归属')
ORDER BY panel_code;
