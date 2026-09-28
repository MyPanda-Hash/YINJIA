-- migrate-align-fields-20260924.sql — 字段位缺口补齐(2026-09-24 元数据审计产物)
-- 背景:迁移链声明的 6 个字段,本地库物理列在但 yj_field 字段位缺(界面不显示列)——历史两线演化分叉漏注册。
-- 判定:列在+面板在+声明有=真缺口;其余 162 项审计差异均为有意下线/改名/被替代(勿建回)。
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最新成本')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('INV', N'最新成本', N'最新成本', N'小数', NULL, NULL, NULL, NULL, N'detail', 100, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'换算率')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('UOM', N'换算率', N'换算率', N'小数', NULL, NULL, NULL, NULL, N'detail', 50, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'数量2')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_ORDER', N'数量2', N'数量2', N'小数', NULL, NULL, NULL, NULL, N'detail', 55, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'计量单位2')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_ORDER', N'计量单位2', N'计量单位2', N'文本', NULL, NULL, NULL, NULL, N'detail', 57, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_STATUS' AND col_name=N'预警数量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('STOCK_STATUS', N'预警数量', N'预警数量', N'小数', N'detail', 9, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'电话')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('DEPT', N'电话', N'电话', N'文本', N'detail', 70, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'联系人')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('WH', N'联系人', N'联系人', N'文本', N'detail', 90, 140, 1, 0, 0, 1);
GO

-- 追加(2026-09-24 云端对齐):PU_ORDER 真缺 6 行——供应商编码/备注(头) + 数量2/计量单位2/折扣%/折扣金额(行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商编码')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PU_ORDER', N'供应商编码', N'供应商编码', N'文本', N'header', 45, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'备注')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PU_ORDER', N'备注', N'备注', N'文本', N'header', 140, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'数量2')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PU_ORDER', N'数量2', N'数量2', N'小数', N'detail', 55, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'计量单位2')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PU_ORDER', N'计量单位2', N'计量单位2', N'文本', N'detail', 57, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣%')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PU_ORDER', N'折扣%', N'折扣%', N'小数', N'detail', 145, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣金额')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PU_ORDER', N'折扣金额', N'折扣金额', N'小数', N'detail', 147, 90, 1, 0, 0, 1);
GO

-- 追加2(2026-09-24 供应链/品质板块对齐):备注字段位(物理列在,字段缺) + QC_INSP.单位
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'备注')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('PURCHASE_IN', N'备注', N'备注', N'文本', N'header', 900, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'备注')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('MATERIAL_OUT', N'备注', N'备注', N'文本', N'header', 900, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FINISH_IN' AND col_name=N'备注')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
  VALUES ('FINISH_IN', N'备注', N'备注', N'文本', N'header', 900, 200, 1, 0, 0, 1);
GO
