-- migrate-sample-int-paper-rows-20261106.sql — 内部样品单改回「Excel 纸面」版式，并支持底部「新增样品」行
--
-- 用户口径(2026-11-06 第二轮，纠正上一版):
--   「内部的样品开发单的格式还是要和 Excel 的一样的，只不过是和外部开发样品申请单的底部的新增样品数据行
--     一样的操作，而不是表格类的面板」
--   ⇒ 上一版把它改成「单表档案式数据面板(archive)」是改错了：要的是**和模板一样的 Excel 纸面**
--     （13 列横排表、纸张版式），行操作对外部单同款的「新增样品」按钮（多个样品行可增删）。
--
-- 改法：
--   ① rd_sample_int_detail 补齐 13 个行内列（原来只有单据编号+留痕列，业务字段全在头表）；
--      存量：每张头表单据落一条明细行把值带过去（幂等：该单已有存活行则跳过）。
--   ② yj_panel 恢复「头行式文书」：mode=doc、head=rd_sample_int_head、line=rd_sample_int_detail、
--      group_col=单据编号、code_col=单据编号、prefix=SPN、date_col=单据日期。
--   ③ yj_field：单据编号/单据日期/备注 归 header（纸面抬头与签注），其余 13 格归 detail
--      （行源 = 明细），并补两个行内字段 申请日期 / 样品编号。
--   前端 docSheetConfigs.sampleIntSheetCfg 同步改成 rows:'detail' + addLabel:'新增样品'。
--   审批：PanelxList 名单里本单**不在审批按钮组**（用户口径「不需要提交审批」），保存即留档。
--
-- 幂等：建列前查 INFORMATION_SCHEMA；回填按「该单已有存活明细行则跳过」；字段 place/seq 一律重设。
-- 适用：本地/生产通用（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）。

IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 1. 明细表补列 ──────────────────────────────────────────────────────────
DECLARE @cols TABLE (c NVARCHAR(100) NOT NULL PRIMARY KEY, t NVARCHAR(200) NOT NULL);
INSERT INTO @cols (c, t) VALUES
 (N'申请日期', N'nvarchar(20)'), (N'申请人', N'nvarchar(50)'), (N'样品编号', N'nvarchar(50)'),
 (N'项目名', N'nvarchar(200)'), (N'炭棒尺寸', N'nvarchar(200)'), (N'数量', N'nvarchar(50)'),
 (N'样品背景', N'nvarchar(500)'), (N'配方要求', N'nvarchar(500)'), (N'工艺要求', N'nvarchar(500)'),
 (N'物料批次要求', N'nvarchar(500)'), (N'期望交期', N'nvarchar(20)'), (N'确认人', N'nvarchar(200)'),
 (N'样品状态', N'nvarchar(20)');
DECLARE @c NVARCHAR(100), @t NVARCHAR(200), @sql NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT c, t FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = N'rd_sample_int_detail' AND COLUMN_NAME = @c)
    BEGIN
        SET @sql = N'ALTER TABLE rd_sample_int_detail ADD [' + @c + N'] ' + @t + N' NULL';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM cur INTO @c, @t;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ── 2. 存量回填：一张单一条明细行（已有存活行的跳过） ──────────────────────
INSERT INTO rd_sample_int_detail
      (单据编号, 申请日期, 申请人, 样品编号, 项目名, 炭棒尺寸, 数量, 样品背景,
       配方要求, 工艺要求, 物料批次要求, 期望交期, 确认人, 样品状态, asp_user1, asp_time1)
SELECT h.单据编号, h.单据日期, h.申请人, h.单据编号, h.项目名, h.炭棒尺寸, h.数量, h.样品背景,
       h.配方要求, h.工艺要求, h.物料批次要求, h.期望交期, h.确认人, h.样品状态, N'backfill', SYSDATETIME()
FROM rd_sample_int_head h
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM rd_sample_int_detail d
                  WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel, 'N') <> 'Y');
GO

-- ── 3. 面板恢复头行式文书 ──────────────────────────────────────────────────
DECLARE @n INT;
UPDATE yj_panel
SET mode = N'doc',
    line_table = N'rd_sample_int_detail',
    head_table = N'rd_sample_int_head',
    group_col = N'单据编号',
    code_col = N'单据编号',
    prefix = N'SPN',
    date_col = N'单据日期',
    detail_key = N'items',
    page_size = 20
WHERE panel_code = N'RD_SAMPLE_INT';
SET @n = @@ROWCOUNT;
IF @n <> 1 RAISERROR(N'[FAIL] RD_SAMPLE_INT 恢复头行式命中 %d 行(期望 1)', 12, 1, @n) WITH NOWAIT;
GO

-- ── 4. 字段归位：抬头 3 个 header，其余 13 格 detail ───────────────────────
UPDATE yj_field SET place = N'header', seq = 10 WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'单据编号';
UPDATE yj_field SET place = N'header', seq = 20 WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'单据日期';
UPDATE yj_field SET place = N'header', seq = 90 WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'备注';

UPDATE yj_field SET place = N'detail', seq = CASE label
    WHEN N'申请人' THEN 20 WHEN N'项目名' THEN 40 WHEN N'炭棒尺寸' THEN 50 WHEN N'数量' THEN 60
    WHEN N'样品背景' THEN 70 WHEN N'配方要求' THEN 80 WHEN N'工艺要求' THEN 90
    WHEN N'物料批次要求' THEN 100 WHEN N'期望交期' THEN 110 WHEN N'确认人' THEN 120
    WHEN N'样品状态' THEN 130 ELSE seq END
WHERE panel_code = N'RD_SAMPLE_INT'
  AND label IN (N'申请人', N'项目名', N'炭棒尺寸', N'数量', N'样品背景', N'配方要求',
                N'工艺要求', N'物料批次要求', N'期望交期', N'确认人', N'样品状态');
GO

-- 补两个行内字段（申请日期/样品编号），已有则只校正 place/seq
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'申请日期')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, editable, required, hidden, visible)
  VALUES (N'RD_SAMPLE_INT', N'申请日期', N'申请日期', N'日期', N'detail', 10, 1, 1, 0, 1);
ELSE UPDATE yj_field SET place = N'detail', seq = 10, editable = 1
     WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'申请日期';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'样品编号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, editable, required, hidden, visible)
  VALUES (N'RD_SAMPLE_INT', N'样品编号', N'样品编号', N'文本', N'detail', 30, 1, 0, 0, 1);
ELSE UPDATE yj_field SET place = N'detail', seq = 30, editable = 1
     WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'样品编号';
GO

-- ── 5. 自检 ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_SAMPLE_INT' AND mode = N'doc'
               AND line_table = N'rd_sample_int_detail' AND head_table = N'rd_sample_int_head')
  RAISERROR(N'[FAIL] RD_SAMPLE_INT 未恢复头行式文书', 12, 1) WITH NOWAIT;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' AND place LIKE N'%detail%') < 13
  RAISERROR(N'[FAIL] RD_SAMPLE_INT 行内字段不足 13 个', 12, 1) WITH NOWAIT;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = N'rd_sample_int_detail' AND COLUMN_NAME = N'配方要求')
  RAISERROR(N'[FAIL] rd_sample_int_detail 缺 配方要求 列', 12, 1) WITH NOWAIT;
GO
SELECT panel_code, mode, line_table, head_table, group_col, code_col, prefix, detail_key FROM yj_panel WHERE panel_code = N'RD_SAMPLE_INT';
GO
SELECT seq, label, place, editable FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' ORDER BY place DESC, seq;
GO
RAISERROR(N'[PASS] 内部样品单已恢复 Excel 纸面 + 底部「新增样品」行（明细 13 列）', 10, 1) WITH NOWAIT;
GO
