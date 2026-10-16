/* ============================================================
   migrate-insp-pass-qty-consistency-20261015.sql — 2026-10-15
   工序检验单「合格数量 = 派生值」基数的数据一致性修订:
   从「表头 报工数量 − Σ不合格数量」改为「表头 **检验数量** − Σ不合格数量」

   用户口径(2026-10-15,本轮报障):
     · 「工序报工完成就默认变成合格数量了，不应该直接出现合格数量」
       —— 报工审核自动生成的检验单是**空草稿**(明细全空、检验数量=NULL/0)，
         但追溯「质检数据」页按旧口径算出 161/161/160 的合格数，汇总结论还写成
         「全部合格」，实际什么都没检。同理组装成品检验单一审核就按「报工数量」
         生成全额产成品入库单(等于没检验就入库)。
     · 「需要完成当前的检验单才会显示对应的合格数量，否则不会显示才是正确的」
       —— 未检验(检验数量为空/≤0)的单据，合格数量**不显示**(返回 NULL 而非 0)。

   处置(与代码改动同批生效，本脚本只做**注明**，不改任何数据):
     ① 三张明细表的 [合格数量] MS_Description 刷新为
        「= 表头检验数量 − Σ不合格数量」口径；
     ② 三张头表的 [检验数量] MS_Description 补上「派生合格数量的基数」说明
        (该列原先无注明)，并把守恒关系写在列上：检验数量 = 合格 + 不合格；
     ③ 派生语义的源头是全链读取时计算(追溯段 + 入库分流 + 保存守恒校验)，
        本脚本不写回任何数据 ⇒ 无数据变更、无行号变动，可反复执行。

   ⚠ 范围**只限三张工序检验单**(qc_mold/qc_cut/qc_asm)。来料检验单 QC_INSP 的
     「合格数量」是采购链的守恒量与入库依据(送检数量 = 合格 + 不合格)，
     与被修改的三张单只是同名不同义，本脚本一律不碰(末尾有守卫断言)。

   幂等可重跑；两账套均执行(先正式、后测试)。
   ============================================================ */

IF OBJECT_ID(N'dbo.qc_mold_insp_detail', N'U') IS NULL
    PRINT N'[skip] qc_mold_insp_detail 不存在，本脚本无可执行对象';

SET NOCOUNT ON;
GO

/* ---------- ① 三张**明细**表的「合格数量」注明刷新为新口径 ----------
   注:三张**头**表本来就没有「合格数量」列(该列只在明细上)，故这里只跑 3 张表。 */
DECLARE @tbl sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_detail',
                    N'qc_cut_insp_detail',
                    N'qc_asm_insp_detail')
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
             + N'N''合格数量(派生值，界面不再录入)：= 表头「检验数量」 − 本单明细「不合格数量」合计；'
             + N'由追溯「质检数据」段与组装成品检验单审核分流按此口径即时计算。'
             + N'未检验(检验数量为空或 ≤0)时不显示。2026-10-15 数据一致性修订。'''
             + N', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + N''', N''COLUMN'', N''合格数量'';'
             + N'ELSE EXEC sp_addextendedproperty N''MS_Description'', '
             + N'N''合格数量(派生值，界面不再录入)：= 表头「检验数量」 − 本单明细「不合格数量」合计'
             + N'(2026-10-15 数据一致性修订)。'''
             + N', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + N''', N''COLUMN'', N''合格数量'';';
    EXEC sp_executesql @sql;
    PRINT N'  ~ ' + @tbl + N'.合格数量 注明已刷新为「检验数量 − Σ不合格」口径';
    FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ② 三张**头**表的「检验数量」补注明(它是派生合格数量的基数) ---------- */
DECLARE @tbl2 sysname, @sql2 nvarchar(max);
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_head', N'qc_cut_insp_head', N'qc_asm_insp_head')
       AND COL_LENGTH(N'dbo.' + name, N'检验数量') IS NOT NULL;
OPEN cur2;
FETCH NEXT FROM cur2 INTO @tbl2;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql2 = N'IF EXISTS (SELECT 1 FROM sys.extended_properties ep'
             + N'  WHERE ep.major_id = OBJECT_ID(N''dbo.' + @tbl2 + N''')'
             + N'    AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N''dbo.' + @tbl2 + N'''), N''检验数量'', ''ColumnId'')'
             + N'    AND ep.name = N''MS_Description'')'
             + N'  EXEC sp_updateextendedproperty N''MS_Description'', '
             + N'N''检验数量(本单实际检验的数量，品质手填)：派生合格数量的**基数**，'
             + N'守恒关系 检验数量 = 合格数量 + 不合格数量；为空/≤0 视为未检验，'
             + N'此时合格数量不显示、不派生下游单(2026-10-15 数据一致性修订)。'''
             + N', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl2 + N''', N''COLUMN'', N''检验数量'';'
             + N'ELSE EXEC sp_addextendedproperty N''MS_Description'', '
             + N'N''检验数量(本单实际检验的数量，品质手填)：派生合格数量的**基数**，'
             + N'守恒关系 检验数量 = 合格数量 + 不合格数量(2026-10-15 数据一致性修订)。'''
             + N', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl2 + N''', N''COLUMN'', N''检验数量'';';
    EXEC sp_executesql @sql2;
    PRINT N'  ~ ' + @tbl2 + N'.检验数量 注明已标注为「派生合格数量的基数」';
    FETCH NEXT FROM cur2 INTO @tbl2;
END
CLOSE cur2; DEALLOCATE cur2;
GO

/* ---------- 自检 ---------- */
DECLARE @bad int = 0;

/* (a) 三张明细表的「合格数量」注明必须是新口径(含「检验数量」字样)
   ⚠ 2026-10-17 修:期望张数改成**动态** —— 三张工序检验单(qc_mold/qc_cut/qc_asm)已于
   2026-10-16 下架(DROP),表都不在了还硬要"3 张" ⇒ 本脚本永远 FAIL ⇒
   DbSync 在此中止、其后迁移不再执行(正式库曾因此在 migrate-stock-report-dup-fields 之后
   连丢 13 条迁移)。现在只按**仍存在且有该列**的表张数比对:全下架时期望 0 ⇒ 自洽。 */
DECLARE @expDetail int;
SELECT @expDetail = COUNT(*) FROM sys.tables t
 WHERE t.name IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail')
   AND COL_LENGTH(N'dbo.' + t.name, N'合格数量') IS NOT NULL;
DECLARE @okDetail int;
SELECT @okDetail = COUNT(*) FROM sys.extended_properties ep
  JOIN sys.tables t ON t.object_id = ep.major_id
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
 WHERE t.name IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail')
   AND c.name = N'合格数量' AND ep.name = N'MS_Description'
   AND CAST(ep.value AS nvarchar(max)) LIKE N'%检验数量%';
IF @okDetail <> @expDetail
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 明细表「合格数量」注明未刷新的张数 = ' + CAST(@okDetail AS nvarchar(10)) + N'（应为 ' + CAST(@expDetail AS nvarchar(10)) + N'）';
END

/* (b) 三张头表的「检验数量」注明必须已标注为基数(同样按仍存在的表张数动态比对) */
DECLARE @expHead int;
SELECT @expHead = COUNT(*) FROM sys.tables t
 WHERE t.name IN (N'qc_mold_insp_head', N'qc_cut_insp_head', N'qc_asm_insp_head')
   AND COL_LENGTH(N'dbo.' + t.name, N'检验数量') IS NOT NULL;
DECLARE @okHead int;
SELECT @okHead = COUNT(*) FROM sys.extended_properties ep
  JOIN sys.tables t ON t.object_id = ep.major_id
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
 WHERE t.name IN (N'qc_mold_insp_head', N'qc_cut_insp_head', N'qc_asm_insp_head')
   AND c.name = N'检验数量' AND ep.name = N'MS_Description'
   AND CAST(ep.value AS nvarchar(max)) LIKE N'%基数%';
IF @okHead <> @expHead
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 头表「检验数量」注明未标注为基数的张数 = ' + CAST(@okHead AS nvarchar(10)) + N'（应为 ' + CAST(@expHead AS nvarchar(10)) + N'）';
END

/* (c) 物理列必须在(数据一致性只是改口径,不删历史列)—— 同样只在**表还在**时才算不符 */
IF OBJECT_ID(N'dbo.qc_mold_insp_detail', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.qc_mold_insp_detail', N'合格数量') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_cut_insp_detail',  N'U') IS NOT NULL AND COL_LENGTH(N'dbo.qc_cut_insp_detail',  N'合格数量') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_asm_insp_detail',  N'U') IS NOT NULL AND COL_LENGTH(N'dbo.qc_asm_insp_detail',  N'合格数量') IS NULL SET @bad = @bad + 1;

/* (d) 🔴 守卫:来料检验单 qc_insp_detail 的「合格数量」列**必须原样还在** ——
       同名不同义(送检数量 = 合格 + 不合格，采购链靠它算入库)，不许误伤 */
IF COL_LENGTH(N'dbo.qc_insp_detail', N'合格数量') IS NULL
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 来料检验单 qc_insp_detail.合格数量 列被误删了';
END
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code=N'QC_INSP' AND label=N'合格数量')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 来料检验单 QC_INSP 的「合格数量」字段登记行被误删了';
END
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code=N'DAY_REPORT' AND label=N'合格数量')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 生产日报 DAY_REPORT 的「合格数量」字段登记行被误删了';
END

IF @bad > 0 RAISERROR(N'工序检验单合格数量口径修订 自检失败(%d 项)', 16, 1, @bad);
ELSE PRINT N'工序检验单「合格数量」口径已修订为 = 表头检验数量 − Σ明细不合格数量（未检验不显示）';
GO
