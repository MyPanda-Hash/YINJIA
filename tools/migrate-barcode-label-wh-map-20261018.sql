/* migrate-barcode-label-wh-map-20261018.sql — 条码面板三件补强
   ① 金蝶仓库 → MES 仓库映射(CK00006/YCL-01 → WH-CL 材料仓)
   ② 打印留痕表 yj_barcode_label_log(打印人/时间/码/单据)
   ③ 视图补列:材料仓加「仓库(映射)/映射状态」,成品仓加「批号状态」
   并同步面板字段登记(材料 17→19,成品 15→16)。

   【用户口径 2026-10-18】「把 CK00006/YCL-01 映射到 MES 的材料仓」「成品仓里咋都是同一个批次号和有些是空的」。
   · 映射口径:两个金蝶仓都是**外部仓**(inh 里名称=恒亿仓/华北工控仓),按用户指定统一映射到 MES 的
     **WH-CL 材料仓**。映射存独立表 yj_erp_wh_map(不改 bs_wh 编码体系 —— bs_wh 是 MES 四层编码,
     金蝶编码塞进去会破坏编码规范)。改口径只需更新该表,视图自动跟随。
   · 成品批号:实测 807 行里 PC0000 = 539 行(金蝶默认批号)、空 = 268 行;头表「批次号」232 行全空;
     真实批次在工单 plang.批次号(20260810/20260819/20260826/20261014 共 429 单)。
     本脚本**不臆造批号**,只把问题显性化:新增「批号状态」列 = 正常 / 默认PC0000 / 缺失。
     回填与否待业务定(见汇报)。

   【幂等】建表/建映射/加列全部带存在性守卫;可重跑。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ===== 1. 金蝶仓库 → MES 仓库映射表 ===== */
IF OBJECT_ID(N'dbo.yj_erp_wh_map', N'U') IS NULL
CREATE TABLE dbo.yj_erp_wh_map (
    外部仓库编码  varchar(50)   NOT NULL CONSTRAINT PK_yj_erp_wh_map PRIMARY KEY,
    MES仓库编码   varchar(50)   NOT NULL,
    备注          nvarchar(200) NULL,
    asp_user1     nvarchar(50)  NULL,
    asp_time1     datetime      NULL CONSTRAINT DF_yj_erp_wh_map_t1 DEFAULT (GETDATE()),
    asp_user2     nvarchar(50)  NULL,
    asp_time2     datetime      NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_erp_wh_map') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'金蝶(ERP)仓库编码 → MES 仓库编码 映射(条码/库存面板按此把外部仓归到 MES 仓;改口径只改数据)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_erp_wh_map';
GO
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(300));
INSERT INTO @cols (tbl, col, note) VALUES
 (N'yj_erp_wh_map', N'外部仓库编码', N'金蝶仓库编码(采购入库单/库存流水里的原值,如 CK00006/YCL-01)'),
 (N'yj_erp_wh_map', N'MES仓库编码',  N'MES 仓库档案 bs_wh.仓库编码(映射目标,如 WH-CL 材料仓)'),
 (N'yj_erp_wh_map', N'备注',        N'映射理由/口径备注(业务确认后回填)');
DECLARE @t sysname, @c sysname, @n nvarchar(300);
DECLARE cur1 CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN cur1; FETCH NEXT FROM cur1 INTO @t, @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @t, @c) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                        WHERE ep.major_id = OBJECT_ID(N'dbo.' + @t) AND ep.name = N'MS_Description'
                          AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t), @c, 'ColumnId'))
        EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    FETCH NEXT FROM cur1 INTO @t, @c, @n;
END
CLOSE cur1; DEALLOCATE cur1;
GO
INSERT INTO dbo.yj_erp_wh_map (外部仓库编码, MES仓库编码, 备注)
SELECT v.外部, v.mes, v.note
FROM (VALUES
    ('CK00006', 'WH-CL', N'金蝶仓(inh 名称=华北工控仓)→ MES 材料仓(用户 2026-10-18 口径)'),
    ('YCL-01',  'WH-CL', N'金蝶仓(inh 名称=恒亿仓)→ MES 材料仓(用户 2026-10-18 口径)')
) AS v(外部, mes, note)
WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_erp_wh_map x WHERE x.外部仓库编码 = v.外部);
GO

/* ===== 2. 打印留痕表 ===== */
IF OBJECT_ID(N'dbo.yj_barcode_label_log', N'U') IS NULL
CREATE TABLE dbo.yj_barcode_label_log (
    id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_yj_barcode_label_log PRIMARY KEY,
    面板编码    varchar(40)   NOT NULL,
    码内容      nvarchar(500) NOT NULL,
    单据编号    nvarchar(100) NULL,
    打印人      nvarchar(100) NULL,
    打印时间    datetime      NOT NULL CONSTRAINT DF_yj_barcode_label_log_t DEFAULT (GETDATE()),
    打印数量    decimal(18,4) NULL,
    备注        nvarchar(500) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_yj_barcode_label_log_code' AND object_id = OBJECT_ID(N'dbo.yj_barcode_label_log'))
    CREATE INDEX IX_yj_barcode_label_log_code ON dbo.yj_barcode_label_log (面板编码, 码内容);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_barcode_label_log') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'条码标签打印留痕(材料/半成品/成品条码面板每打一张标签一行:谁在哪天打了哪个码)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_barcode_label_log';
GO
DECLARE @cols2 TABLE (col sysname, note nvarchar(300));
INSERT INTO @cols2 (col, note) VALUES
 (N'面板编码', N'打印入口面板(BARCODE_MAT / BARCODE_WIP / BARCODE_FIN)'),
 (N'码内容',   N'标签上的码文本(一批一码:编码|批号;为空批号时仅编码)'),
 (N'单据编号', N'码来源单据号(采购入库单/产成品入库单/报工单所在单据)'),
 (N'打印人',   N'打印人(当前登录用户)'),
 (N'打印时间', N'打印时间(服务端时间)'),
 (N'打印数量', N'该行数量(标签上数量随码带出)');
DECLARE @c2 sysname, @n2 nvarchar(300);
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @cols2;
OPEN cur2; FETCH NEXT FROM cur2 INTO @c2, @n2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.major_id = OBJECT_ID(N'dbo.yj_barcode_label_log') AND ep.name = N'MS_Description'
                      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_barcode_label_log'), @c2, 'ColumnId'))
        EXEC sp_addextendedproperty N'MS_Description', @n2, N'SCHEMA', N'dbo', N'TABLE', N'yj_barcode_label_log', N'COLUMN', @c2;
    FETCH NEXT FROM cur2 INTO @c2, @n2;
END
CLOSE cur2; DEALLOCATE cur2;
GO

/* ===== 3. 视图补列 ===== */
CREATE OR ALTER VIEW dbo.v_barcode_material AS
SELECT ROW_NUMBER() OVER (ORDER BY h.单据日期 DESC, d.id DESC) AS id,
       ISNULL(d.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(d.存货编码, '')) + CASE WHEN ISNULL(d.批号, '') <> '' THEN N'|' + d.批号 ELSE N'' END AS 码内容,
       d.存货编码, d.存货名称, d.规格型号, d.计量单位,
       d.批号, d.仓库编码,
       ISNULL(w.仓库名称, N'(未映射)') AS 仓库映射,
       CASE WHEN mp.外部仓库编码 IS NULL THEN N'未映射' ELSE N'已映射→' + mp.MES仓库编码 END AS 映射状态,
       d.实收数量 AS 数量,
       h.单据编号, h.单据日期, h.采购订单号, h.供应商, h.单据状态, h.审核人,
       CONVERT(varchar(19), h.审核时间, 120) AS 审核时间,
       N'采购入库单' AS 数据来源
FROM dbo.bd_purchase_in h
JOIN dbo.bl_purchase_in d ON d.单据编号 = h.单据编号
LEFT JOIN dbo.yj_erp_wh_map mp ON mp.外部仓库编码 = RTRIM(ISNULL(d.仓库编码, ''))
LEFT JOIN (SELECT DISTINCT RTRIM(仓库编码) AS 编码, 仓库名称 FROM dbo.bs_wh) w ON w.编码 = mp.MES仓库编码
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
  AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

CREATE OR ALTER VIEW dbo.v_barcode_finished AS
SELECT ROW_NUMBER() OVER (ORDER BY h.单据日期 DESC, d.id DESC) AS id,
       ISNULL(d.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(d.产品编码, '')) + CASE WHEN ISNULL(d.批号, '') <> '' THEN N'|' + d.批号 ELSE N'' END AS 码内容,
       d.产品编码, d.产品名称, d.规格型号, d.计量单位,
       d.批号,
       CASE WHEN ISNULL(d.批号, '') = '' THEN N'缺失'
            WHEN RTRIM(d.批号) = N'PC0000' THEN N'默认PC0000'
            ELSE N'正常' END AS 批号状态,
       d.仓库 AS 仓库名称, d.实收数量,
       h.单据编号, h.单据日期, h.单据状态, h.审核人,
       CONVERT(varchar(19), h.审核时间, 120) AS 审核时间,
       N'产成品入库单' AS 数据来源
FROM dbo.bd_finish_in h
JOIN dbo.bl_finish_in d ON d.单据编号 = h.单据编号
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
  AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

/* ===== 4. 面板字段登记(先清后插:三面板由条码脚本独占) ===== */
DELETE f FROM yj_field f WHERE f.panel_code IN (N'BARCODE_MAT', N'BARCODE_WIP', N'BARCODE_FIN');
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
    (N'BARCODE_MAT', N'仓库编码', N'文本', N'query,detail', 80, 100),
    (N'BARCODE_MAT', N'仓库映射', N'文本', N'detail', 90, 110),
    (N'BARCODE_MAT', N'映射状态', N'文本', N'detail', 100, 130),
    (N'BARCODE_MAT', N'数量', N'小数', N'detail', 110, 90),
    (N'BARCODE_MAT', N'单据编号', N'文本', N'detail', 120, 130),
    (N'BARCODE_MAT', N'单据日期', N'日期', N'query,detail', 130, 100),
    (N'BARCODE_MAT', N'采购订单号', N'文本', N'detail', 140, 130),
    (N'BARCODE_MAT', N'供应商', N'文本', N'detail', 150, 160),
    (N'BARCODE_MAT', N'单据状态', N'文本', N'detail', 160, 90),
    (N'BARCODE_MAT', N'审核人', N'文本', N'detail', 170, 90),
    (N'BARCODE_MAT', N'审核时间', N'文本', N'detail', 180, 140),
    (N'BARCODE_MAT', N'数据来源', N'文本', N'detail', 190, 150),

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
    (N'BARCODE_WIP', N'数据来源', N'文本', N'detail', 150, 150),

    (N'BARCODE_FIN', N'码内容', N'文本', N'detail', 10, 170),
    (N'BARCODE_FIN', N'码类型', N'文本', N'detail', 20, 70),
    (N'BARCODE_FIN', N'产品编码', N'文本', N'query,detail', 30, 120),
    (N'BARCODE_FIN', N'产品名称', N'文本', N'detail', 40, 180),
    (N'BARCODE_FIN', N'规格型号', N'文本', N'detail', 50, 140),
    (N'BARCODE_FIN', N'计量单位', N'文本', N'detail', 60, 70),
    (N'BARCODE_FIN', N'批号', N'文本', N'query,detail', 70, 120),
    (N'BARCODE_FIN', N'批号状态', N'文本', N'query,detail', 80, 110),
    (N'BARCODE_FIN', N'仓库名称', N'文本', N'detail', 90, 110),
    (N'BARCODE_FIN', N'实收数量', N'小数', N'detail', 100, 90),
    (N'BARCODE_FIN', N'单据编号', N'文本', N'detail', 110, 130),
    (N'BARCODE_FIN', N'单据日期', N'日期', N'query,detail', 120, 100),
    (N'BARCODE_FIN', N'单据状态', N'文本', N'detail', 130, 90),
    (N'BARCODE_FIN', N'审核人', N'文本', N'detail', 140, 90),
    (N'BARCODE_FIN', N'审核时间', N'文本', N'detail', 150, 140),
    (N'BARCODE_FIN', N'数据来源', N'文本', N'detail', 160, 150)
) AS tv(panel_code, label, data_type, place, seq, width)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = tv.panel_code AND f.col_name = tv.label);
GO

/* ===== 5. 新标签译名(en) ===== */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', tv.k, 'en', tv.txt, 'manual'
FROM (VALUES
    (N'仓库映射', N'Mapped warehouse'),
    (N'映射状态', N'Mapping status'),
    (N'批号状态', N'Batch status')
) AS tv(k, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = tv.k AND t.locale = 'en');
GO

/* ===== 6. 自检 ===== */
DECLARE @db sysname = DB_NAME(), @bad int = 0;
IF OBJECT_ID(N'dbo.yj_erp_wh_map') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.yj_barcode_label_log') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM dbo.yj_erp_wh_map) < 2 SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.v_barcode_material', '仓库映射') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.v_barcode_material', '映射状态') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.v_barcode_finished', '批号状态') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_MAT') <> 19 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_WIP') <> 15 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_FIN') <> 16 SET @bad = @bad + 1;
-- 字段必须落在视图里(体检 05 元数据漂移)
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_MAT' AND COL_LENGTH('dbo.v_barcode_material', f.col_name) IS NULL) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_WIP' AND COL_LENGTH('dbo.v_barcode_wip', f.col_name) IS NULL) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_FIN' AND COL_LENGTH('dbo.v_barcode_finished', f.col_name) IS NULL) SET @bad = @bad + 1;
IF @bad > 0
    RAISERROR(N'[FAIL] %s 条码补强自检未过(表/映射/视图列/字段数/字段落点之一)', 16, 1, @db);
ELSE
    RAISERROR(N'[OK] %s 条码补强完成:仓库映射 2 条、打印留痕表、材料 19 列 / 成品 16 列', 10, 1, @db);
GO
