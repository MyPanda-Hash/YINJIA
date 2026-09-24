-- _prodfix-metadata.sql — 生产域面板元数据补登记(一次性修复,2026-09-24)
-- 背景:下拉生产域分支后,本地两账套的 LINE_LOAD / MANU_SCHEDULE 面板字段注册缺失
--   (回滚期清理把生产面板元数据清空;PROD_LINE/OP_TIME/PROD_ABN 已随各自脚本恢复)。
-- 为什么不重跑原脚本:迁移链是**单向**的 —— migrate-manu-order-schedule / migrate-panel-flow /
--   migrate-schedule-plan-form / migrate-schedule-capacity 的 CREATE VIEW 引用 bd_manu_order.[生产车间],
--   该列已被 migrate-manu-prune-legacy.sql 裁剪 ⇒ 整体重放必报「列名 '生产车间' 无效」,
--   且 DbSync 遇错**中止后续脚本**,元数据批次永远跑不到(2026-09-24 实测)。
-- 因此只抽这些脚本里的**纯元数据批次**单独执行(全部带 IF NOT EXISTS 守卫,幂等可重跑)。
-- ⚠ 一次性修复脚本:不改迁移链,不入 db-migrations.txt;两账套各跑一次即可。
SET NOCOUNT ON;

-- ── 摘自 tools/migrate-manu-order-schedule.sql 第 6 批(纯元数据 INSERT,含 IF NOT EXISTS 守卫,幂等) ──
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='MANU_SCHEDULE')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES ('MANU_SCHEDULE', N'生产排产', N'生产制造', 'flat', 'v_manu_schedule', NULL, NULL, N'id', NULL, NULL, NULL, 100, 'items', N'生产制造');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'加工单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'加工单号',N'加工单号',N'文本',N'query,detail',10,140,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'单据日期',N'单据日期',N'日期',N'query,detail',20,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'销售订单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'销售订单号',N'销售订单号',N'文本',N'query,detail',30,150,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'客户') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'客户',N'客户',N'文本',N'query,detail',40,180,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产线') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产线',N'生产线',N'文本',N'query,detail',50,120,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产车间') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产车间',N'生产车间',N'文本',N'query,detail',60,120,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'产品编码') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'产品编码',N'产品编码',N'文本',N'query,detail',70,120,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'产品名称',N'产品名称',N'文本',N'query,detail',80,170,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'规格型号',N'规格型号',N'文本',N'detail',90,140,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产单位') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产单位',N'生产单位',N'文本',N'detail',100,80,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'批号') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'批号',N'批号',N'文本',N'query,detail',110,130,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'需求数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'需求数量',N'需求数量',N'小数',N'query,detail',120,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'排产数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'排产数量',N'排产数量',N'小数',N'query,detail',130,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'入库数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'入库数量',N'入库数量',N'小数',N'query,detail',140,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'余量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'余量',N'余量',N'小数',N'detail',150,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'交期') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'交期',N'交期',N'日期',N'query,detail',160,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'交期紧迫度(天)') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'交期紧迫度(天)',N'交期紧迫度(天)',N'整数',N'query,detail',170,120,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'结案') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'结案',N'结案',N'是否',N'detail',180,70,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'源工单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'源工单号',N'源工单号',N'文本',N'detail',190,140,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'单据状态',N'单据状态',N'文本',N'query,detail',200,90,0,0,0,1);
-- §8.1 排单计划真实字段补齐(客户等级/产能/销售订单数量/生产计划数量/实际完成数量/工序交期/三桶已排产)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'客户等级') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'客户等级',N'客户等级',N'文本',N'query,detail',45,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'产能/小时') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'产能/小时',N'产能/小时',N'小数',N'detail',65,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'销售订单数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'销售订单数量',N'销售订单数量',N'小数',N'query,detail',115,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产计划数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产计划数量',N'生产计划数量',N'小数',N'query,detail',135,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'实际完成数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'实际完成数量',N'实际完成数量',N'小数',N'query,detail',145,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'工序交期') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'工序交期',N'工序交期',N'日期',N'query,detail',165,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'7天已排产') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'7天已排产',N'7天已排产',N'小数',N'detail',205,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'15天已排产') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'15天已排产',N'15天已排产',N'小数',N'detail',210,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'大于15天') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'大于15天',N'大于15天',N'小数',N'detail',215,100,0,0,0,1);
-- 五工序完成 + 未完成数量(单轨改造,吸收原排单计划看板;完成数=报工求和,未完成=排产数量−装箱完成)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'混料完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'混料完成',N'混料完成',N'小数',N'query,detail',220,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'成型完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'成型完成',N'成型完成',N'小数',N'query,detail',225,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'切炭完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'切炭完成',N'切炭完成',N'小数',N'query,detail',230,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'组装完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'组装完成',N'组装完成',N'小数',N'query,detail',235,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱完成',N'装箱完成',N'小数',N'query,detail',240,90,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'未完成数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'未完成数量',N'未完成数量',N'小数',N'query,detail',245,100,0,0,0,1);
-- 权限行:普通用户可查/导出/打印(排产看板=只读视图,无单据动作;管理员由 yj_role.is_admin 通配)
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='MANU_SCHEDULE')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'MANU_SCHEDULE', N'N', N'view,query,export,print');

-- ── 摘自 tools/migrate-schedule-plan-form.sql 第 3 批(纯元数据 INSERT,含 IF NOT EXISTS 守卫,幂等) ──
-- ③ MANU_SCHEDULE 面板补登新列(生产排产 / 排单计划表口径)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'重点管控') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'重点管控',N'重点管控',N'文本',N'query,detail',42,80,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产订单数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产订单数量',N'生产订单数量',N'小数',N'query,detail',140,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'每箱数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'每箱数量',N'每箱数量',N'小数',N'detail',146,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'箱数') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'箱数',N'箱数',N'小数',N'detail',148,80,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'计划开工日') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'计划开工日',N'计划开工日',N'日期',N'query,detail',160,110,0,0,0,1);

-- 五工序「计划 / 未完成」成列(完成列已存在);手写表每个工序三行 = 计划/完成/未完成
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'混料计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'混料计划',N'混料计划',N'小数',N'detail',200,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'混料未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'混料未完成',N'混料未完成',N'小数',N'detail',220,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'成型计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'成型计划',N'成型计划',N'小数',N'detail',230,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'成型未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'成型未完成',N'成型未完成',N'小数',N'detail',250,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'切炭计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'切炭计划',N'切炭计划',N'小数',N'detail',260,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'切炭未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'切炭未完成',N'切炭未完成',N'小数',N'detail',280,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'组装计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'组装计划',N'组装计划',N'小数',N'detail',290,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'组装未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'组装未完成',N'组装未完成',N'小数',N'detail',310,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱计划',N'装箱计划',N'小数',N'detail',320,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱未完成',N'装箱未完成',N'小数',N'detail',340,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱完成',N'装箱完成',N'小数',N'detail',330,100,0,0,0,1);

-- en 译名(新增标签)
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES
  (N'生产订单数量', N'Production Order Qty'),
  (N'箱数', N'Box Count'),
  (N'计划开工日', N'Planned Start Date'),
  (N'混料计划', N'Mixing Plan'),
  (N'混料未完成', N'Mixing Outstanding'),
  (N'成型计划', N'Forming Plan'),
  (N'成型未完成', N'Forming Outstanding'),
  (N'切炭计划', N'Carbon Cutting Plan'),
  (N'切炭未完成', N'Carbon Cutting Outstanding'),
  (N'组装计划', N'Assembly Plan'),
  (N'组装未完成', N'Assembly Outstanding'),
  (N'装箱计划', N'Packing Plan'),
  (N'装箱未完成', N'Packing Outstanding'),
  (N'装箱完成', N'Packing Completed')
) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');

SELECT N'重点管控 列' AS 检查, COUNT(*) AS 数量 FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order') AND name=N'重点管控'
UNION ALL SELECT N'v_manu_schedule 列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule')
UNION ALL SELECT N'MANU_SCHEDULE 新字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name IN (N'重点管控',N'生产订单数量',N'每箱数量',N'箱数',N'计划开工日',N'混料计划',N'混料未完成',N'成型计划',N'成型未完成',N'切炭计划',N'切炭未完成',N'组装计划',N'组装未完成',N'装箱计划',N'装箱未完成',N'装箱完成');
PRINT N'migrate-schedule-plan-form 完成';

-- ── 摘自 tools/migrate-schedule-capacity.sql 第 4 批(纯元数据 INSERT,含 IF NOT EXISTS 守卫,幂等) ──
-- ③ 面板登记 + en 译名
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'开产量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'开产量',N'开产量',N'小数',N'query,detail',150,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产状态') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产状态',N'生产状态',N'文本',N'query,detail',45,90,0,0,0,1);

INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES (N'开产量', N'Started Qty'), (N'生产状态', N'Production Status'), (N'产线产能', N'Line Capacity'),
             (N'日产能', N'Daily Capacity'), (N'小时产能', N'Hourly Capacity')) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'panel', N'产线产能', 'en', N'Line Capacity', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'panel' AND x.ref_key=N'产线产能' AND x.locale='en');

SELECT N'bs_line_capacity 表' AS 检查, COUNT(*) AS 数量 FROM sys.tables WHERE name='bs_line_capacity'
UNION ALL SELECT N'v_manu_schedule 列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule')
UNION ALL SELECT N'新增视图列(开产量/生产状态)', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule') AND name IN (N'开产量',N'生产状态')
UNION ALL SELECT N'MANU_SCHEDULE 新字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name IN (N'开产量',N'生产状态');
PRINT N'migrate-schedule-capacity 完成';

-- ── 摘自 tools/migrate-panel-flow.sql 第 3 批(纯元数据 INSERT,含 IF NOT EXISTS 守卫,幂等) ──
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='LINE_CAP')
  INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,code_col,prefix,date_col,page_size,detail_key,module_group)
  VALUES ('LINE_CAP', N'产线产能', N'生产制造', 'archive', 'bs_line_capacity', NULL, NULL, N'id', N'生产线', NULL, NULL, 100, N'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='LINE_LOAD')
  INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,code_col,prefix,date_col,page_size,detail_key,module_group)
  VALUES ('LINE_LOAD', N'产线排产负荷', N'生产制造', 'flat', 'v_line_load', NULL, NULL, N'id', NULL, NULL, NULL, 100, N'items', N'生产制造');

INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT v.p, v.c, v.c, v.t, N'query,header', v.s, v.w, v.e, 0, 0, 1 FROM (VALUES
  ('LINE_CAP',N'生产线',N'文本',10,140,1),('LINE_CAP',N'生产车间',N'文本',20,140,1),
  ('LINE_CAP',N'日产能',N'小数',30,110,1),('LINE_CAP',N'小时产能',N'小数',40,110,1),
  ('LINE_CAP',N'排序',N'整数',50,80,1),('LINE_CAP',N'备注',N'文本',60,200,1)
) AS v(p,c,t,s,w,e)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.p AND f.col_name=v.c);

INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'LINE_LOAD', v.c, v.c, N'小数', N'query,detail', v.s, 90, 0, 0, 0, 1 FROM (VALUES
  (N'日产能',20),(N'今日负荷',30),(N'D1',40),(N'D2',41),(N'D3',42),(N'D4',43),(N'D5',44),(N'D6',45),(N'D7',46),
  (N'D8',47),(N'D9',48),(N'D10',49),(N'D11',50),(N'D12',51),(N'D13',52),(N'合计负荷',60)
) AS v(c,s)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='LINE_LOAD' AND f.col_name=v.c);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'LINE_LOAD', N'生产线', N'生产线', N'文本', N'query,detail', 10, 130, 0, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='LINE_LOAD' AND f.col_name=N'生产线');
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'LINE_LOAD', N'生产车间', N'生产车间', N'文本', N'query,detail', 15, 130, 0, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='LINE_LOAD' AND f.col_name=N'生产车间');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'需求数量')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'需求数量',N'需求数量',N'小数',N'query,detail',135,100,0,0,0,1);

INSERT INTO yj_role_panel (role_id, panel_code, perms)
SELECT DISTINCT rp.role_id, p, 'view,query,add,modify,export'
FROM yj_role_panel rp CROSS JOIN (VALUES ('LINE_CAP'),('LINE_LOAD')) AS x(p)
WHERE rp.panel_code='MANU_ORDER' AND rp.perms LIKE '%view%'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel z WHERE z.role_id=rp.role_id AND z.panel_code=x.p);
GO
