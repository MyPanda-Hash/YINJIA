/* ============================================================================
   migrate-rd-domtest-link-20261029.sql
   数据记录表 ↔ 测试申请单 建立关联(2026-10-29)

   用户口径(原文):
     「数据记录表也是引用的申请单的右上角的单据编号,这个自动生成,数据记录表的选择编号的
       弹窗改为左右两边,左边还是立项申请的项目编号关联,右边加入测试申请单的单据编号
       进行关联测试申请单,测试申请单的汇总也能看到有哪些数据记录表关联了测试申请单,
       然后点击可以弹窗显示对应的数据记录表的数据」

   做了什么:
   1. 给 8 张数据记录表的表头加一列「测试申请单编号」(参照 RD_DOM_TEST 的「单据编号」)。
      · 物理列加在各自的 *_head 表(列名同 label,数据键保持中文 —— ADR-0001)
      · yj_field 登记为参照字段:ref_panel=RD_DOM_TEST / ref_field=单据编号
      · 放 place='query',不进纸面正文(纸面版式是 Excel 一比一复刻,不能凭空多一行)
   2. 测试申请单头表加两列:
      · 测试负责人 —— 审批时可分发(借鉴立项申请的「定级分发」,见 ButtonService)
      · 关联数据记录表 —— 由后端实时汇总(不落库,这里只为在纸面上有个位置? 不需要)

   ⚠ 幂等:列已存在则跳过 ADD;yj_field 按 (panel_code,label) 幂等插入。
   ⚠ 两账套都要执行(先 HSDZ_MES 后 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── 1. 8 张数据记录表的表头加「测试申请单编号」物理列 ── */
DECLARE @tables TABLE (tbl sysname);
INSERT INTO @tables (tbl) VALUES
  ('rd_alkaline_head'), ('rd_mineral_head'), ('rd_antibact_head'), ('rd_scale_head'),
  ('rd_ro_protect_head'), ('rd_soak_head'), ('rd_drop_prec_head'), ('rd_filter_eff_head');

DECLARE @t sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @tables;
OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = N'测试申请单编号')
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD [测试申请单编号] nvarchar(60) NULL';
        EXEC sp_executesql @sql;
        PRINT '[ADD] ' + @t + N'.测试申请单编号';
    END
    ELSE
        PRINT '[SKIP] ' + @t + N'(表不存在或列已存在)';
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;

/* ── 2. 测试申请单头表:「测试负责人」(审批时分发;账号口径,同立项申请对接人) ── */
IF OBJECT_ID('rd_dom_test_head') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rd_dom_test_head') AND name = N'测试负责人')
BEGIN
    ALTER TABLE dbo.rd_dom_test_head ADD [测试负责人] nvarchar(50) NULL;
    PRINT '[ADD] rd_dom_test_head.测试负责人';
END
ELSE
    PRINT '[SKIP] rd_dom_test_head.测试负责人(已存在)';

/* ── 3. yj_field 登记:8 张表的「测试申请单编号」参照字段(place=query,不进纸面) ── */
DECLARE @panels TABLE (code varchar(50), seqbase int);
INSERT INTO @panels (code, seqbase) VALUES
  ('RD_ALKALINE', 900), ('RD_MINERAL', 900), ('RD_ANTIBACT', 900), ('RD_SCALE', 900),
  ('RD_RO_PROTECT', 900), ('RD_SOAK', 900), ('RD_DROP_PREC', 900), ('RD_FILTER_EFF', 900);

DECLARE @p varchar(50), @sb int;
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT code, seqbase FROM @panels;
OPEN cur2;
FETCH NEXT FROM cur2 INTO @p, @sb;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @p)
       AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @p AND label = N'测试申请单编号')
    BEGIN
        INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql,
                              ref_panel, ref_field, display_field, place, seq, width,
                              editable, required, hidden, visible, tab_key, col_group)
        VALUES (@p, N'测试申请单编号', N'测试申请单编号', 'Test Request No.', N'参照', NULL,
                'RD_DOM_TEST', N'单据编号', N'单据编号', 'query', @sb, 160,
                1, 0, 1, 1, NULL, NULL);
        PRINT '[FIELD] ' + @p + N' ← 测试申请单编号(参照 RD_DOM_TEST.单据编号)';
    END
    ELSE
        PRINT '[FIELD-SKIP] ' + @p;
    FETCH NEXT FROM cur2 INTO @p, @sb;
END
CLOSE cur2; DEALLOCATE cur2;

/* ── 4. 测试申请单:「测试负责人」字段登记(表头,纸面可见;账号口径参照 EMP) ── */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_DOM_TEST')
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_DOM_TEST' AND label = N'测试负责人')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql,
                          ref_panel, ref_field, display_field, place, seq, width,
                          editable, required, hidden, visible, tab_key, col_group)
    VALUES ('RD_DOM_TEST', N'测试负责人', N'测试负责人', 'Test Owner', N'参照', NULL,
            'EMP', N'员工名称', N'员工名称', 'header', 200, 120,
            0, 0, 1, 1, NULL, NULL);
    PRINT '[FIELD] RD_DOM_TEST ← 测试负责人(参照 EMP)';
END
ELSE
    PRINT '[FIELD-SKIP] RD_DOM_TEST.测试负责人';

/* ── 5. 自检 ── */
DECLARE @miss int = 0;
SELECT @miss = COUNT(*) FROM @tables t
WHERE OBJECT_ID(t.tbl) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(t.tbl) AND c.name = N'测试申请单编号');
IF @miss > 0
BEGIN
    RAISERROR('自检失败:仍有 %d 张表缺 测试申请单编号 列', 16, 1, @miss);
    RETURN;
END

DECLARE @fmiss int = (SELECT COUNT(*) FROM @panels p
    WHERE EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = p.code)
      AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = p.code AND label = N'测试申请单编号'));
IF @fmiss > 0
BEGIN
    RAISERROR('自检失败:仍有 %d 张面板缺 测试申请单编号 字段', 16, 1, @fmiss);
    RETURN;
END

PRINT '[OK] 数据记录表 ↔ 测试申请单 关联字段就位';
