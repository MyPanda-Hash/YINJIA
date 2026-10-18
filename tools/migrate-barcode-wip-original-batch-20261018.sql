/* migrate-barcode-wip-original-batch-20261018.sql — 半成品条码面板补「原始批号」列

   【用户口径 2026-10-18】「把原始批号也补上」。材料/成品面板已有「原始批号」,半成品还缺。
   【半成品怎么来的】报工表 scjl:lot_no 是真批号(日期型,如 20261014),批次号作兜底;
     视图批号 = lot_no,空则回退 批次号 ⇒ 补一列「原始批号」= lot_no 原值(不动它),
     与「批号来源=报工单」一起看,就能分辨"批号是报工带的还是兜底来的"。
   面板列数:半成品 17(16 → 17)。幂等:视图 CREATE OR ALTER;字段先清后插。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

CREATE OR ALTER VIEW dbo.v_barcode_wip AS
SELECT ROW_NUMBER() OVER (ORDER BY s.sc_date DESC, s.id DESC) AS id,
       ISNULL(s.asp_cancel, 'N') AS asp_cancel,
       N'批次码' AS 码类型,
       RTRIM(ISNULL(s.wzdm, '')) + CASE WHEN ISNULL(s.lot_no, '') <> '' THEN N'|' + s.lot_no ELSE N'' END AS 码内容,
       s.gxdm AS 工序,
       s.wzdm AS 产品编码, s.mc AS 产品名称, s.gg AS 规格型号, s.jldw AS 计量单位,
       ISNULL(NULLIF(RTRIM(ISNULL(s.lot_no, '')), ''), RTRIM(ISNULL(s.批次号, ''))) AS 批号,
       RTRIM(ISNULL(s.lot_no, '')) AS 原始批号,
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

/* 视图注明(与表同一套 MS_Description) */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.v_barcode_wip') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'半成品仓条码台账(报工派生:scjl 工序=成型/切炭;批号取自报工 lot_no,日期型;原始批号另列;未进库存,仅展示)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_wip';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'半成品仓条码台账(报工派生:scjl 工序=成型/切炭;批号取自报工 lot_no,日期型;原始批号另列;未进库存,仅展示)', N'SCHEMA', N'dbo', N'VIEW', N'v_barcode_wip';
GO

/* 字段登记:三面板先清后插(与 migrate-barcode-batch-by-date-20261018.sql 同口径,仅半成品 +1 列) */
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
    (N'BARCODE_WIP', N'原始批号', N'文本', N'detail', 85, 110),
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

/* 自检 */
DECLARE @db sysname = DB_NAME(), @bad int = 0;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_MAT') <> 21 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_WIP') <> 17 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BARCODE_FIN') <> 17 SET @bad = @bad + 1;
IF COL_LENGTH('dbo.v_barcode_wip', '原始批号') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'BARCODE_WIP' AND COL_LENGTH('dbo.v_barcode_wip', f.col_name) IS NULL) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'[FAIL] %s 半成品「原始批号」补列未过', 16, 1, @db);
ELSE RAISERROR(N'[OK] %s 半成品面板补「原始批号」:材料 21 / 半成品 17 / 成品 17 列', 10, 1, @db);
GO
