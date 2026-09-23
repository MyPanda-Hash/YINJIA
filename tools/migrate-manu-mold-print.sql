-- migrate-manu-mold-print.sql — 生产加工单对齐参考库 plang(修改底稿 2026-09-23)
-- 依据:docs/design/参考库工单表-plang-修改底稿.md(55 列逐列比对结论):
--   46 列已有等价落点(工单号=合同号/生产线=scx/操作员=pl_man/需求数量=xq_sl/排产数量=pl_sl/入库=rk_sl/余量=yl/
--   预完工日=cp_date/预开工日+开工日期=st_date 双列更细/完工日期=cp_date2/入库单号=rk_no/领料单号=ll_no2/
--   外包=wb_no/单据类型=djlx/来料性质·单号·采购入库单号/批号=lot_no/重量=zl(头+单重总重更细)/结案=ja…);
--   9 列不加:comm(单租户,机构列已在)/color·siz(电镀服装域)/ll_no(被ll_no2取代)/od_xc·ypl_sl·MoDId(由 form_flow_link
--   行级占用链承载)/BomId(生产状态推导)/asp_user4·time4(作废留痕在 yj_doc_status);
--   gg2 规格2 不加(全链路单规格:bs_inv/bl_so_order/bl_manu_order 均单列规格型号,银嘉单规格口径);
--   pl_sl2 排产数量2 不加(只↔箱双单位由 每箱数量+箱数 覆盖)。
--   真实缺口=2 列(用户 2026-09-23 确认):
--   ①头.模具类型(plang.mjlx):成型工单记录模具——备料备模/首件对照/异常分析(模具磨损聚合)/纸质工单打印列;
--   ②头.打印次数(plang.asp_print):两套纸质工单打印/重打计数(工单复制/重打需求的数据源)。
-- 幂等:COL_LENGTH / IF NOT EXISTS,可重复执行。
SET NOCOUNT ON;

IF COL_LENGTH('bd_manu_order', N'模具类型') IS NULL ALTER TABLE bd_manu_order ADD [模具类型] nvarchar(40) NULL;
IF COL_LENGTH('bd_manu_order', N'打印次数') IS NULL ALTER TABLE bd_manu_order ADD [打印次数] int NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'模具类型', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'模具类型(参考库 plang.mjlx;成型工单使用模具标识:备料备模/首件对照/异常分析锚点,先手填模号,有编码体系后可换参照)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'模具类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'打印次数', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数(参考库 plang.asp_print;两套纸质工单打印/重打计数,默认 0)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'打印次数';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'模具类型' AND place=N'header')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
  VALUES ('MANU_ORDER',N'模具类型',N'模具类型',N'文本',NULL,NULL,NULL,NULL,N'query,header',72,120,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'打印次数' AND place=N'header')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
  VALUES ('MANU_ORDER',N'打印次数',N'打印次数',N'整数',NULL,NULL,NULL,NULL,N'header',74,90,0,0,0,1);

INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES (N'模具类型', N'Mold Type'), (N'打印次数', N'Print Count')) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');

SELECT N'新列' AS 检查, COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order') AND name IN (N'模具类型',N'打印次数')
UNION ALL SELECT N'新字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name IN (N'模具类型',N'打印次数');
PRINT N'migrate-manu-mold-print 完成';
GO
