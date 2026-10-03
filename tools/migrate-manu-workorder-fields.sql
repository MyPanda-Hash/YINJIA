-- migrate-manu-workorder-fields.sql — 生产工单列表字段对齐(2026-09-24 用户拍板)
-- 依据:用户 2026-09-24 给的字段清单(旧系统 工单明细表口径),「基本保留这些」。
--   ①列表(query)列收敛为 16 列并按其顺序排 seq:工单号(合同号)/工单日期(单据日期)/客户订单号(销售订单号)/
--     客户编码/已排生产线(生产线)/需求数量/已排数量(排产数量)/完工数量(入库数量)/未入库量(余量)/
--     开始日期(预开工日)/完工日期(预完工日)/实际完工日期(完工日期)/结案/领料单号/备注/创建时间;
--   ②**标签名保持现状**(括号内=现用名)。原因:yj_field.label 同时是前后端**数据键**(PanelConfigService
--     dataName=f.label();PanelRegistry.labelToCol/byLabel),改名会波及 QuickScheduleService(生单/排产写值)、
--     ManuSplitHandler(拆单写值)、OrderConvertService、PanelConfigService 头字段映射(SO→MANU、MANU→FINISH_IN)、
--     前端打印工单二维码等 10+ 处按标签取值点,漏改即静默丢数。故本迁移只做「列集+顺序」;
--     标签改名(如 排产数量→已排数量)留作独立任务,需连同上述读写点一并改并全链探针验证。
--   ③不在清单内的原列表字段(批号/混料批次号/首件完成/重点管控/模具类型/测试程序/源工单号/客户)
--     退出列表、保留在表单(place 改 header),信息不丢;
--   ④补两列注册:备注(可编辑文本)、创建时间(asp_time1,只读);
--   ⑤清 yj_field 重复行(批号×3/重点管控×2/模具类型×2,多次迁移叠加所致);
--   ⑥自愈:需求数量/排产数量/入库数量/余量 在 detail 与 query,header 各有一行(同列两处配置),
--     定序 UPDATE 必须带 place 守卫,否则会把两行都写成列表位(本脚本初版曾如此,已修并可自愈)。
-- 引擎口径:MANU_ORDER mode=doc(头行单据)→ 列表只能显示头表列;物料编码/产品名称/规格/计量单位/工单行号等
--   行级字段在表单「产成品明细」页签(place=detail),不进列表;未排数量(需求−已排)、是否领料(领料单号非空)、
--   订单行号(form_flow_link)为派生值,头表无列,暂不在列表呈现。
-- 幂等:UPDATE/IF NOT EXISTS,可重复执行(含自愈块)。
SET NOCOUNT ON;

-- ⑥ 自愈:同列出现两行都在列表位时,把高 id 那行还原为明细位(仅在重复时生效;新库不受影响)
;WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY col_name ORDER BY id) AS rn,
         COUNT(*) OVER (PARTITION BY col_name) AS cnt
  FROM yj_field
  WHERE panel_code = 'MANU_ORDER'
    AND col_name IN (N'需求数量', N'排产数量', N'入库数量', N'余量')
    AND place LIKE '%query%'
)
UPDATE f SET place = N'detail',
             seq = CASE f.col_name WHEN N'需求数量' THEN 310 WHEN N'排产数量' THEN 320
                                   WHEN N'入库数量' THEN 330 ELSE 340 END
FROM yj_field f JOIN dup d ON d.id = f.id
WHERE d.cnt > 1 AND d.rn > 1;

-- ⑤ 清重复行(同 panel+col_name+place 仅留最小 id)
;WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY panel_code, col_name, place ORDER BY id) AS rn
  FROM yj_field WHERE panel_code = 'MANU_ORDER'
)
DELETE FROM yj_field WHERE id IN (SELECT id FROM d WHERE rn > 1);

-- ① 列表列定序(标签不动;带 place 守卫,只动列表位那行,不碰明细位配置)
UPDATE yj_field SET seq = 5,  visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'合同号'     AND place LIKE '%query%';
UPDATE yj_field SET seq = 10, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'单据日期'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 15, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'销售订单号' AND place LIKE '%query%';
UPDATE yj_field SET seq = 20, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'客户编码'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 25, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'生产线'     AND place LIKE '%query%';
UPDATE yj_field SET seq = 30, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'需求数量'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 35, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'排产数量'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 40, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'入库数量'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 45, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'余量'       AND place LIKE '%query%';
UPDATE yj_field SET seq = 50, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'预开工日'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 55, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'预完工日'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 60, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'完工日期'   AND place LIKE '%query%';
UPDATE yj_field SET seq = 65, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'结案'       AND place LIKE '%query%';
UPDATE yj_field SET seq = 70, visible = 1, place = N'query,header' WHERE panel_code='MANU_ORDER' AND col_name = N'领料单号'   AND place LIKE '%query%';

-- ③ 不在清单内的列表字段退出列表(保留表单)
UPDATE yj_field SET place = N'header' WHERE panel_code='MANU_ORDER' AND place = N'query,header'
  AND col_name IN (N'批号', N'混料批次号', N'首件完成', N'重点管控', N'模具类型', N'测试程序', N'源工单号', N'客户');

-- ④ 补注册:备注(可编辑) + 创建时间(只读;数据键=物理列 asp_time1)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name = N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, label_en)
  VALUES ('MANU_ORDER', N'备注', N'备注', N'文本', N'query,header', 75, 120, 1, 0, 0, 1, N'Remark');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name = N'asp_time1')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, label_en)
  VALUES ('MANU_ORDER', N'asp_time1', N'创建时间', N'文本', N'query,header', 80, 130, 0, 0, 0, 1, N'Created at');

UPDATE yj_field SET label_en = N'Remark'     WHERE panel_code='MANU_ORDER' AND col_name = N'备注';
UPDATE yj_field SET label_en = N'Created at' WHERE panel_code='MANU_ORDER' AND col_name = N'asp_time1';

-- 校验:列表列(应 16 行、无重复)+ 明细位配置仍在
SELECT N'列表列' AS 检查, col_name, label, seq FROM yj_field
WHERE panel_code='MANU_ORDER' AND place LIKE '%query%' ORDER BY seq;
SELECT N'明细位数' AS 检查, COUNT(*) AS n FROM yj_field WHERE panel_code='MANU_ORDER' AND place LIKE '%detail%';
PRINT N'migrate-manu-workorder-fields 完成';
GO
