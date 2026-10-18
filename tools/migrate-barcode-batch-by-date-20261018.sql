/* migrate-barcode-batch-by-date-20261018.sql — 条码面板批号改为「日期型」口径

   【用户口径 2026-10-18】「批号是用日期来表示」。
   【实测原始数据】采购入库行 849:批号 PC0000 = 665、空 = 184,**没有一条真批号**;
     产成品入库行 807:PC0000 = 539、空 = 268,同样没有真批号。
     (金蝶把 PC0000 当默认占位;MES 侧自产生的批号形态是 20261014 / 2026081800002 / 20260806000200004,
      即**日期 + 流水**;工单 plang.批次号 = 20260810/19/26/20261014 也全是 8 位日期。)
   【同日重码】若只用 yyyyMMdd,材料有 194 组同日同料(多余 228 行)、成品 119 组(多余 175 行)会撞码
     ⇒ 按项目既有批号规范「入库日期 + 3 位流水」生成:yyyyMMdd + 3 位序号(同编码同日期内按行序)。

   【口径(不覆盖真实批号)】视图新增:
     · 批号        = 原批号若是日期型(8 位数字开头)→ 原样;否则 = yyyyMMdd + 3 位流水
     · 原始批号    = 单据上的原值(PC0000 / 空),留证不丢
     · 批号来源    = 入库单原值 / 日期+流水
     码内容同步改成「编码|批号(日期型)」——这就是标签二维码里的文本。
   半成品原本就是日期型(lot_no=20261014 等),只补一列「批号来源」= 报工单。

   【幂等】视图 CREATE OR ALTER;字段先清后插;译名 NOT EXISTS。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

CREATE OR ALTER VIEW dbo.v_barcode_material AS
WITH base AS (
    SELECT d.id, d.存货编码, d.存货名称, d.规格型号, d.计量单位, d.批号 AS 原始批号,
           h.单据编号, h.单据日期, h.采购订单号, h.供应商, h.单据状态, h.审核人, h.审核时间,
           d.仓库编码, d.实收数量,
           CONVERT(varchar(8), h.单据日期, 112) AS 日期码,
           CASE WHEN d.批号 LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%' THEN 1 ELSE 0 END AS 原批号是日期型
    FROM dbo.bd_purchase_in h
    JOIN dbo.bl_purchase_in d ON d.单据编号 = h.单据编号
    WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
      AND ISNULL(d.asp_cancel, 'N') <> 'Y'
), seq AS (
    SELECT b.*,
           RIGHT('000' + CAST(ROW_NUMBER() OVER (
                 PARTITION BY b.存货编码, b.日期码, b.原批号是日期型 ORDER BY b.单据编号, b.id) AS varchar(3)), 3) AS 流水,
           ROW_NUMBER() OVER (ORDER BY b.单据日期 DESC, b.id DESC) AS 排序号
    FROM base b
)
SELECT s.排序号 AS id,
       'N' AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(s.存货编码, '')) + N'|' +
         CASE WHEN s.原批号是日期型 = 1 THEN RTRIM(s.原始批号) ELSE s.日期码 + s.流水 END AS 码内容,
       s.存货编码, s.存货名称, s.规格型号, s.计量单位,
       CASE WHEN s.原批号是日期型 = 1 THEN RTRIM(s.原始批号) ELSE s.日期码 + s.流水 END AS 批号,
       s.原始批号,
       CASE WHEN s.原批号是日期型 = 1 THEN N'入库单原值'
            ELSE N'日期+流水(原 ' + CASE WHEN ISNULL(s.原始批号,'') = '' THEN N'空' ELSE RTRIM(s.原始批号) END + N')' END AS 批号来源,
       s.仓库编码,
       ISNULL(w.仓库名称, N'(未映射)') AS 仓库映射,
       CASE WHEN mp.外部仓库编码 IS NULL THEN N'未映射' ELSE N'已映射→' + mp.MES仓库编码 END AS 映射状态,
       s.实收数量 AS 数量,
       s.单据编号, s.单据日期, s.采购订单号, s.供应商, s.单据状态, s.审核人,
       CONVERT(varchar(19), s.审核时间, 120) AS 审核时间,
       N'采购入库单' AS 数据来源
FROM seq s
LEFT JOIN dbo.yj_erp_wh_map mp ON mp.外部仓库编码 = RTRIM(ISNULL(s.仓库编码, ''))
LEFT JOIN (SELECT DISTINCT RTRIM(仓库编码) AS 编码, 仓库名称 FROM dbo.bs_wh) w ON w.编码 = mp.MES仓库编码;
GO

CREATE OR ALTER VIEW dbo.v_barcode_finished AS
WITH base AS (
    SELECT d.id, d.产品编码, d.产品名称, d.规格型号, d.计量单位, d.批号 AS 原始批号,
           h.单据编号, h.单据日期, h.单据状态, h.审核人, h.审核时间,
           d.仓库 AS 仓库名称, d.实收数量,
           CONVERT(varchar(8), h.单据日期, 112) AS 日期码,
           CASE WHEN d.批号 LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%' THEN 1 ELSE 0 END AS 原批号是日期型
    FROM dbo.bd_finish_in h
    JOIN dbo.bl_finish_in d ON d.单据编号 = h.单据编号
    WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
      AND ISNULL(d.asp_cancel, 'N') <> 'Y'
), seq AS (
    SELECT b.*,
           RIGHT('000' + CAST(ROW_NUMBER() OVER (
                 PARTITION BY b.产品编码, b.日期码, b.原批号是日期型 ORDER BY b.单据编号, b.id) AS varchar(3)), 3) AS 流水,
           ROW_NUMBER() OVER (ORDER BY b.单据日期 DESC, b.id DESC) AS 排序号
    FROM base b
)
SELECT s.排序号 AS id,
       'N' AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(s.产品编码, '')) + N'|' +
         CASE WHEN s.原批号是日期型 = 1 THEN RTRIM(s.原始批号) ELSE s.日期码 + s.流水 END AS 码内容,
       s.产品编码, s.产品名称, s.规格型号, s.计量单位,
       CASE WHEN s.原批号是日期型 = 1 THEN RTRIM(s.原始批号) ELSE s.日期码 + s.流水 END AS 批号,
       s.原始批号,
       CASE WHEN s.原批号是日期型 = 1 THEN N'入库单原值'
            ELSE N'日期+流水(原 ' + CASE WHEN ISNULL(s.原始批号,'') = '' THEN N'空' ELSE RTRIM(s.原始批号) END + N')' END AS 批号来源,
       s.仓库名称, s.实收数量,
       s.单据编号, s.单据日期, s.单据状态, s.审核人,
       CONVERT(varchar(19), s.审核时间, 120) AS 审核时间,
       N'产成品入库单' AS 数据来源
FROM seq s;
GO

CREATE OR ALTER VIEW dbo.v_barcode_wip AS
SELECT ROW_NUMBER() OVER (ORDER BY s.sc_date DESC, s.id DESC) AS id,
       ISNULL(s.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(s.wzdm, '')) + CASE WHEN ISNULL(s.lot_no, '') <> '' THEN N'|' + s.lot_no ELSE N'' END AS 码内容,
       s.gxdm AS 工序,
       s.wzdm AS 产品编码, s.mc AS 产品名称, s.gg AS 规格型号, s.jldw AS 计量单位,
       ISNULL(NULLIF(RTRIM(ISNULL(s.lot_no, '')), ''), RTRIM(ISNULL(s.批次号, ''))) AS 批号,
       N'报工单' AS 批号来源,
       s.sl AS 报工数量,
       ISNULL(NULLIF(RTRIM(ISNULL(s.报工单号, '')), ''), s.sc_no) AS 报工单号,
       s.gldh AS 工单号, s.工单行号,
       s.sc_date AS 生产日期, s.scxmc AS 生产线,
       N'报工派生(未入库存)' AS 数据来源
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
  AND ISNULL(s.delmark, 0) = 0
  AND s.gxdm IN (N'成型', N'切炭');
GO

/* ===== 视图批号口径注明 ===== */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_material') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'材料仓条码台账(批号=日期+3位流水;原批号另列保留;源 采购入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_material';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'材料仓条码台账(批号=日期+3位流水;原批号另列保留;源 采购入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_material';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_finished') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'成品仓条码台账(批号=日期+3位流水;原批号另列保留;源 产成品入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_finished';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'成品仓条码台账(批号=日期+3位流水;原批号另列保留;源 产成品入库单 头行)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_finished';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_wip') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'半成品仓条码台账(报工派生:scjl 工序=成型/切炭;批号取自报工 lot_no,日期型;未进库存,仅展示)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_wip';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'半成品仓条码台账(报工派生:scjl 工序=成型/切炭;批号取自报工 lot_no,日期型;未进库存,仅展示)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_wip';
GO

/* ===== 字段登记(先清后插) ===== */
DELETE f FROM yj_field f WHERE f.panel_code IN (N'BARCODE_MAT', N'BARCODE_WIP', N'BARCODE_FIN');
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT tv.panel_code, tv.label, tv.label, tv.data_type, tv.place, tv.seq, tv.width, 0, 0, 0, 1
FROM (VALUES
    (N'BARCODE_MAT', N'码内容', N'文本', N'detail', 10, 190),
    (N'BARCODE_MAT', N'码类型', N'文本', N'detail', 20, 70),
    (N'BARCODE_MAT', N'存货编码', N'文本', N'query,detail', 30, 130),
    (N'BARCODE_MAT', N'存货名称', N'文本', N'detail', 40, 180),
    (N'BARCODE_MAT', N'规格型号', N'文本', N'detail', 50, 140),
    (N'BARCODE_MAT', N'计量单位', N'文本', N'detail', 60, 70),
    (N'BARCODE_MAT', N'批号', N'文本', N'query,detail', 70, 130),
    (N'BARCODE_MAT', N'原始批号', N'文本', N'detail', 75, 110),
    (N'BARCODE_MAT', N'批号来源', N'文本', N'detail', 78, 150),
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
    (N'BARCODE_WIP', N'批号来源', N'文本', N'detail', 85, 110),
    (N'BARCODE_WIP', N'报工数量', N'小数', N'detail', 90, 90),
    (N'BARCODE_WIP', N'报工单号', N'文本', N'detail', 100, 130),
    (N'BARCODE_WIP', N'工单号', N'文本', N'detail', 110, 120),
    (N'BARCODE_WIP', N'工单行号', N'文本', N'detail', 120, 80),
    (N'BARCODE_WIP', N'生产日期', N'日期', N'query,detail', 130, 100),
    (N'BARCODE_WIP', N'生产线', N'文本', N'detail', 140, 110),
    (N'BARCODE_WIP', N'数据来源', N'文本', N'detail', 150, 150),

    (N'BARCODE_FIN', N'码内容', N'文本', N'detail', 10, 190),
    (N'BARCODE_FIN', N'码类型', N'文本', N'detail', 20, 70),
    (N'BARCODE_FIN', N'产品编码', N'文本', N'query,detail', 30, 120),
    (N'BARCODE_FIN', N'产品名称', N'文本', N'detail', 40, 180),
    (N'BARCODE_FIN', N'规格型号', N'文本', N'detail', 50, 140),
    (N'BARCODE_FIN', N'计量单位', N'文本', N'detail', 60, 70),
    (N'BARCODE_FIN', N'批号', N'文本', N'query,detail', 70, 130),
    (N'BARCODE_FIN', N'原始批号', N'文本', N'detail', 75, 110),
    (N'BARCODE_FIN', N'批号来源', N'文本', N'detail', 78, 150),
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

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', tv.k, 'en', tv.txt, 'manual'
FROM (VALUES (N'原始批号', N'Original batch'), (N'批号来源', N'Batch source')) AS tv(k, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = tv.k AND t.locale = 'en');
GO

/* ===== 自检 ===== */
DECLARE @db sysname = DB_NAME(), @bad int = 0;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_MAT') <> 21 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_WIP') <> 16 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_FIN') <> 17 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_MAT' AND COL_LENGTH('dbo.v_barcode_material', f.col_name) IS NULL) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_WIP' AND COL_LENGTH('dbo.v_barcode_wip', f.col_name) IS NULL) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_FIN' AND COL_LENGTH('dbo.v_barcode_finished', f.col_name) IS NULL) SET @bad = @bad + 1;
-- 码内容必须无空、且同面板内不重复(一批一码)
IF EXISTS (SELECT 1 FROM dbo.v_barcode_material WHERE ISNULL(码内容,'') = '') SET @bad = @bad + 1;
IF EXISTS (SELECT 码内容 FROM dbo.v_barcode_material GROUP BY 码内容 HAVING COUNT(*) > 1) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.v_barcode_finished WHERE ISNULL(码内容,'') = '') SET @bad = @bad + 1;
IF EXISTS (SELECT 码内容 FROM dbo.v_barcode_finished GROUP BY 码内容 HAVING COUNT(*) > 1) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'[FAIL] %s 批号日期口径自检未过', 16, 1, @db);
ELSE RAISERROR(N'[OK] %s 批号=日期+3位流水(材料 21 列 / 半成品 16 列 / 成品 17 列,码唯一)', 10, 1, @db);
GO
