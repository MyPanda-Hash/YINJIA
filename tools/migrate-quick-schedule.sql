-- migrate-quick-schedule.sql — 快速排产(专用界面)配套:加工单行「每箱数量」(2026-09-22)
-- 依据:参考库「快速排产」屏有 每盘数量/盘数 系列字段(电镀/服装域);用户拍板按**银嘉口径**替换——
--       保留「每箱数量」并派生「箱数」(排产数量÷每箱数量),不再引入 盘数/电镀类型/镀种/膜厚/环保号/序列号。
-- 落点:bl_manu_order(加工单行,与产品同粒度)+ yj_field 登记(加工单表单可录、快速排产已排产列表可查)。
-- 幂等:COL_LENGTH / IF NOT EXISTS 守卫,可重复执行。
SET NOCOUNT ON;

IF COL_LENGTH('bl_manu_order', N'每箱数量') IS NULL ALTER TABLE bl_manu_order ADD [每箱数量] decimal(18,4) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bl_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bl_manu_order'), N'每箱数量', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'每箱数量(装箱规格;银嘉口径替代旧「每盘数量」,箱数=排产数量÷每箱数量)',
       N'SCHEMA', N'dbo', N'TABLE', N'bl_manu_order', N'COLUMN', N'每箱数量';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'每箱数量' AND place=N'detail')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
  VALUES ('MANU_ORDER',N'每箱数量',N'每箱数量',N'小数',NULL,NULL,NULL,NULL,N'detail',370,100,1,0,0,1);

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'每箱数量' AND locale='en')
  INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'每箱数量','en',N'Qty per Box','manual');

SELECT N'bl_manu_order.每箱数量 列' AS 检查, COUNT(*) AS 数量 FROM sys.columns WHERE object_id=OBJECT_ID('bl_manu_order') AND name=N'每箱数量'
UNION ALL SELECT N'MANU_ORDER 每箱数量 字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'每箱数量'
UNION ALL SELECT N'每箱数量 en 译名', COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'每箱数量' AND locale='en';
PRINT N'migrate-quick-schedule 完成';
GO
