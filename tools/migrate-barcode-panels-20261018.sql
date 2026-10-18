/* migrate-barcode-panels-20261018.sql — WMS 三个「条码管理」面板(材料仓 / 半成品仓 / 成品仓;一批一码)

   【背景】用户 2026-10-18 口径:附件一 WMS 三条「条码管理」先用面板轻量展示;
     三个面板;半成品先用「报工数据派生视图」;码粒度 = 一批一码。
     对应 ds 差距分析 docs/design/智慧工厂清单差距分析.md §1.8/1.9/1.10。

   【做法 —— 纯报表面板,零前端页面】三个 flat 面板指向三个只读视图;视图列名即中文数据键。

   · BARCODE_MAT 材料仓条码管理 -> v_barcode_material
       源 = 采购入库单(bd_purchase_in + bl_purchase_in) —— 材料入库的**正式单据**,一行 = 一个材料批次码。
       ⚠ 不用 inh:2026-10-18 实测 inh 里带批号的行,**仓库编码与仓库名称互相矛盾**
         (编码 YCL-01/CK00006 有 849 行,名称却写成 恒亿仓/成品B仓/华北工控仓 —— 金蝶期初把客户仓写进了材料流水),
         按名称或按档案筛选都会得到自相矛盾的口径;采购入库单口径干净(849 行,批号 665 行,仓库编码 849 行)。
       仓库:采购入库单的仓库编码只有 CK00006/YCL-01 两个(均不在 bs_wh 档案内),故只输出「仓库编码」不输出名称,不编造映射。

   · BARCODE_WIP 半成品仓条码管理 -> v_barcode_wip
       源 = scjl(报工)里 工序 ∈ (成型/切炭) 的行,**报工派生、不进库存**;「数据来源」列明写此事,
       避免被误当成库存储备。组装产出按现流程走成品入库,故不计入半成品。

   · BARCODE_FIN 成品仓条码管理 -> v_barcode_finished
       源 = 产成品入库单(bd_finish_in + bl_finish_in) 头行;仓库取行上的「仓库」名称
       (金蝶仓名 成品B仓/恒亿仓/华北工控仓 不在 bs_wh,故不输出仓库编码)。

   【一批一码】码内容 = 编码|批号(无批号时只留编码)。不生成箱码/托盘码/序列号(需新的码表与扫码作业,属下一阶段)。

   【为什么视图必须带 id/asp_cancel】引擎读 flat 面板固定拼
     SELECT t.<pk_col> ... FROM <视图> t WHERE ISNULL(t.asp_cancel,'N')<>'Y'(DbNormAudit 13 项守这条)。

   【幂等】视图 CREATE OR ALTER;字段先清后插(三面板由本脚本独占);面板/权限/译名 NOT EXISTS。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ===== 1. 三个只读视图 ===== */
CREATE OR ALTER VIEW dbo.v_barcode_material AS
SELECT ROW_NUMBER() OVER (ORDER BY h.单据日期 DESC, d.id DESC) AS id,
       ISNULL(d.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(d.存货编码, '')) + CASE WHEN ISNULL(d.批号, '') <> '' THEN N'|' + d.批号 ELSE N'' END AS 码内容,
       d.存货编码, d.存货名称, d.规格型号, d.计量单位,
       d.批号, d.仓库编码,
       d.实收数量 AS 数量,
       h.单据编号, h.单据日期, h.采购订单号, h.供应商, h.单据状态, h.审核人,
       CONVERT(varchar(19), h.审核时间, 120) AS 审核时间,
       N'采购入库单' AS 数据来源
FROM dbo.bd_purchase_in h
JOIN dbo.bl_purchase_in d ON d.单据编号 = h.单据编号
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
  AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

CREATE OR ALTER VIEW dbo.v_barcode_wip AS
SELECT ROW_NUMBER() OVER (ORDER BY s.sc_date DESC, s.id DESC) AS id,
       ISNULL(s.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(s.wzdm, '')) + CASE WHEN ISNULL(s.lot_no, '') <> '' THEN N'|' + s.lot_no ELSE N'' END AS 码内容,
       s.gxdm AS 工序,
       s.wzdm AS 产品编码, s.mc AS 产品名称, s.gg AS 规格型号, s.jldw AS 计量单位,
       ISNULL(NULLIF(RTRIM(ISNULL(s.lot_no, '')), ''), RTRIM(ISNULL(s.批次号, ''))) AS 批号,
       s.sl AS 报工数量,
       ISNULL(NULLIF(RTRIM(ISNULL(s.报工单号, '')), ''), s.sc_no) AS 报工单号,
       s.gldh AS 工单号, s.工单行号,
       s.sc_date AS 生产日期, s.scxmc AS 生产线,
       N'报工派生(未入库存)' AS 数据来源
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
  AND ISNULL(s.delmark, 0) = 0        -- delmark 是 int:0=未删(早先误写成 <> 'Y' 会报「varchar 值 'Y' 转 int」)
  AND s.gxdm IN (N'成型', N'切炭');
GO

CREATE OR ALTER VIEW dbo.v_barcode_finished AS
SELECT ROW_NUMBER() OVER (ORDER BY h.单据日期 DESC, d.id DESC) AS id,
       ISNULL(d.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(d.产品编码, '')) + CASE WHEN ISNULL(d.批号, '') <> '' THEN N'|' + d.批号 ELSE N'' END AS 码内容,
       d.产品编码, d.产品名称, d.规格型号, d.计量单位,
       d.批号, d.仓库 AS 仓库名称, d.实收数量,
       h.单据编号, h.单据日期, h.单据状态, h.审核人,
       CONVERT(varchar(19), h.审核时间, 120) AS 审核时间,
       N'产成品入库单' AS 数据来源
FROM dbo.bd_finish_in h
JOIN dbo.bl_finish_in d ON d.单据编号 = h.单据编号
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
  AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

/* ===== 2. 视图表级中文注明(与表同一套 MS_Description;有则改、无则加 —— 口径变了能自愈) ===== */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_material') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'材料仓条码台账(一批一码:存货编码|批号;源 采购入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_material';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'材料仓条码台账(一批一码:存货编码|批号;源 采购入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_material';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_wip') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'半成品仓条码台账(报工派生:scjl 工序=成型/切炭;未进库存,仅展示)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_wip';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'半成品仓条码台账(报工派生:scjl 工序=成型/切炭;未进库存,仅展示)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_wip';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_finished') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'成品仓条码台账(一批一码:产品编码|批号;源 产成品入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_finished';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'成品仓条码台账(一批一码:产品编码|批号;源 产成品入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_finished';
GO

/* ===== 3. 三个 flat 面板 ===== */
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table,
                             group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT tv.code, tv.name, tv.name_en, N'报表', 'flat', tv.view_name, NULL, NULL, 'id', NULL, NULL, tv.date_col, 50, 'items', tv.mg
FROM (VALUES
    (N'BARCODE_MAT', N'材料仓条码管理', N'Material Warehouse Barcode', N'v_barcode_material', N'单据日期', N'库存核算'),
    (N'BARCODE_WIP', N'半成品仓条码管理', N'WIP Warehouse Barcode', N'v_barcode_wip', N'生产日期', N'生产制造'),
    (N'BARCODE_FIN', N'成品仓条码管理', N'Finished Goods Warehouse Barcode', N'v_barcode_finished', N'单据日期', N'库存核算')
) AS tv(code, name, name_en, view_name, date_col, mg)
WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = tv.code);
GO

/* ===== 4. 字段登记(place=detail 为列;query,detail 为可查条件) ===== */
/* 先清掉本脚本三面板的字段登记(重跑对齐用;这三个面板由本脚本独占,无人工字段) */
DELETE f FROM yj_field f
 WHERE f.panel_code IN (N'BARCODE_MAT', N'BARCODE_WIP', N'BARCODE_FIN');
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT tv.panel_code, tv.label, tv.label, tv.data_type, tv.place, tv.seq, tv.width, 0, 0, 0, 1
FROM (VALUES
    (N'BARCODE_MAT', N'码内容', N'文本', N'detail', 10, 170),
    (N'BARCODE_MAT', N'码类型', N'文本', N'detail', 20, 70),
    (N'BARCODE_MAT', N'存货编码', N'文本', N'query,detail', 30, 130),
    (N'BARCODE_MAT', N'存货名称', N'文本', N'detail', 40, 180),
    (N'BARCODE_MAT', N'规格型号', N'文本', N'detail', 50, 140),
    (N'BARCODE_MAT', N'计量单位', N'文本', N'detail', 60, 70),
    (N'BARCODE_MAT', N'批号', N'文本', N'query,detail', 70, 120),
    (N'BARCODE_MAT', N'仓库编码', N'文本', N'detail', 80, 100),
    (N'BARCODE_MAT', N'数量', N'小数', N'detail', 90, 90),
    (N'BARCODE_MAT', N'单据编号', N'文本', N'detail', 100, 130),
    (N'BARCODE_MAT', N'单据日期', N'日期', N'query,detail', 110, 100),
    (N'BARCODE_MAT', N'采购订单号', N'文本', N'detail', 120, 130),
    (N'BARCODE_MAT', N'供应商', N'文本', N'detail', 130, 160),
    (N'BARCODE_MAT', N'单据状态', N'文本', N'detail', 140, 90),
    (N'BARCODE_MAT', N'审核人', N'文本', N'detail', 150, 90),
    (N'BARCODE_MAT', N'审核时间', N'文本', N'detail', 160, 140),
    (N'BARCODE_MAT', N'数据来源', N'文本', N'detail', 170, 150)
) AS tv(panel_code, label, data_type, place, seq, width)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = tv.panel_code AND f.col_name = tv.label);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT tv.panel_code, tv.label, tv.label, tv.data_type, tv.place, tv.seq, tv.width, 0, 0, 0, 1
FROM (VALUES
    (N'BARCODE_WIP', N'码内容', N'文本', N'detail', 10, 170),
    (N'BARCODE_WIP', N'码类型', N'文本', N'detail', 20, 70),
    (N'BARCODE_WIP', N'工序', N'文本', N'query,detail', 30, 90),
    (N'BARCODE_WIP', N'产品编码', N'文本', N'query,detail', 40, 120),
    (N'BARCODE_WIP', N'产品名称', N'文本', N'detail', 50, 180),
    (N'BARCODE_WIP', N'规格型号', N'文本', N'detail', 60, 140),
    (N'BARCODE_WIP', N'计量单位', N'文本', N'detail', 70, 70),
    (N'BARCODE_WIP', N'批号', N'文本', N'query,detail', 80, 120),
    (N'BARCODE_WIP', N'报工数量', N'小数', N'detail', 90, 90),
    (N'BARCODE_WIP', N'报工单号', N'文本', N'detail', 100, 130),
    (N'BARCODE_WIP', N'工单号', N'文本', N'detail', 110, 120),
    (N'BARCODE_WIP', N'工单行号', N'文本', N'detail', 120, 80),
    (N'BARCODE_WIP', N'生产日期', N'日期', N'query,detail', 130, 100),
    (N'BARCODE_WIP', N'生产线', N'文本', N'detail', 140, 110),
    (N'BARCODE_WIP', N'数据来源', N'文本', N'detail', 150, 150)
) AS tv(panel_code, label, data_type, place, seq, width)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = tv.panel_code AND f.col_name = tv.label);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT tv.panel_code, tv.label, tv.label, tv.data_type, tv.place, tv.seq, tv.width, 0, 0, 0, 1
FROM (VALUES
    (N'BARCODE_FIN', N'码内容', N'文本', N'detail', 10, 170),
    (N'BARCODE_FIN', N'码类型', N'文本', N'detail', 20, 70),
    (N'BARCODE_FIN', N'产品编码', N'文本', N'query,detail', 30, 120),
    (N'BARCODE_FIN', N'产品名称', N'文本', N'detail', 40, 180),
    (N'BARCODE_FIN', N'规格型号', N'文本', N'detail', 50, 140),
    (N'BARCODE_FIN', N'计量单位', N'文本', N'detail', 60, 70),
    (N'BARCODE_FIN', N'批号', N'文本', N'query,detail', 70, 120),
    (N'BARCODE_FIN', N'仓库名称', N'文本', N'detail', 80, 110),
    (N'BARCODE_FIN', N'实收数量', N'小数', N'detail', 90, 90),
    (N'BARCODE_FIN', N'单据编号', N'文本', N'detail', 100, 130),
    (N'BARCODE_FIN', N'单据日期', N'日期', N'query,detail', 110, 100),
    (N'BARCODE_FIN', N'单据状态', N'文本', N'detail', 120, 90),
    (N'BARCODE_FIN', N'审核人', N'文本', N'detail', 130, 90),
    (N'BARCODE_FIN', N'审核时间', N'文本', N'detail', 140, 140),
    (N'BARCODE_FIN', N'数据来源', N'文本', N'detail', 150, 150)
) AS tv(panel_code, label, data_type, place, seq, width)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = tv.panel_code AND f.col_name = tv.label);
GO

/* ===== 5. 权限:照库存台账(STOCK_LEDGER)已授权的角色与词表复制 ===== */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, p.code, 'N', r.perms
FROM (VALUES (N'BARCODE_MAT'), (N'BARCODE_WIP'), (N'BARCODE_FIN')) AS p(code)
CROSS JOIN (SELECT role_id, perms FROM yj_role_panel WHERE panel_code = N'STOCK_LEDGER') r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.role_id AND x.panel_code = p.code);
GO

/* ===== 6. 多语言(面板名 + 本次新增字段标签,至少 en;其余语言走 trigger-mt) ===== */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT tv.scope, tv.k, tv.locale, tv.txt, 'manual'
FROM (VALUES
    ('field', N'码内容', 'en', N'Barcode'),
    ('field', N'码类型', 'en', N'Barcode type'),
    ('field', N'存货编码', 'en', N'Stock code'),
    ('field', N'存货名称', 'en', N'Stock name'),
    ('field', N'规格型号', 'en', N'Specification'),
    ('field', N'计量单位', 'en', N'Unit'),
    ('field', N'批号', 'en', N'Batch no.'),
    ('field', N'仓库编码', 'en', N'Warehouse code'),
    ('field', N'数量', 'en', N'Quantity'),
    ('field', N'单据编号', 'en', N'Doc no.'),
    ('field', N'单据日期', 'en', N'Doc date'),
    ('field', N'采购订单号', 'en', N'Purchase order no.'),
    ('field', N'供应商', 'en', N'Supplier'),
    ('field', N'单据状态', 'en', N'Doc status'),
    ('field', N'审核人', 'en', N'Auditor'),
    ('field', N'审核时间', 'en', N'Audit time'),
    ('field', N'数据来源', 'en', N'Data source'),
    ('field', N'工序', 'en', N'Process'),
    ('field', N'产品编码', 'en', N'Product code'),
    ('field', N'产品名称', 'en', N'Product name'),
    ('field', N'报工数量', 'en', N'Reported qty'),
    ('field', N'报工单号', 'en', N'Report no.'),
    ('field', N'工单号', 'en', N'Work order no.'),
    ('field', N'工单行号', 'en', N'Work order line'),
    ('field', N'生产日期', 'en', N'Production date'),
    ('field', N'生产线', 'en', N'Production line'),
    ('field', N'仓库名称', 'en', N'Warehouse'),
    ('field', N'实收数量', 'en', N'Received qty'),
    ('panel', N'材料仓条码管理', 'en', N'Material Warehouse Barcode'),
    ('panel', N'半成品仓条码管理', 'en', N'WIP Warehouse Barcode'),
    ('panel', N'成品仓条码管理', 'en', N'Finished Goods Warehouse Barcode')
) AS tv(scope, k, locale, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                   WHERE t.scope = tv.scope AND t.ref_key = tv.k AND t.locale = tv.locale);
GO

/* ===== 7. 自检 ===== */
DECLARE @db sysname = DB_NAME(), @bad int = 0;
DECLARE @chk TABLE (view_name sysname, panel_code varchar(40), expFields int);
INSERT INTO @chk (view_name, panel_code, expFields) VALUES
  (N'v_barcode_material', 'BARCODE_MAT', 17),
  (N'v_barcode_wip',      'BARCODE_WIP', 15),
  (N'v_barcode_finished', 'BARCODE_FIN', 15);

IF (SELECT COUNT(*) FROM @chk c WHERE OBJECT_ID(N'dbo.' + c.view_name) IS NULL) > 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM @chk c WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = c.panel_code)) > 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM @chk c WHERE (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = c.panel_code) <> c.expFields) > 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM @chk c WHERE COL_LENGTH(N'dbo.' + c.view_name, 'id') IS NULL) > 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM @chk c WHERE COL_LENGTH(N'dbo.' + c.view_name, 'asp_cancel') IS NULL) > 0 SET @bad = @bad + 1;
-- 字段必须落在视图里(否则体检 05 元数据漂移)
IF (SELECT COUNT(*) FROM yj_field f JOIN @chk c ON c.panel_code = f.panel_code
     WHERE COL_LENGTH(N'dbo.' + c.view_name, f.col_name) IS NULL) > 0 SET @bad = @bad + 1;

IF @bad > 0
    RAISERROR(N'[FAIL] %s 条码面板自检未过(视图/面板/字段数/必备列/字段落点之一)', 16, 1, @db);
ELSE
    RAISERROR(N'[OK] %s 三个条码面板就绪:材料(采购入库)+ 半成品(报工派生)+ 成品(产成品入库)', 10, 1, @db);
GO
