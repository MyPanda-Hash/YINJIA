/* ============================================================================
 * migrate-qc-insp-rec-detail-rowsplit-20261112.sql
 * 检验数据记录明细表:四个行号恢复分列(每个单号各带自己的行号)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-12 第二轮):
 *   「这个的来料检验行号不一定和送料暂收的行号对应,因为有部分物料是免检的,这个要做好区分」
 *
 * 背景 / 为什么推翻上一版:
 *   前一轮按「行号都是一致的」把四组行号合成了一列(只留 来料检验单行号,正名「行号」)。
 *   用户指出这不成立:**部分物料免检** ⇒ 来料检验单上根本没有这一行(或根本没这张检验单),
 *   而送料暂收单上一定有这一行 ⇒ 两个行号天然不对应,合成一列会让人把检验单行号当成
 *   暂收单行号去核对,对不上还以为数据错了。
 *
 * 做法(只动 yj_field 的 label / seq / visible / hidden;视图与物理列一个字节不改):
 *   · 四个行号全部恢复显示,并**各自贴在自己的单号右边**,成四组「单号 + 行号」:
 *       来料检验单号 + 来料检验单行号
 *       送料暂收单号 + 送料暂收单行号
 *       采购订单号   + 采购订单行号
 *       采购入库单号 + 采购入库行号
 *   · 「行号」这个被合并出来的标签还原成「来料检验单行号」(en: Incoming Inspection Line),
 *     不再用一个笼统的「行号」冒充整条链的行号。
 *   · 四个行号在视图里本来就是**各自独立算的**(分别按 qc_insp_detail / sl_recv_detail /
 *     qc_insp_detail.采购订单行号 / bl_purchase_in 各自的行序),不存在"抄一个值给四列"的情况;
 *     本脚本只是把被隐藏的三列放回来。
 *
 * 免检口径(写在列说明里,免得以后又合并):
 *   免检物料走「暂收 → 免检 → 采购入库」,没有来料检验单 ⇒ 这一行的
 *   **来料检验单号 / 来料检验单行号为空**,而 送料暂收单号+行号 / 采购订单号+行号 照常有值。
 *   此时"暂收单行号 ≠ 检验单行号"是正常现象,不是数据错误。
 *
 * 幂等:按 col_name 精确定位,UPDATE 带窄条件;重跑行数为 0。两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-insp-rec-detail-rowsplit-20261112 ==';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL')
    RAISERROR(N'[行号] 面板 QC_INSP_REC_DETAIL 不存在 —— 请先执行 migrate-qc-pending-detail-20261111.sql', 16, 1);

/* ── 1. 「行号」还原为「来料检验单行号」(标签即数据键;视图列名一直是 来料检验单行号) ── */
DECLARE @n int;
SELECT @n = COUNT(*) FROM yj_field
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name = N'来料检验单行号';
IF @n <> 1 RAISERROR(N'[行号] 来料检验单行号 字段行数为 %d,预期 1 行,已中止', 16, 1, @n);

UPDATE yj_field
   SET label = N'来料检验单行号', label_en = N'Incoming Inspection Line', visible = 1, hidden = 0
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name = N'来料检验单行号'
   AND (ISNULL(label, N'') <> N'来料检验单行号' OR ISNULL(visible, 1) <> 1 OR ISNULL(hidden, 0) <> 0);
PRINT N'[行号] 行号 → 来料检验单行号(' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';

/* ── 2. 另外三个行号重新显示 ── */
UPDATE yj_field
   SET visible = 1, hidden = 0
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND col_name IN (N'采购订单行号', N'送料暂收单行号', N'采购入库单行号')
   AND (ISNULL(visible, 1) <> 1 OR ISNULL(hidden, 0) <> 0);
PRINT N'[行号] 采购订单行号/送料暂收单行号/采购入库行号 恢复显示(' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';
GO

/* ── 3. 列序:四组「单号 + 行号」各自相邻 ── */
DECLARE @s TABLE (col sysname, seq int);
INSERT INTO @s (col, seq) VALUES
 (N'物料名称',         10),
 (N'物料批次',         20),
 (N'物料编码',         30),
 (N'单据日期',         40),
 (N'检验数据记录单号', 50),
 (N'来料检验单号',     60),
 (N'来料检验单行号',   70),
 (N'送料暂收单号',     80),
 (N'送料暂收单行号',   90),
 (N'采购订单号',      100),
 (N'采购订单行号',    110),
 (N'采购入库单号',    120),
 (N'采购入库单行号',  130),
 (N'检测物料类别',    140),
 (N'来料数量',        150),
 (N'检验状态',        160),
 (N'是否合格',        170),
 (N'供应商',          180),
 (N'检验日期',        190),
 (N'检验人',          200),
 (N'检验结论',        210);

UPDATE f
   SET f.seq = s.seq
  FROM yj_field f JOIN @s s ON s.col = f.col_name
 WHERE f.panel_code = N'QC_INSP_REC_DETAIL' AND ISNULL(f.seq, -1) <> s.seq;
PRINT N'[列序] 重排 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(seq 10..210)';

/* 隐藏辅助列固定排最后 */
UPDATE yj_field
   SET seq = CASE col_name WHEN N'目录单号' THEN 900 ELSE 910 END
 WHERE panel_code = N'QC_INSP_REC_DETAIL' AND col_name IN (N'目录单号', N'目录行id');
GO

/* ── 4. 中文注明补一句「免检时检验单行号为空,暂收/订单行号照常有值」 ── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.v_qc_insp_rec_detail'), N'来料检验单行号', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'该物料行在 qc_insp_detail 内的行序(按 id,排除作废行;与检验单界面序号同口径)。免检物料没有检验单 ⇒ 本列为空,而 送料暂收单号/行号、采购订单号/行号 照常有值 —— 两个行号不对应是正常的,不要拿来互相核对',
    N'SCHEMA', N'dbo', N'VIEW', N'v_qc_insp_rec_detail', N'COLUMN', N'来料检验单行号';
GO

/* ── 5. 自检 ── */
DECLARE @bad int = 0;
/* 四个行号都必须显示,且标签各不相同(不许再出现笼统的「行号」) */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'QC_INSP_REC_DETAIL'
       AND col_name IN (N'来料检验单行号', N'采购订单行号', N'送料暂收单行号', N'采购入库单行号')
       AND visible = 1 AND hidden = 0) <> 4
    SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND label = N'行号')
    SET @bad = @bad + 1;
/* 每个行号必须紧跟在自己的单号后面(seq 差 10) */
IF EXISTS (
     SELECT 1 FROM yj_field a JOIN yj_field b
            ON b.panel_code = a.panel_code AND b.seq = a.seq + 10
      WHERE a.panel_code = N'QC_INSP_REC_DETAIL'
        AND ((a.col_name = N'来料检验单号'   AND b.col_name <> N'来料检验单行号')
          OR (a.col_name = N'送料暂收单号'   AND b.col_name <> N'送料暂收单行号')
          OR (a.col_name = N'采购订单号'     AND b.col_name <> N'采购订单行号')
          OR (a.col_name = N'采购入库单号'   AND b.col_name <> N'采购入库单行号')))
    SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'检验数据记录明细表 行号分列 自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 四组「单号 + 行号」已分列(来料检验/送料暂收/采购订单/采购入库各带自己的行号)';
GO

/* ── 6. 结果对照(表格里实际会出现的列,按显示顺序) ── */
SELECT seq, label AS 列名, col_name AS 视图列, visible, hidden
  FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' ORDER BY seq, id;
GO
