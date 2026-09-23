-- migrate-manu-order-schedule.sql — 生产加工单补排产/执行字段 + 新建「生产排产」面板
-- 依据(三处权威):①参考库 HSDZ_MES_0828 旧系统「工单排产」plang_pc 55 列(排产数量/需求数量/入库数量/余量/
--   入库单号/领料单号/外包单号/结案/来料性质·单号·采购入库单号/单据类型/生产线/操作员 等);
--   ②docs/design/银嘉MES总流程整理-V1.2.md §8.1 排单计划表格真实字段(工序交期/交期紧迫度/7天·15天·大于15天已排产);
--   ③docs/design/补充设计-V2.0.md §3.2 排产增强(拆单:MANU_ORDER 按数量拆分多个工单,父子关联)。
-- 面板口径:bd_manu_order=「生产加工单」头表 / bl_manu_order=「生产加工单」明细行表(库内中文注明为准);
--   本迁移只加列与元数据,不改既有列语义、不动 PANDA 复刻的面板版式。
-- 幂等:COL_LENGTH / IF NOT EXISTS / CREATE OR ALTER 守卫,可重复执行。
SET NOCOUNT ON;

/* ============ A. 生产加工单头表:补排产与执行回填字段 ============ */
IF COL_LENGTH('bd_manu_order', N'生产线') IS NULL ALTER TABLE bd_manu_order ADD [生产线] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'操作员') IS NULL ALTER TABLE bd_manu_order ADD [操作员] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'需求数量') IS NULL ALTER TABLE bd_manu_order ADD [需求数量] decimal(18,4) NULL;
IF COL_LENGTH('bd_manu_order', N'排产数量') IS NULL ALTER TABLE bd_manu_order ADD [排产数量] decimal(18,4) NULL;
IF COL_LENGTH('bd_manu_order', N'入库数量') IS NULL ALTER TABLE bd_manu_order ADD [入库数量] decimal(18,4) NULL;
IF COL_LENGTH('bd_manu_order', N'余量') IS NULL ALTER TABLE bd_manu_order ADD [余量] decimal(18,4) NULL;
IF COL_LENGTH('bd_manu_order', N'入库单号') IS NULL ALTER TABLE bd_manu_order ADD [入库单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'领料单号') IS NULL ALTER TABLE bd_manu_order ADD [领料单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'外包单号') IS NULL ALTER TABLE bd_manu_order ADD [外包单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'结案') IS NULL ALTER TABLE bd_manu_order ADD [结案] nvarchar(1) NULL;
IF COL_LENGTH('bd_manu_order', N'单据类型') IS NULL ALTER TABLE bd_manu_order ADD [单据类型] nvarchar(50) NULL;
IF COL_LENGTH('bd_manu_order', N'来料性质') IS NULL ALTER TABLE bd_manu_order ADD [来料性质] nvarchar(50) NULL;
IF COL_LENGTH('bd_manu_order', N'来料单号') IS NULL ALTER TABLE bd_manu_order ADD [来料单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'采购入库单号') IS NULL ALTER TABLE bd_manu_order ADD [采购入库单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_manu_order', N'单价') IS NULL ALTER TABLE bd_manu_order ADD [单价] decimal(18,4) NULL;
IF COL_LENGTH('bd_manu_order', N'金额') IS NULL ALTER TABLE bd_manu_order ADD [金额] decimal(18,4) NULL;
-- 拆单(V2.0 §3.2):源工单号为空=未拆分的原始工单;拆出的子工单填源工单号+拆分序号
IF COL_LENGTH('bd_manu_order', N'源工单号') IS NULL ALTER TABLE bd_manu_order ADD [源工单号] nvarchar(50) NULL;
IF COL_LENGTH('bd_manu_order', N'拆分序号') IS NULL ALTER TABLE bd_manu_order ADD [拆分序号] int NULL;

/* ============ B. 生产加工单行表:补需求/排产/入库/余量/价格与批号 ============ */
IF COL_LENGTH('bl_manu_order', N'批号') IS NULL ALTER TABLE bl_manu_order ADD [批号] nvarchar(50) NULL;
IF COL_LENGTH('bl_manu_order', N'需求数量') IS NULL ALTER TABLE bl_manu_order ADD [需求数量] decimal(18,4) NULL;
IF COL_LENGTH('bl_manu_order', N'排产数量') IS NULL ALTER TABLE bl_manu_order ADD [排产数量] decimal(18,4) NULL;
IF COL_LENGTH('bl_manu_order', N'入库数量') IS NULL ALTER TABLE bl_manu_order ADD [入库数量] decimal(18,4) NULL;
IF COL_LENGTH('bl_manu_order', N'余量') IS NULL ALTER TABLE bl_manu_order ADD [余量] decimal(18,4) NULL;
IF COL_LENGTH('bl_manu_order', N'单价') IS NULL ALTER TABLE bl_manu_order ADD [单价] decimal(18,4) NULL;
IF COL_LENGTH('bl_manu_order', N'金额') IS NULL ALTER TABLE bl_manu_order ADD [金额] decimal(18,4) NULL;
GO

/* ============ C. 新增列中文注明(全量部署规范:新增列必须带 MS_Description) ============ */
DECLARE @cols TABLE (tbl sysname, col sysname, cmt nvarchar(300));
INSERT INTO @cols VALUES
 (N'bd_manu_order', N'生产线',      N'生产线(参考库 plang_pc.scx;排产时指派)'),
 (N'bd_manu_order', N'操作员',      N'操作员(参考库 plang_pc.pl_man)'),
 (N'bd_manu_order', N'需求数量',    N'需求数量(来源订单转入,参考库 plang_pc.xq_sl)'),
 (N'bd_manu_order', N'排产数量',    N'排产数量(头级汇总=明细排产数量之和,参考库 plang_pc.pl_sl)'),
 (N'bd_manu_order', N'入库数量',    N'已入库数量(完工入库回填,参考库 plang_pc.rk_sl)'),
 (N'bd_manu_order', N'余量',        N'余量=排产数量-入库数量(参考库 plang_pc.yl)'),
 (N'bd_manu_order', N'入库单号',    N'入库单号(完工入库回填,参考库 plang_pc.rk_no)'),
 (N'bd_manu_order', N'领料单号',    N'领料单号(生产领料回填,参考库 plang_pc.ll_no2)'),
 (N'bd_manu_order', N'外包单号',    N'外包单号(委外加工关联,参考库 plang_pc.wb_no)'),
 (N'bd_manu_order', N'结案',        N'结案标记 Y/N(参考库 plang_pc.ja;结案后不再参与需求统计)'),
 (N'bd_manu_order', N'单据类型',    N'单据类型(参考库 plang_pc.djlx;如 自制/委外/返工)'),
 (N'bd_manu_order', N'来料性质',    N'来料性质(参考库 plang_pc.llxz;新货/返工/客退等)'),
 (N'bd_manu_order', N'来料单号',    N'来料单号(参考库 plang_pc.lldh;承接送料暂收/来料检验)'),
 (N'bd_manu_order', N'采购入库单号', N'采购入库单号(参考库 plang_pc.cgrkdh)'),
 (N'bd_manu_order', N'单价',        N'单价(参考库 plang_pc.dj)'),
 (N'bd_manu_order', N'金额',        N'金额(参考库 plang_pc.jine)'),
 (N'bd_manu_order', N'源工单号',    N'拆单源工单号(空=原始工单;V2.0 §3.2 拆单父子关联)'),
 (N'bd_manu_order', N'拆分序号',    N'拆单序号(源工单的第几拆,从 1 起)'),
 (N'bl_manu_order', N'批号',        N'批号(产品/来料批号,参考库 plang_pc.lot_no)'),
 (N'bl_manu_order', N'需求数量',    N'需求数量(=订单数量,选单/生单带入)'),
 (N'bl_manu_order', N'排产数量',    N'排产数量(排产确认数量,参考库 plang_pc.pl_sl)'),
 (N'bl_manu_order', N'入库数量',    N'已入库数量(完工入库回填)'),
 (N'bl_manu_order', N'余量',        N'余量=排产数量-入库数量'),
 (N'bl_manu_order', N'单价',        N'单价(来源订单单价)'),
 (N'bl_manu_order', N'金额',        N'金额');
DECLARE @t sysname, @c sysname, @m nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, cmt FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @t, @c, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @t, @c, @m;
END
CLOSE cur DEALLOCATE cur;
GO

/* ============ D. 生产加工单字段登记(yj_field) ============ */
-- 头:排产/执行字段(排产看板与单据列表要查,故 place 带 query)
-- 单据日期:生单/拆单写入但此前未登记,保存链按标签映射列时被丢 → 库里 NULL;
-- 登记(place 带 query)后 生单日期/看板日期/按日过滤 全部生效(2026-09-22 修复)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'单据日期',N'单据日期',N'日期',NULL,NULL,NULL,NULL,N'query,header',5,110,1,1,0,1);
-- 存量 NULL 补当日(幂等)
UPDATE bd_manu_order SET 单据日期 = ISNULL(单据日期, CAST(asp_time1 AS date)) WHERE 单据日期 IS NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'生产线') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'生产线',N'生产线',N'文本',NULL,NULL,NULL,NULL,N'query,header',310,120,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'操作员') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'操作员',N'操作员',N'文本',NULL,NULL,NULL,NULL,N'header',320,110,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'需求数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'需求数量',N'需求数量',N'小数',NULL,NULL,NULL,NULL,N'query,header',330,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'排产数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'排产数量',N'排产数量',N'小数',NULL,NULL,NULL,NULL,N'query,header',340,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'入库数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'入库数量',N'入库数量',N'小数',NULL,NULL,NULL,NULL,N'query,header',350,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'余量') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'余量',N'余量',N'小数',NULL,NULL,NULL,NULL,N'query,header',360,90,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'入库单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'入库单号',N'入库单号',N'文本',NULL,NULL,NULL,NULL,N'header',370,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'领料单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'领料单号',N'领料单号',N'文本',NULL,NULL,NULL,NULL,N'header',380,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'外包单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'外包单号',N'外包单号',N'文本',NULL,NULL,NULL,NULL,N'header',390,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'结案') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'结案',N'结案',N'是否',NULL,NULL,NULL,NULL,N'query,header',400,70,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'单据类型') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'单据类型',N'单据类型',N'文本',NULL,NULL,NULL,NULL,N'header',410,110,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'来料性质') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'来料性质',N'来料性质',N'文本',NULL,NULL,NULL,NULL,N'header',420,110,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'来料单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'来料单号',N'来料单号',N'文本',NULL,NULL,NULL,NULL,N'header',430,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'采购入库单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'采购入库单号',N'采购入库单号',N'文本',NULL,NULL,NULL,NULL,N'header',440,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'单价') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'单价',N'单价',N'小数',NULL,NULL,NULL,NULL,N'header',450,90,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'金额') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'金额',N'金额',N'小数',NULL,NULL,NULL,NULL,N'header',460,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'源工单号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'源工单号',N'源工单号',N'文本',NULL,NULL,NULL,NULL,N'query,header',470,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'拆分序号') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'拆分序号',N'拆分序号',N'整数',NULL,NULL,NULL,NULL,N'header',480,80,1,0,0,1);
-- 行:批号/需求/排产/入库/余量/价格
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'批号' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'批号',N'批号',N'文本',NULL,NULL,NULL,NULL,N'detail',300,120,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'需求数量' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'需求数量',N'需求数量',N'小数',NULL,NULL,NULL,NULL,N'detail',310,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'排产数量' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'排产数量',N'排产数量',N'小数',NULL,NULL,NULL,NULL,N'detail',320,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'入库数量' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'入库数量',N'入库数量',N'小数',NULL,NULL,NULL,NULL,N'detail',330,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'余量' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'余量',N'余量',N'小数',NULL,NULL,NULL,NULL,N'detail',340,90,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'单价' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'单价',N'单价',N'小数',NULL,NULL,NULL,NULL,N'detail',350,90,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'金额' AND place=N'detail') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER',N'金额',N'金额',N'小数',NULL,NULL,NULL,NULL,N'detail',360,100,1,0,0,1);
GO

/* ============ E. 生产排产面板(新建):加工单排产看板 ============ */
-- 排产口径:对齐 V1.2 §8.1「排单计划表格真实字段」+ 参考库 plang_pc 排产口径:
--   客户等级(往来单位.客户价格等级)/型号(商品.规格型号)/工序车间/销售订单数量(客户订单行)/生产计划数量(排产数量)/
--   实际完成数量(已入库回填)/工序交期/交期紧迫度/**7天·15天·大于15天已排产分桶**/产能(工作中心.产量每小时)
IF OBJECT_ID('v_manu_schedule','V') IS NOT NULL DROP VIEW v_manu_schedule;
GO
CREATE VIEW v_manu_schedule AS
SELECT l.id AS id, h.[合同号] AS 加工单号, h.[单据日期] AS 单据日期, h.[销售订单号] AS 销售订单号,
       h.[客户] AS 客户, ISNULL(pt.[客户价格等级], N'') AS 客户等级,
       h.[生产线] AS 生产线, h.[生产车间] AS 生产车间,
       ISNULL(wc.[产量/小时], 0) AS [产能/小时],
       l.[产品编码] AS 产品编码, l.[产品名称] AS 产品名称,
       ISNULL(NULLIF(l.[规格型号], N''), iv.[规格型号]) AS 规格型号, l.[生产单位] AS 生产单位,
       l.[批号] AS 批号,
       ISNULL(so.[数量], 0) AS 销售订单数量,
       ISNULL(l.[需求数量], ISNULL(l.[数量], 0)) AS 需求数量,
       ISNULL(l.[排产数量], 0) AS 排产数量,
       ISNULL(l.[排产数量], 0) AS 生产计划数量,
       -- 入库/完成/余量:头级优先(ManuWritebackService 回写真源在 bd_manu_order.入库数量),行级兜底
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 入库数量,
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 实际完成数量,
       ISNULL(l.[排产数量], 0) - COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 余量,
       CAST(h.[预完工日] AS date) AS 交期,
       CAST(h.[预完工日] AS date) AS 工序交期,
       CASE WHEN h.[预完工日] IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) END AS [交期紧迫度(天)],
       -- 已排产分桶(交期≤7天 / 8~15天 / >15天;逾期归入首桶)
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) <= 7
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [7天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) BETWEEN 8 AND 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [15天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) > 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [大于15天],
       h.[结案] AS 结案,
       -- 五工序完成(单轨:wo_progress 按 加工单号+工序 求和,V1.2 §8.1「完成数=工单报工数求和」)
       -- 与 未完成数量(=排产数量−装箱完成)——吸收原「排单计划 WO_SCHEDULE」看板职责(2026-09-22 单轨改造)
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'混料' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 混料完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'成型' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 成型完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'切炭' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 切炭完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'组装' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 组装完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 装箱完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 未完成数量,
       CASE WHEN ISNULL(st.canceled,'Y') = 'Y' THEN N'已作废'
            WHEN ISNULL(st.stopped,'N') = 'Y' THEN N'已中止'
            WHEN st.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,
       ISNULL(h.[源工单号], N'') AS 源工单号,
       CAST(NULL AS char(1)) AS asp_cancel
FROM dbo.bd_manu_order h
JOIN dbo.bl_manu_order l ON l.[合同号] = h.[合同号] AND ISNULL(l.asp_cancel,'N') <> 'Y'
LEFT JOIN dbo.yj_doc_status st ON st.panel_code = 'MANU_ORDER' AND st.doc_no = h.[合同号]
LEFT JOIN dbo.bs_partner pt ON pt.[往来单位编码] = h.[客户编码] OR (ISNULL(h.[客户编码],N'') = N'' AND pt.[往来单位名称] = h.[客户])
LEFT JOIN dbo.bs_inv iv ON iv.[存货编码] = l.[产品编码]
LEFT JOIN dbo.bs_wc wc ON wc.[工作中心名称] = h.[生产车间] OR wc.[工作中心编码] = h.[生产车间]
LEFT JOIN dbo.bl_so_order so ON so.[单据编号] = h.[销售订单号] AND so.[存货编码] = l.[产品编码]
WHERE ISNULL(h.asp_cancel,'N') <> 'Y';
GO

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
GO

/* ============ F. 多语言:面板名 + 新增字段 en 译名(多语言强制规范) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'生产排产' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('panel',N'生产排产','en',N'Production Scheduling','manual');
-- §8.1 排产看板补列译名
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户等级' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'客户等级','en',N'Customer Tier','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产能/小时' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'产能/小时','en',N'Capacity/Hour','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售订单数量' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'销售订单数量','en',N'Sales Order Qty','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产计划数量' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'生产计划数量','en',N'Planned Qty','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际完成数量' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'实际完成数量','en',N'Completed Qty','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工序交期' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'工序交期','en',N'Process Due Date','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'7天已排产' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'7天已排产','en',N'Scheduled <=7d','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'15天已排产' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'15天已排产','en',N'Scheduled 8-15d','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'大于15天' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'大于15天','en',N'Scheduled >15d','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'混料完成' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'混料完成','en',N'Mixing Done','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成型完成' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'成型完成','en',N'Molding Done','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'切炭完成' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'切炭完成','en',N'Cutting Done','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'组装完成' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'组装完成','en',N'Assembly Done','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'装箱完成' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'装箱完成','en',N'Packing Done','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产线' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'生产线','en',N'Production Line','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'排产数量' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'排产数量','en',N'Scheduled Qty','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'余量' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'余量','en',N'Balance Qty','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外包单号' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'外包单号','en',N'Outsourcing No.','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来料性质' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'来料性质','en',N'Incoming Type','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来料单号' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'来料单号','en',N'Incoming Doc No.','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购入库单号' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'采购入库单号','en',N'Purchase Receipt No.','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据类型' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'单据类型','en',N'Doc Type','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源工单号' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'源工单号','en',N'Source WO No.','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'拆分序号' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'拆分序号','en',N'Split Seq','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交期紧迫度(天)' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'交期紧迫度(天)','en',N'Due Urgency (days)','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加工单号' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'加工单号','en',N'MO No.','manual');
GO

/* ============ H. 真实档案接线:演示下拉 → 档案参照(2026-09-21) ============ */
-- 生单带入的产品编码/车间/单位必须可选可查,否则带入值落在演示候选之外无法维护。
-- 口径与 WO_ORDER(生产工单)一致:产品编码→商品档案、生产车间→工作中心、生产单位→计量单位、负责人→职员。
UPDATE yj_field SET data_type=N'参照', dict_sql=NULL, ref_panel=N'INV', ref_field=N'存货编码', display_field=N'存货名称'
 WHERE panel_code='MANU_ORDER' AND col_name=N'产品编码' AND place=N'detail' AND (ref_panel IS NULL OR ref_panel<>N'INV');
UPDATE yj_field SET data_type=N'参照', dict_sql=NULL, ref_panel=N'WC', ref_field=N'工作中心名称', display_field=N'工作中心名称'
 WHERE panel_code='MANU_ORDER' AND col_name=N'生产车间' AND (ref_panel IS NULL OR ref_panel<>N'WC');
UPDATE yj_field SET data_type=N'参照', dict_sql=NULL, ref_panel=N'UOM', ref_field=N'计量单位名称', display_field=N'计量单位名称'
 WHERE panel_code='MANU_ORDER' AND col_name=N'生产单位' AND (ref_panel IS NULL OR ref_panel<>N'UOM');
UPDATE yj_field SET data_type=N'参照', dict_sql=NULL, ref_panel=N'EMP', ref_field=N'员工编码', display_field=N'员工名称'
 WHERE panel_code='MANU_ORDER' AND col_name=N'负责人' AND (ref_panel IS NULL OR ref_panel<>N'EMP');
-- 批号:种子误设为「正常/加急/特急」下拉;参考库 plang_pc.lot_no 是批号文本(选单由订单批次号带入)
UPDATE yj_field SET data_type=N'文本', dict_sql=NULL
 WHERE panel_code='MANU_ORDER' AND col_name=N'批号' AND place LIKE N'%header%' AND dict_sql IS NOT NULL;

/* ============ G. 校验 ============ */
SELECT N'bd_manu_order 新列' AS 检查, COUNT(*) AS 数量 FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order')
  AND name IN (N'生产线',N'操作员',N'需求数量',N'排产数量',N'入库数量',N'余量',N'入库单号',N'领料单号',N'外包单号',N'结案',N'单据类型',N'来料性质',N'来料单号',N'采购入库单号',N'单价',N'金额',N'源工单号',N'拆分序号')
UNION ALL SELECT N'bl_manu_order 新列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bl_manu_order')
  AND name IN (N'批号',N'需求数量',N'排产数量',N'入库数量',N'余量',N'单价',N'金额')
UNION ALL SELECT N'新列中文注明', COUNT(*) FROM sys.extended_properties WHERE name=N'MS_Description' AND major_id=OBJECT_ID('bd_manu_order')
  AND minor_id IN (COLUMNPROPERTY(OBJECT_ID('bd_manu_order'),N'生产线','ColumnId'),COLUMNPROPERTY(OBJECT_ID('bd_manu_order'),N'排产数量','ColumnId'),COLUMNPROPERTY(OBJECT_ID('bd_manu_order'),N'余量','ColumnId'))
UNION ALL SELECT N'MANU_ORDER 字段数', COUNT(*) FROM yj_field WHERE panel_code='MANU_ORDER'
UNION ALL SELECT N'MANU_SCHEDULE 字段数', COUNT(*) FROM yj_field WHERE panel_code='MANU_SCHEDULE'
UNION ALL SELECT N'生产排产面板', COUNT(*) FROM yj_panel WHERE panel_code='MANU_SCHEDULE';
PRINT N'migrate-manu-order-schedule 完成';
GO
