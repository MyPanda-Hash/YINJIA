/* ============================================================================
 * migrate-qc-insp-rec-detail-cols-20261111.sql
 * 检验数据记录明细表:列顺序重排 + 行号只留一个
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11 第三轮):
 *   ①「行号只需要显示一个,因为都是一致的」
 *   ②「还有物料名称和批次排在最前面」
 *
 * 做法(只动 yj_field 的 label / seq / visible / hidden,**视图与物理列一个字节不改**):
 *   · 物料名称为第一列、物料批次第二列、物料编码第三列(物料三件套挨在一起);
 *   · 四个「行号」列里只留**来料检验单行号**一列,并正名为 **行号**(紧跟 来料检验单号);
 *     采购订单行号 / 送料暂收单行号 / 采购入库单行号 三列 → visible=0、hidden=1
 *     (**数据仍在视图里**,只是不上表格;将来要回来把 visible 改回 1 即可)。
 *   · 其余列相对顺序不变,整体排成:物料 → 单据 → 检验 → 往来 → 链上单号。
 *
 * 为什么可以只留一个行号:这四组行号都来自「来料检验单的一行物料」这一行,
 * 同一条链上通常同为 1(用户口径「都是一致的」);采购订单行号偶有与检验单行号不同
 * (那是订单行在订单里的序号,比如检验单行1 / 订单行2),它的值仍留在视图里可查。
 *
 * 幂等:按 col_name 精确定位,UPDATE 带窄条件;重跑行数为 0。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-insp-rec-detail-cols-20261111 ==';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL')
    RAISERROR(N'[列序] 面板 QC_INSP_REC_DETAIL 不存在 —— 请先执行 migrate-qc-pending-detail-20261111.sql', 16, 1);

/* ── 1. 行号只留一个:来料检验单行号 → 正名「行号」 ── */
DECLARE @n int;
SELECT @n = COUNT(*) FROM yj_field
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name = N'来料检验单行号';
IF @n <> 1 RAISERROR(N'[行号] 来料检验单行号 字段行数为 %d,预期 1 行,已中止', 16, 1, @n);

UPDATE yj_field
   SET label = N'行号', label_en = N'Line No.'
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name = N'来料检验单行号'
   AND ISNULL(label, N'') <> N'行号';
PRINT N'[行号] 来料检验单行号 → 行号(' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';

/* ── 2. 另外三个行号列退出表格(数据仍在视图里,只是 visible=0/hidden=1) ── */
UPDATE yj_field
   SET visible = 0, hidden = 1
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND col_name IN (N'采购订单行号', N'送料暂收单行号', N'采购入库单行号')
   AND (ISNULL(visible, 1) <> 0 OR ISNULL(hidden, 0) <> 1);
PRINT N'[行号] 采购订单行号/送料暂收单行号/采购入库单行号 退出表格(' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';

/* ── 3. 列顺序(seq 就是明细网格的列序;col_name 定位,label 只用于显示) ── */
DECLARE @s TABLE (col sysname, seq int);
INSERT INTO @s (col, seq) VALUES
 (N'物料名称',         10),
 (N'物料批次',         20),
 (N'物料编码',         30),
 (N'单据日期',         40),
 (N'检验数据记录单号', 50),
 (N'来料检验单号',     60),
 (N'来料检验单行号',   70),   -- 上面已正名为「行号」
 (N'检测物料类别',     80),
 (N'来料数量',         90),
 (N'检验状态',        100),
 (N'是否合格',        110),
 (N'供应商',          120),
 (N'检验日期',        130),
 (N'检验人',          140),
 (N'检验结论',        150),
 (N'采购订单号',      160),
 (N'送料暂收单号',    170),
 (N'采购入库单号',    180);

UPDATE f
   SET f.seq = s.seq
  FROM yj_field f JOIN @s s ON s.col = f.col_name
 WHERE f.panel_code = N'QC_INSP_REC_DETAIL' AND ISNULL(f.seq, -1) <> s.seq;
PRINT N'[列序] 重排 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(seq 10..180)';

/* 隐藏辅助列(目录单号/目录行id)永远排在最后,免得被当成正式列;
   三个收起的行号列给 190/200/210,不与仍在显示的「送料暂收单号(170)」撞号(撞号会让列序不稳) */
UPDATE yj_field
   SET seq = CASE col_name
               WHEN N'采购订单行号'   THEN 190
               WHEN N'送料暂收单行号' THEN 200
               WHEN N'采购入库单行号' THEN 210
               WHEN N'目录单号'       THEN 900
               ELSE 910 END
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND col_name IN (N'采购订单行号', N'送料暂收单行号', N'采购入库单行号', N'目录单号', N'目录行id');
GO

/* ── 4. 自检 ── */
DECLARE @bad int = 0;
/* 表格里(visible=1)必须恰好只有 1 个行号列,且它叫「行号」 */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1 AND label LIKE N'%行号%') <> 1
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name = N'来料检验单行号'
                  AND label = N'行号' AND visible = 1)
    SET @bad = @bad + 1;
/* 三个被收起的列必须还存在(只是不显示)—— 数据不能丢 */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'QC_INSP_REC_DETAIL'
       AND col_name IN (N'采购订单行号', N'送料暂收单行号', N'采购入库单行号')
       AND visible = 0 AND hidden = 1) <> 3
    SET @bad = @bad + 1;
/* 前三列 = 物料名称 / 物料批次 / 物料编码 */
IF (SELECT col_name FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1
     ORDER BY seq, id OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY) <> N'物料名称' SET @bad = @bad + 1;
IF (SELECT col_name FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1
     ORDER BY seq, id OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY) <> N'物料批次' SET @bad = @bad + 1;
IF (SELECT col_name FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1
     ORDER BY seq, id OFFSET 2 ROWS FETCH NEXT 1 ROWS ONLY) <> N'物料编码' SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'检验数据记录明细表 列序/行号 自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 明细表列序:物料名称/物料批次/物料编码 打头,行号只留一个';
GO

/* ── 5. 结果对照(表格里实际会出现的列,按显示顺序) ── */
SELECT seq, label AS 列名, col_name AS 视图列, data_type AS 类型, visible, hidden
  FROM yj_field
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
 ORDER BY seq, id;
GO
