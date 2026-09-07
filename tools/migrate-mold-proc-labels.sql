-- migrate-mold-proc-labels.sql — 成型工艺清单:结构性标签注册到 yj_field(使字段编辑可保存)
-- 这些标签只做显示(不存数据),注册后 saveColumnPrefs 可按 col_name 匹配更新 alias
SET NOCOUNT ON;
GO
DECLARE @added INT = 0;
-- 产品基本信息区:炭棒规格(表头,非 炭棒规格1/2/3 数据列)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'炭棒规格')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'炭棒规格', N'炭棒规格', N'文本', N'header', 125, 100, 0, 0, 1, 1);
SET @added += 1;
-- 工序区
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'工序')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'工序', N'工序', N'文本', N'header', 200, 60, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'工序管控要求')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'工序管控要求', N'工序管控要求', N'文本', N'header', 201, 100, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'灌料')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'灌料', N'灌料', N'文本', N'header', 202, 60, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'烧结')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'烧结', N'烧结', N'文本', N'header', 203, 60, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'烧结时间/调速器参数')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'烧结时间/调速器参数', N'烧结时间/调速器参数', N'文本', N'header', 204, 100, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'热压')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'热压', N'热压', N'文本', N'header', 205, 60, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'冷却')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'冷却', N'冷却', N'文本', N'header', 206, 60, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'脱模')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'脱模', N'脱模', N'文本', N'header', 207, 60, 0, 0, 1, 1);
-- 检验要求区
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'炭棒尺寸')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'炭棒尺寸', N'炭棒尺寸', N'文本', N'header', 315, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'密度管控')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'密度管控', N'密度管控', N'文本', N'header', 375, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'管控要求')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'管控要求', N'管控要求', N'文本', N'header', 376, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'跌落强度')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'跌落强度', N'跌落强度', N'文本', N'header', 415, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'高度cm')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'高度cm', N'高度cm', N'文本', N'header', 416, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'要求')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'要求', N'要求', N'文本', N'header', 425, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'抗压强度')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'抗压强度', N'抗压强度', N'文本', N'header', 435, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'压头下降速度mm/min')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'压头下降速度mm/min', N'压头下降速度mm/min', N'文本', N'header', 441, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'压降')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'压降', N'压降', N'文本', N'header', 465, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'测试管路')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'测试管路', N'测试管路', N'文本', N'header', 466, 80, 0, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'测试流速L/min')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'测试流速L/min', N'测试流速L/min', N'文本', N'header', 471, 80, 0, 0, 1, 1);
GO
PRINT N'成型工艺清单结构性标签注册完成';
GO