-- migrate-prod-batch-first-article.sql — 批次链·首件通知·工单附件·生产异常处理单(2026-09-22,生产部需求)
-- 依据:生产部需求纪要 二/三/一:
--   ①批次链:混料批次号 → 领料绑定(领料单行已有 批号 列,扫码带入)→ 碳棒批次号(=加工单头.批号,
--     「生成产品批号」按日期+流水发放,契合"一天一个批次")→ 组装沿用(拆单/复制同名词典带 批号);
--     本脚本为加工单头补「混料批次号」(成型领用了哪个混料批次),批次链两头齐全。
--   ②首件通知:生产出第一批时点击「首件完成通知」→ 置 首件完成/时间/通知人 + 站内消息提醒品质取样。
--   ③两套工单(前端成型/后端组装)纸质文件全部上传 → 加工单头补 附件1~6(附件 dataType,前端零改动)。
--   ④生产异常闭环(提出→分析→处理→结案):新建「生产异常处理单 PROD_ABN」档案式面板(挂工单号/批次号,
--     按碳棒批次号展开查询);字段为通用闭环 v1,待车间实拍表格确认后对齐。
-- 幂等:COL_LENGTH / IF NOT EXISTS / IF OBJECT_ID,可重复执行。
SET NOCOUNT ON;

-- ① 加工单头:批次链 + 首件 + 附件
IF COL_LENGTH('bd_manu_order', N'混料批次号') IS NULL ALTER TABLE bd_manu_order ADD [混料批次号] nvarchar(50) NULL;
IF COL_LENGTH('bd_manu_order', N'首件完成') IS NULL ALTER TABLE bd_manu_order ADD [首件完成] nvarchar(1) NULL;
IF COL_LENGTH('bd_manu_order', N'首件完成时间') IS NULL ALTER TABLE bd_manu_order ADD [首件完成时间] datetime2 NULL;
IF COL_LENGTH('bd_manu_order', N'首件通知人') IS NULL ALTER TABLE bd_manu_order ADD [首件通知人] nvarchar(50) NULL;
IF COL_LENGTH('bd_manu_order', N'附件1') IS NULL ALTER TABLE bd_manu_order ADD [附件1] nvarchar(max) NULL;
IF COL_LENGTH('bd_manu_order', N'附件2') IS NULL ALTER TABLE bd_manu_order ADD [附件2] nvarchar(max) NULL;
IF COL_LENGTH('bd_manu_order', N'附件3') IS NULL ALTER TABLE bd_manu_order ADD [附件3] nvarchar(max) NULL;
IF COL_LENGTH('bd_manu_order', N'附件4') IS NULL ALTER TABLE bd_manu_order ADD [附件4] nvarchar(max) NULL;
IF COL_LENGTH('bd_manu_order', N'附件5') IS NULL ALTER TABLE bd_manu_order ADD [附件5] nvarchar(max) NULL;
IF COL_LENGTH('bd_manu_order', N'附件6') IS NULL ALTER TABLE bd_manu_order ADD [附件6] nvarchar(max) NULL;
GO
DECLARE @mc nvarchar(200), @md nvarchar(500);
DECLARE c_cur CURSOR LOCAL FAST_FORWARD FOR SELECT v.c, v.d FROM (VALUES
  (N'混料批次号', N'混料批次号(批次链:混料工序按日发放→成型领料绑定→本单记录领用的混料批次;组装沿用碳棒批号)'),
  (N'首件完成',   N'首件完成(是/否;生产出第一批时点「首件完成通知」,站内消息提醒品质取样测试)'),
  (N'首件完成时间', N'首件完成时间(点「首件完成通知」自动落值)'),
  (N'首件通知人', N'首件通知人(点「首件完成通知」的操作人)'),
  (N'附件1', N'附件1(前端成型/后端组装两套纸质工单上传;工序文件在共享文件库,只读+授权改动)')
) AS v(c,d);
OPEN c_cur; FETCH NEXT FROM c_cur INTO @mc, @md;
WHILE @@FETCH_STATUS = 0 BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id=OBJECT_ID('bd_manu_order') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), @mc,'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @md, N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', @mc;
  FETCH NEXT FROM c_cur INTO @mc, @md;
END
CLOSE c_cur; DEALLOCATE c_cur;
GO

-- ② 生产异常处理单表(档案式:提出→分析→处理→结案 全字段,按 批次号/工单号 追溯)
IF OBJECT_ID('bd_prod_abn') IS NULL
CREATE TABLE bd_prod_abn (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [单据编号] nvarchar(50) NOT NULL,
  [单据日期] date NULL,
  [工单号] nvarchar(50) NULL,
  [产品编码] nvarchar(50) NULL,
  [品名] nvarchar(200) NULL,
  [批次号] nvarchar(50) NULL,
  [混料批次号] nvarchar(50) NULL,
  [工序] nvarchar(50) NULL,
  [发生时间] date NULL,
  [提出人] nvarchar(50) NULL,
  [异常类型] nvarchar(50) NULL,
  [异常描述] nvarchar(1000) NULL,
  [影响数量] decimal(18,4) NULL,
  [原因分析] nvarchar(1000) NULL,
  [责任分类] nvarchar(50) NULL,
  [处理措施] nvarchar(1000) NULL,
  [处理人] nvarchar(50) NULL,
  [处理日期] date NULL,
  [结案] nvarchar(1) NULL,
  [结案人] nvarchar(50) NULL,
  [结案日期] date NULL,
  [备注] nvarchar(500) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_prod_abn_no' AND object_id=OBJECT_ID('bd_prod_abn'))
  CREATE UNIQUE INDEX ux_prod_abn_no ON bd_prod_abn([单据编号]);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bd_prod_abn') AND ep.minor_id=0 AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产异常处理单(闭环:异常提出→原因分析→处理措施→结案;挂 工单号/批次号(碳棒)/混料批次号,所有不良异常按批次号展开)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_prod_abn';
GO

-- ③ 面板注册:生产异常处理单(档案式,同 INV 模式) + 字段
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PROD_ABN')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES ('PROD_ABN', N'生产异常处理单', N'生产制造', 'archive', 'bd_prod_abn', NULL, NULL, N'id', N'单据编号', N'YC', N'单据日期', 100, N'items', N'生产制造');

DECLARE @dict_gx nvarchar(200) = N'SELECT N''混料'' AS 值 UNION ALL SELECT N''成型'' UNION ALL SELECT N''切炭'' UNION ALL SELECT N''组装'' UNION ALL SELECT N''装箱'' UNION ALL SELECT N''无黑处理'' UNION ALL SELECT N''其他''';
DECLARE @dict_type nvarchar(300) = N'SELECT N''质量'' AS 值 UNION ALL SELECT N''设备'' UNION ALL SELECT N''物料'' UNION ALL SELECT N''工艺'' UNION ALL SELECT N''其他''';
DECLARE @dict_duty nvarchar(300) = N'SELECT N''生产'' AS 值 UNION ALL SELECT N''设备'' UNION ALL SELECT N''物料'' UNION ALL SELECT N''设计'' UNION ALL SELECT N''其他''';
DECLARE @dict_yn nvarchar(100) = N'SELECT N''是'' AS 值 UNION ALL SELECT N''否''';

INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
SELECT v.p, v.c, v.c, v.t, v.d, v.rp, v.rf, '合同号', N'query,header', v.s, v.w, 1, v.q, 0, 1
FROM (VALUES
  ('PROD_ABN',N'单据编号',N'文本',NULL,NULL,NULL,10,140,1),
  ('PROD_ABN',N'单据日期',N'日期',NULL,NULL,NULL,15,110,1),
  ('PROD_ABN',N'工单号',N'参照',NULL,N'MANU_ORDER',N'合同号',20,150,1),
  ('PROD_ABN',N'产品编码',N'文本',NULL,NULL,NULL,25,120,0),
  ('PROD_ABN',N'品名',N'文本',NULL,NULL,NULL,28,180,0),
  ('PROD_ABN',N'批次号',N'文本',NULL,NULL,NULL,30,120,0),
  ('PROD_ABN',N'混料批次号',N'文本',NULL,NULL,NULL,32,120,0),
  ('PROD_ABN',N'工序',N'文本',@dict_gx,NULL,NULL,35,90,0),
  ('PROD_ABN',N'发生时间',N'日期',NULL,NULL,NULL,40,110,0),
  ('PROD_ABN',N'提出人',N'文本',NULL,NULL,NULL,45,90,1),
  ('PROD_ABN',N'异常类型',N'文本',@dict_type,NULL,NULL,48,90,0),
  ('PROD_ABN',N'异常描述',N'文本',NULL,NULL,NULL,50,260,1),
  ('PROD_ABN',N'影响数量',N'小数',NULL,NULL,NULL,55,100,0),
  ('PROD_ABN',N'原因分析',N'文本',NULL,NULL,NULL,60,220,0),
  ('PROD_ABN',N'责任分类',N'文本',@dict_duty,NULL,NULL,63,90,0),
  ('PROD_ABN',N'处理措施',N'文本',NULL,NULL,NULL,65,220,0),
  ('PROD_ABN',N'处理人',N'文本',NULL,NULL,NULL,68,90,0),
  ('PROD_ABN',N'处理日期',N'日期',NULL,NULL,NULL,70,110,0),
  ('PROD_ABN',N'结案',N'文本',@dict_yn,NULL,NULL,75,70,0),
  ('PROD_ABN',N'结案人',N'文本',NULL,NULL,NULL,78,90,0),
  ('PROD_ABN',N'结案日期',N'日期',NULL,NULL,NULL,80,110,0),
  ('PROD_ABN',N'备注',N'文本',NULL,NULL,NULL,85,200,0)
) AS v(p,c,t,d,rp,rf,s,w,q)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.p AND f.col_name=v.c);

-- ④ 加工单头字段登记(批次链/首件/附件)
INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
SELECT v.p, v.c, v.c, v.t, v.d, NULL, NULL, NULL, v.pl, v.s, v.w, 1, 0, 0, 1
FROM (VALUES
  ('MANU_ORDER',N'混料批次号',N'文本',NULL,N'query,header',66,120),
  ('MANU_ORDER',N'首件完成',N'文本',@dict_yn,N'query,header',67,80),
  ('MANU_ORDER',N'首件完成时间',N'日期',NULL,N'header',68,140),
  ('MANU_ORDER',N'首件通知人',N'文本',NULL,N'header',69,100),
  ('MANU_ORDER',N'附件1',N'附件',NULL,N'header',410,160),
  ('MANU_ORDER',N'附件2',N'附件',NULL,N'header',411,160),
  ('MANU_ORDER',N'附件3',N'附件',NULL,N'header',412,160),
  ('MANU_ORDER',N'附件4',N'附件',NULL,N'header',413,160),
  ('MANU_ORDER',N'附件5',N'附件',NULL,N'header',414,160),
  ('MANU_ORDER',N'附件6',N'附件',NULL,N'header',415,160)
) AS v(p,c,t,d,pl,s,w)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.p AND f.col_name=v.c);

-- ⑤ 角色权限:可见 生产加工单 的角色同步可见 生产异常处理单
INSERT INTO yj_role_panel (role_id, panel_code, perms)
SELECT DISTINCT rp.role_id, 'PROD_ABN', 'view,query,add,modify,export'
FROM yj_role_panel rp
WHERE rp.panel_code = 'MANU_ORDER' AND rp.perms LIKE '%view%'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = rp.role_id AND x.panel_code = 'PROD_ABN');
GO

-- ⑥ 译名(en)
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES
  (N'混料批次号', N'Mixing Lot No.'),
  (N'首件完成', N'First Article Done'),
  (N'首件完成时间', N'First Article Time'),
  (N'首件通知人', N'Notified By'),
  (N'批次号', N'Batch No.'),
  (N'发生时间', N'Occurred At'),
  (N'提出人', N'Raised By'),
  (N'异常类型', N'Abnormality Type'),
  (N'异常描述', N'Description'),
  (N'影响数量', N'Affected Qty'),
  (N'原因分析', N'Root Cause'),
  (N'责任分类', N'Responsibility'),
  (N'处理措施', N'Action Taken'),
  (N'处理人', N'Handled By'),
  (N'处理日期', N'Handled At'),
  (N'结案人', N'Closed By'),
  (N'结案日期', N'Closed At')
) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'panel', N'生产异常处理单', 'en', N'Production Abnormality', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'panel' AND x.ref_key=N'生产异常处理单' AND x.locale='en');

SELECT N'bd_manu_order 新列' AS 检查, COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order') AND name IN (N'混料批次号',N'首件完成',N'首件完成时间',N'首件通知人',N'附件1',N'附件6')
UNION ALL SELECT N'bd_prod_abn 表/面板', (SELECT COUNT(*) FROM sys.tables WHERE name='bd_prod_abn') + (SELECT COUNT(*) FROM yj_panel WHERE panel_code='PROD_ABN')
UNION ALL SELECT N'PROD_ABN 字段', COUNT(*) FROM yj_field WHERE panel_code='PROD_ABN'
UNION ALL SELECT N'MANU_ORDER 新字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name IN (N'混料批次号',N'首件完成',N'首件完成时间',N'首件通知人',N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6');
PRINT N'migrate-prod-batch-first-article 完成';
GO
