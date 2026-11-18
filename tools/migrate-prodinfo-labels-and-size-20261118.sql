/* ============================================================================
 * migrate-prodinfo-labels-and-size-20261118.sql
 * 产品信息表（RD_PROD_INFO）按《产品信息表（固定）》目标版式修正两处：
 *   ① 行1 字段名：项目编号 → **立项编号**、项目名称 → **立项名称**（只改显示名 label，物理列不动）；
 *   ② 「产品整体尺寸」由**一整格**改为**三内格**（外径±公差mm / 内径±公差mm / 长度±公差），
 *      与下方「炭棒尺寸」同形（2026-11-18 用户口径：「产品整体尺寸还没有弄好」）。
 *
 * 为什么要加三个物理列而不是一格三拆分：
 *   设计里这两行是同一形态（一行标签 + 三内格），炭棒尺寸早已是 炭棒外径/炭棒内径/炭棒长度
 *   三列；产品整体尺寸却只有一整串自由文本 ⇒ 填出来的东西五花八门（实测 14 张单里有
 *   `40*12*230`、`总长508±1mm`、`62.8(OD)*92.5(L)`、`在枯`、`213`），下游没法按列取值。
 *
 * 兼容策略（不删旧列、不动旧值）：
 *   · 保留 `产品整体尺寸` 聚合列与 yj_field（visible=1，编辑面板仍可见）—— 历史单据的值不丢；
 *   · 新增 3 列 + 3 个 yj_field（label = 列名 = 整体外径/整体内径/整体长度，place=header）；
 *   · 存量能按 `外径*内径*长度` 拆开的**回填**到三列（下面显式逐单 UPDATE，共 7 张）；
 *     拆不开的 7 张（PI-2026-10-0063、PI-2026-10-0064、PI-2026-11-0005、PI-2026-11-0041、PI-2026-11-0045、PI-2026-11-0047、PI-2026-11-0093）保持原样、三列留空 —— 由用户按新口径补填。
 *
 * 幂等 / 两账套：改名与加列都带 NOT EXISTS / COL_LENGTH 守卫；回填带"三列全空"条件。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- ① 字段改名（只改 label，物理列不变 ⇒ 数据键随 label 变，前端配置同步改） ---------- */
IF COL_LENGTH('rd_prod_info_head', N'项目编号') IS NULL
    PRINT N'[prodinfo] 本库无 rd_prod_info_head.项目编号，跳过改名（schema 滞后）';
ELSE
BEGIN
    UPDATE yj_field SET label = N'立项编号'
     WHERE panel_code = 'RD_PROD_INFO' AND label = N'项目编号'
       AND NOT EXISTS (SELECT 1 FROM yj_field f2 WHERE f2.panel_code='RD_PROD_INFO' AND f2.label=N'立项编号');
    PRINT N'[prodinfo] 项目编号 → 立项编号 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

    UPDATE yj_field SET label = N'立项名称'
     WHERE panel_code = 'RD_PROD_INFO' AND label = N'项目名称'
       AND NOT EXISTS (SELECT 1 FROM yj_field f2 WHERE f2.panel_code='RD_PROD_INFO' AND f2.label=N'立项名称');
    PRINT N'[prodinfo] 项目名称 → 立项名称 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
GO

/* ---------- ② 新增三列（nvarchar(200)，带中文注明） ---------- */
IF COL_LENGTH('rd_prod_info_head', N'整体外径') IS NULL
    ALTER TABLE rd_prod_info_head ADD [整体外径] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', N'整体内径') IS NULL
    ALTER TABLE rd_prod_info_head ADD [整体内径] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', N'整体长度') IS NULL
    ALTER TABLE rd_prod_info_head ADD [整体长度] nvarchar(200) NULL;
PRINT N'[prodinfo] 三列就绪（整体外径/整体内径/整体长度）';
GO

/* ---------- ③ 三列的 MS_Description（幂等） ---------- */
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
            WHERE t.name='rd_prod_info_head' AND c.name=N'整体外径')
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
                    JOIN sys.tables t ON t.object_id=c.object_id
                    WHERE t.name='rd_prod_info_head' AND c.name=N'整体外径' AND ep.name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品整体尺寸-外径（含公差，如 33±0.5）',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_info_head', N'COLUMN', N'整体外径';
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
            WHERE t.name='rd_prod_info_head' AND c.name=N'整体内径')
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
                    JOIN sys.tables t ON t.object_id=c.object_id
                    WHERE t.name='rd_prod_info_head' AND c.name=N'整体内径' AND ep.name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品整体尺寸-内径（含公差，如 12±0.5）',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_info_head', N'COLUMN', N'整体内径';
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
            WHERE t.name='rd_prod_info_head' AND c.name=N'整体长度')
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
                    JOIN sys.tables t ON t.object_id=c.object_id
                    WHERE t.name='rd_prod_info_head' AND c.name=N'整体长度' AND ep.name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品整体尺寸-长度（含公差，如 110±0.5）',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_info_head', N'COLUMN', N'整体长度';
GO

/* ---------- ④ yj_field 三行（以「炭棒外径」为模板复制，label/col/seq 覆盖） ---------- */
IF OBJECT_ID('rd_prod_info_head') IS NOT NULL AND COL_LENGTH('rd_prod_info_head', N'整体外径') IS NOT NULL
BEGIN
    DECLARE @seq int = 71;
    DECLARE @lbl sysname, @col sysname;
    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT N'整体外径', N'整体外径' UNION ALL SELECT N'整体内径', N'整体内径' UNION ALL SELECT N'整体长度', N'整体长度';
    OPEN cur; FETCH NEXT FROM cur INTO @lbl, @col;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=@lbl)
        INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
        SELECT N'RD_PROD_INFO', @col, @lbl, ISNULL(data_type, N'文本'), dict_sql, N'header', @seq, 80, 1, 0, 0, 1
          FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'炭棒外径';
        FETCH NEXT FROM cur INTO @lbl, @col;
        SET @seq = @seq + 1;
    END
    CLOSE cur; DEALLOCATE cur;
    PRINT N'[prodinfo] yj_field 三行就绪';
END
ELSE PRINT N'[prodinfo] 缺表/缺列，yj_field 跳过（schema 滞后）';
GO

/* ---------- ⑤ 存量回填：只处理"外径*内径*长度"能拆的，且三列全空的单 ---------- */
IF OBJECT_ID('rd_prod_info_head') IS NOT NULL AND COL_LENGTH('rd_prod_info_head', N'整体外径') IS NOT NULL
BEGIN
UPDATE rd_prod_info_head SET [整体外径]=N'40', [整体内径]=N'12', [整体长度]=N'230'
 WHERE [单据编号]=N'PI-2026-10-0060' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
UPDATE rd_prod_info_head SET [整体外径]=N'28.8', [整体内径]=N'10', [整体长度]=N'195.5'
 WHERE [单据编号]=N'PI-2026-10-0061' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
UPDATE rd_prod_info_head SET [整体外径]=N'33', [整体内径]=N'11.5', [整体长度]=N'50'
 WHERE [单据编号]=N'PI-2026-10-0062' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
UPDATE rd_prod_info_head SET [整体外径]=N'60', [整体内径]=N'28.9', [整体长度]=N'180'
 WHERE [单据编号]=N'PI-2026-11-0003' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
UPDATE rd_prod_info_head SET [整体外径]=N'57', [整体内径]=N'30', [整体长度]=N'77.5'
 WHERE [单据编号]=N'PI-2026-11-0028' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
UPDATE rd_prod_info_head SET [整体外径]=N'106', [整体内径]=N'57', [整体长度]=N'75'
 WHERE [单据编号]=N'PI-2026-11-0049' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
UPDATE rd_prod_info_head SET [整体外径]=N'18.5', [整体内径]=N'9.5', [整体长度]=N'66.8'
 WHERE [单据编号]=N'PI-2026-11-0090' AND ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL([整体外径],N'')=N'' AND ISNULL([整体内径],N'')=N'' AND ISNULL([整体长度],N'')=N'';
    PRINT N'[prodinfo] 回填完成（逐单见上）';
END
ELSE PRINT N'[prodinfo] 缺列，回填跳过';
GO

/* ---------- ⑥ 自检：改名与字段行必须到位 ---------- */
IF OBJECT_ID('rd_prod_info_head') IS NOT NULL AND COL_LENGTH('rd_prod_info_head', N'整体外径') IS NOT NULL
BEGIN
    DECLARE @bad int = 0;
    SELECT @bad = COUNT(*) FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label IN (N'项目编号', N'项目名称');
    IF @bad > 0 RAISERROR(N'[prodinfo] 自检失败：旧字段名仍存在', 16, 1);
    SELECT @bad = COUNT(*) FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label IN (N'整体外径', N'整体内径', N'整体长度');
    IF @bad <> 3 RAISERROR(N'[prodinfo] 自检失败：三个新字段不足 3 行', 16, 1);
    PRINT N'[prodinfo] 自检通过';
END
GO
