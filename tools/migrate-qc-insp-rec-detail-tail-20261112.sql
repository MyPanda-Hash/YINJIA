/* ============================================================================
 * migrate-qc-insp-rec-detail-tail-20261112.sql
 * 检验数据记录明细表:链上三个单号挪到最右边,三个行号收起不显示
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-12 第三轮,截图红框圈住 送料暂收单号/行号 + 采购订单号/行号 + 采购入库单号/行号):
 *   「放到最后面并且把行号隐藏」
 *
 * 做法(只动 yj_field 的 seq / visible / hidden;视图、物理列、标签一个字节不改):
 *   · **三个单号挪到最后**:送料暂收单号(160)、采购订单号(170)、采购入库单号(180),
 *     排在 检验结论 之后、行操作列之前(保持截图里的 暂收 → 订单 → 入库 顺序);
 *   · **三个行号收起**(visible=0、hidden=1):送料暂收单行号、采购订单行号、采购入库行号 ——
 *     **数据仍在视图里**(v_qc_insp_rec_detail 27 列未动),只是不上表格;
 *   · 来料检验单行号**保持显示**(截图红框没圈它):它才是这条检验记录自己的行号。
 *
 * 为什么可以收:这一列是「一条检验数据记录 = 来料检验单一行物料」,对账靠 来料检验单行号;
 *   暂收/订单/入库 的行号是那几张单据内部的行序(免检物料还会与检验单行号不同),
 *   日常看单不需要,需要时把 visible 改回 1 即可(或用「表格调整」临时勾出来)。
 *
 * 幂等:按 col_name 精确定位;重跑行数为 0。两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-insp-rec-detail-tail-20261112 ==';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL')
    RAISERROR(N'[列序] 面板 QC_INSP_REC_DETAIL 不存在 —— 请先执行 migrate-qc-pending-detail-20261111.sql', 16, 1);

/* ── 1. 三个链上行号收起(数据保留) ── */
UPDATE yj_field
   SET visible = 0, hidden = 1
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND col_name IN (N'送料暂收单行号', N'采购订单行号', N'采购入库单行号')
   AND (ISNULL(visible, 1) <> 0 OR ISNULL(hidden, 0) <> 1);
PRINT N'[隐藏] 送料暂收单行号/采购订单行号/采购入库行号 收起(' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';

/* ── 2. 列序:三个单号挪到检验结论之后(最右边),检验单行号仍跟在检验单号后面 ── */
DECLARE @s TABLE (col sysname, seq int);
INSERT INTO @s (col, seq) VALUES
 (N'物料名称',         10),
 (N'物料批次',         20),
 (N'物料编码',         30),
 (N'单据日期',         40),
 (N'检验数据记录单号', 50),
 (N'来料检验单号',     60),
 (N'来料检验单行号',   70),
 (N'检测物料类别',     80),
 (N'来料数量',         90),
 (N'检验状态',        100),
 (N'是否合格',        110),
 (N'供应商',          120),
 (N'检验日期',        130),
 (N'检验人',          140),
 (N'检验结论',        150),
 (N'送料暂收单号',    160),   -- ↓ 链上三单挪到最后
 (N'采购订单号',      170),
 (N'采购入库单号',    180),
 -- 三个收起的行号紧跟在各自单号之后(将来放开时位置也对)
 (N'送料暂收单行号',  190),
 (N'采购订单行号',    200),
 (N'采购入库单行号',  210);

UPDATE f
   SET f.seq = s.seq
  FROM yj_field f JOIN @s s ON s.col = f.col_name
 WHERE f.panel_code = N'QC_INSP_REC_DETAIL' AND ISNULL(f.seq, -1) <> s.seq;
PRINT N'[列序] 重排 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(链上三单 seq 160/170/180)';

UPDATE yj_field
   SET seq = CASE col_name WHEN N'目录单号' THEN 900 ELSE 910 END
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name IN (N'目录单号', N'目录行id');
GO

/* ── 3. 自检(用变量逐项判定:IF 里直接嵌 OFFSET/FETCH 子查询的写法在整脚本批次里
      偶发判错,改成"先取值再比",结果可复现、也更好读) ── */
DECLARE @bad int = 0;
DECLARE @hiddenCnt int, @itemLineVisible int;
DECLARE @last1 sysname, @last2 sysname, @last3 sysname;

SELECT @hiddenCnt = COUNT(*) FROM yj_field
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND col_name IN (N'送料暂收单行号', N'采购订单行号', N'采购入库单行号')
   AND visible = 0 AND hidden = 1;
SELECT @itemLineVisible = COUNT(*) FROM yj_field
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name = N'来料检验单行号' AND visible = 1;
SELECT @last1 = col_name FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1
 ORDER BY seq DESC, id DESC OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY;
SELECT @last2 = col_name FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1
 ORDER BY seq DESC, id DESC OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY;
SELECT @last3 = col_name FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND visible = 1
 ORDER BY seq DESC, id DESC OFFSET 2 ROWS FETCH NEXT 1 ROWS ONLY;

/* 三个行号已收起;检验单行号仍显示;最右三列 = 送料暂收单号 / 采购订单号 / 采购入库单号 */
IF ISNULL(@hiddenCnt, 0) <> 3 SET @bad = @bad + 1;
IF ISNULL(@itemLineVisible, 0) <> 1 SET @bad = @bad + 1;
IF ISNULL(@last1, N'') <> N'采购入库单号' SET @bad = @bad + 1;
IF ISNULL(@last2, N'') <> N'采购订单号' SET @bad = @bad + 1;
IF ISNULL(@last3, N'') <> N'送料暂收单号' SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'链上三单挪到最后 / 行号收起 自检失败(坏项 %d:收起数 %d、检验单行号可见 %d、最右 %s/%s/%s)',
                      16, 1, @bad, @hiddenCnt, @itemLineVisible, @last1, @last2, @last3);
ELSE PRINT N'[OK] 暂收/订单/入库 三个单号已到最右,三个行号已收起(数据仍在视图)';
GO

/* ── 4. 结果对照 ── */
SELECT seq, label AS 列名, col_name AS 视图列, visible, hidden
  FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' ORDER BY seq, id;
GO
