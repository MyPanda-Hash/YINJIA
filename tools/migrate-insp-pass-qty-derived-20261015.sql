/* ============================================================
   migrate-insp-pass-qty-derived-20261015.sql — 2026-10-15
   三张工序检验单:去掉「合格数量」录入列,只留「不合格数量」;
   合格数量改为**派生值** = 表头「报工数量」− 明细「不合格数量」合计

   用户口径(2026-10-15):
     · 「当前去除合格数量只保留不合格数量即可」;
     · 「最终的合格数量就是[报工数量]减去[不合格数量]」;
     · 「数据要可返回追溯页面」⇒ 追溯弹窗「质检数据」段仍要显示合格数量。

   处置:
     ① 注销三面板明细的 **合格数量 字段登记行**(yj_field)⇒ 界面不再出现该录入列;
        **不删物理列**(qc_*_insp_detail.合格数量):里面是历史值,且下游按列名取数,
        删列会连带弄断追溯/入库两条读取路径。列改成"派生值"语义,顺带刷新中文注明。
     ② 合格数量不再是"填进去的数",而是**读取时算**:报工数量(表头) − Σ不合格数量(明细)。
        两个消费点同步改:
          · 追溯「质检数据」段(ScheduleBoardService)→ 弹窗那两列里的 合格数量 仍是派生值;
          · 组装成品检验单审核分流(ButtonService.asmInspToStock)→ 入库数 = 报工数量 − Σ不合格。
     ③ ⚠ 范围**只限这三张工序检验单**。来料检验单 QC_INSP 的「合格数量」是采购链的
        数量守恒与入库依据(送检数量 = 合格 + 不合格、合格行进采购入库),
        QC_MOLD/CUT/ASM 与它只是**同名不同义**,本脚本一律不碰(末尾有守卫断言)。

   幂等可重跑;两账套均执行(先正式、后测试)。
   回滚:重跑 migrate-insp-detail-quantity-20261015.sql 可把字段登记行补回来
        (物理列一直在,不会丢数据)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- ① 注销三面板明细的「合格数量」字段行 ---------- */
DECLARE @n int;
DELETE FROM dbo.yj_field
 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
   AND label = N'合格数量'
   AND place LIKE N'%detail%';
SET @n = @@ROWCOUNT;
PRINT N'  ~ 注销「合格数量」字段登记行: ' + CAST(@n AS nvarchar(10)) + N' 行(已注销则为 0)';
GO

/* ---------- ② 物理列改「派生值」语义(只在还没改过时写一次) ---------- */
DECLARE @tbl sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail')
       AND COL_LENGTH(N'dbo.' + name, N'合格数量') IS NOT NULL;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'IF EXISTS (SELECT 1 FROM sys.extended_properties ep'
             + N'  WHERE ep.major_id = OBJECT_ID(N''dbo.' + @tbl + N''')'
             + N'    AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N''dbo.' + @tbl + N'''), N''合格数量'', ''ColumnId'')'
             + N'    AND ep.name = N''MS_Description'')'
             + N'  EXEC sp_updateextendedproperty N''MS_Description'', '
             + N'N''合格数量(派生值,界面不再录入):= 表头「报工数量」− 本单明细「不合格数量」合计;'
             + N'由追溯「质检数据」段与组装成品检验单审核分流按此口径即时计算(2026-10-15 用户口径)。'''
             + N', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + N''', N''COLUMN'', N''合格数量'';'
             + N'ELSE EXEC sp_addextendedproperty N''MS_Description'', '
             + N'N''合格数量(派生值,界面不再录入):= 表头「报工数量」− 本单明细「不合格数量」合计(2026-10-15)。'''
             + N', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + N''', N''COLUMN'', N''合格数量'';';
    EXEC sp_executesql @sql;
    PRINT N'  ~ ' + @tbl + N'.合格数量 注明已更新为「派生值」口径';
    FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- 自检 ---------- */
DECLARE @bad int = 0;

/* (a) 三面板明细不该再有「合格数量」字段行 */
IF EXISTS (SELECT 1 FROM dbo.yj_field
            WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
              AND label = N'合格数量' AND place LIKE N'%detail%')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 三面板明细仍存在「合格数量」字段行';
END

/* (b) 「不合格数量」必须还在(三面板各 1 行) */
DECLARE @ng int;
SELECT @ng = COUNT(*) FROM dbo.yj_field
 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
   AND label = N'不合格数量' AND place LIKE N'%detail%';
IF @ng <> 3
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 「不合格数量」字段行数 = ' + CAST(@ng AS nvarchar(10)) + N'(应为 3)';
END

/* (c) 物理列必须保留(下游按列名取数,删了就断链) */
IF COL_LENGTH(N'dbo.qc_mold_insp_detail', N'合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_cut_insp_detail',  N'合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail',  N'合格数量') IS NULL SET @bad = @bad + 1;

/* (d) 🔴 守卫:来料检验单/日报 的「合格数量」字段**必须原样还在** —— 同名不同义,不许误伤 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code=N'QC_INSP' AND label=N'合格数量')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 来料检验单 QC_INSP 的「合格数量」字段被误删了(采购链靠它算入库)';
END
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code=N'DAY_REPORT' AND label=N'合格数量')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 生产日报 DAY_REPORT 的「合格数量」字段被误删了';
END

IF @bad > 0 RAISERROR(N'「合格数量」改派生值 自检失败(%d 项)', 16, 1, @bad);
ELSE PRINT N'「合格数量」已改为派生值:三面板只留「不合格数量」录入(物理列保留;QC_INSP/DAY_REPORT 未受影响)';
GO
