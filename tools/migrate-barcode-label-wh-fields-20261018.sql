/* migrate-barcode-label-wh-fields-20261018.sql — 标签可带 仓库/供应商/仓位(有值才显示)

   【用户口径 2026-10-18】「可以加上仓库名、供应商、仓位,没有对应数据就不显示」。
   【数据现实(实测)】
     · 材料(采购入库行):有 供应商(bd_purchase_in.供应商)、有仓库(编码经 yj_erp_wh_map 映射→材料仓);
       行上有 仓位编码/仓位名称两列,但**850 行全空** ⇒ 视图照出「仓位」列,标签在该行为空时自然不显示。
     · 成品(产成品入库行):行上只有 仓库(名称),**没有仓位列、没有供应商** ⇒ 标签只显示仓库名。
     · 半成品(报工派生):既无仓库也无供应商/仓位 ⇒ 三个都不显示。
   【本脚本】材料视图补「仓位」列(21 列);成品/半成品不变。值全部来自实表,不编造。
   幂等:视图 CREATE OR ALTER;字段先清后插;译名 NOT EXISTS。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

CREATE OR ALTER VIEW dbo.v_barcode_material AS
WITH base AS (
    SELECT d.id, d.存货编码, d.存货名称, d.规格型号, d.计量单位, d.批号 AS 原批号,
           h.单据编号, h.单据日期, h.采购订单号, h.供应商, h.单据状态, h.审核人, h.审核时间,
           d.仓库编码, d.实收数量,
           LTRIM(RTRIM(ISNULL(NULLIF(d.仓位名称, ''), ISNULL(d.仓位编码, '')))) AS 仓位,
           CONVERT(varchar(8), h.单据日期, 112) AS 日期码,
           CASE WHEN d.批号 LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%' THEN 1 ELSE 0 END AS 原批号是日期型
    FROM dbo.bd_purchase_in h
    JOIN dbo.bl_purchase_in d ON d.单据编号 = h.单据编号
    WHERE ISNULL(h.asp_cancel, 'N') <> 'Y' AND ISNULL(d.asp_cancel, 'N') <> 'Y'
), seq AS (
    SELECT b.*,
           RIGHT('000' + CAST(ROW_NUMBER() OVER (
                 PARTITION BY b.存货编码, b.日期码, b.原批号是日期型 ORDER BY b.单据编号, b.id) AS varchar(3)), 3) AS 流水,
           ROW_NUMBER() OVER (ORDER BY b.单据日期 DESC, b.id DESC) AS 排序号
    FROM base b
)
SELECT s.排序号 AS id, 'N' AS asp_cancel, N'批次码' AS 码类型,
       RTRIM(ISNULL(s.存货编码, '')) + N'|' +
         CASE WHEN s.原批号是日期型 = 1 THEN RTRIM(s.原批号) ELSE s.日期码 + s.流水 END AS 码内容,
       s.存货编码, s.存货名称, s.规格型号, s.计量单位,
       CASE WHEN s.原批号是日期型 = 1 THEN RTRIM(s.原批号) ELSE s.日期码 + s.流水 END AS 批号,
       CASE WHEN s.原批号是日期型 = 1 THEN N'入库单' ELSE N'日期+流水' END AS 批号来源,
       s.仓库编码,
       ISNULL(w.仓库名称, N'(未映射)') AS 仓库映射,
       CASE WHEN mp.外部仓库编码 IS NULL THEN N'未映射' ELSE N'已映射→' + mp.MES仓库编码 END AS 映射状态,
       s.仓位,
       s.实收数量 AS 数量,
       s.单据编号, s.单据日期, s.采购订单号, s.供应商, s.单据状态, s.审核人,
       CONVERT(varchar(19), s.审核时间, 120) AS 审核时间,
       N'采购入库单' AS 数据来源
FROM seq s
LEFT JOIN dbo.yj_erp_wh_map mp ON mp.外部仓库编码 = RTRIM(ISNULL(s.仓库编码, ''))
LEFT JOIN (SELECT DISTINCT RTRIM(仓库编码) AS 编码, 仓库名称 FROM dbo.bs_wh) w ON w.编码 = mp.MES仓库编码;
GO

/* 字段登记:材料 +1「仓位」(21 列) */
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
    (N'BARCODE_MAT', N'批号来源', N'文本', N'detail', 78, 110),
    (N'BARCODE_MAT', N'仓库编码', N'文本', N'query,detail', 80, 100),
    (N'BARCODE_MAT', N'仓库映射', N'文本', N'detail', 90, 110),
    (N'BARCODE_MAT', N'映射状态', N'文本', N'detail', 100, 130),
    (N'BARCODE_MAT', N'仓位', N'文本', N'detail', 105, 100),
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
    (N'BARCODE_WIP', N'批号来源', N'文本', N'detail', 88, 110),
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
    (N'BARCODE_FIN', N'批号来源', N'文本', N'detail', 78, 110),
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
FROM (VALUES (N'仓位', N'Bin')) AS tv(k, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = tv.k AND t.locale = 'en');
GO

DECLARE @db sysname = DB_NAME(), @bad int = 0;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_MAT') <> 21 SET @bad = @bad + 1;
IF COL_LENGTH('dbo.v_barcode_material', '仓位') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_MAT' AND COL_LENGTH('dbo.v_barcode_material', f.col_name) IS NULL) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'[FAIL] %s 标签仓库/供应商/仓位字段补列未过', 16, 1, @db);
ELSE RAISERROR(N'[OK] %s 材料视图补「仓位」(21 列);成品/半成品不变', 10, 1, @db);
GO
