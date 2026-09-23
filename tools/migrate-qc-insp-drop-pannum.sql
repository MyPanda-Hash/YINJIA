-- migrate-qc-insp-drop-pannum.sql — 来料检验单下线「盘号」字段(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 用户口径(2026-09-21):「盘号删掉」。该字段是 2026-09-21 早随「品检系补齐」加进来的
--   (参照库扫码全检/品检数据的 盘号 = 线缆盘具口径),银嘉无盘具 → 下线。
--
-- 实测(执行前):
--   · qc_insp_detail.盘号 非空行数 = 0(纯空列,无数据)
--   · 除 QC_INSP 外无任何面板引用「盘号」字段行;全库只有 qc_insp_detail 一张表有此列
--   · 盘号译名 10 行(本字段专用)
-- 故本次**连列一起清**(与「批号」不同:批号列保留是因为参照库语义与供应商批号相关、列有历史意义;
-- 盘号列是本次新加的空列,留着就是死列)。
--
-- 处理:① 删 yj_field 字段行;② 删该标签的 10 行译名(仅在确认无面板再用该标签时);
--       ③ 空列则 DROP COLUMN(有数据则保留并告警,绝不静默丢数据)。源脚本
--       tools/migrate-qc-insp-fields.sql 已同步移除该字段,新库不再生成。
-- 幂等:各项均判存/判空后再动,重复执行无副作用。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════════ 1. 删除字段行 ══════════════
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'盘号');
DELETE FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'盘号';
PRINT N'[qc-pannum] 字段行删除数 = ' + CAST(@f AS nvarchar(10)) + N'(首次 1,复跑 0)';
GO

-- ══════════════ 2. 删除译名(仅在无任何面板再用该标签时) ══════════════
DECLARE @inUse int = (SELECT COUNT(*) FROM yj_field WHERE col_name=N'盘号' OR label=N'盘号');
IF @inUse = 0
BEGIN
    DECLARE @t int = (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'盘号');
    DELETE FROM yj_translation WHERE scope='field' AND ref_key=N'盘号';
    PRINT N'[qc-pannum] 译名删除行数 = ' + CAST(@t AS nvarchar(10)) + N'(首次 10,复跑 0)';
END
ELSE
    PRINT N'[qc-pannum] 仍有其它面板在用「盘号」标签,译名保留';
GO

-- ══════════════ 3. 清空列则 DROP(有数据则保留并告警) ══════════════
-- (2026-09-23 合并重放修复:列不存在的库上,IF 守卫内的裸列引用同批编译不过 → 改动态 SQL。)
IF COL_LENGTH('dbo.qc_insp_detail', N'盘号') IS NOT NULL
BEGIN
    DECLARE @hasData int = 0
    EXEC sp_executesql N'SELECT @hasData = COUNT(*) FROM qc_insp_detail WHERE 盘号 IS NOT NULL AND 盘号 <> N''''',
         N'@hasData int OUTPUT', @hasData OUTPUT
    IF @hasData > 0
        PRINT N'[qc-pannum] 警告:盘号列有 ' + CAST(@hasData AS nvarchar(10)) + N' 行数据,保留列不删(请人工确认后处置)'
    ELSE
    BEGIN
        -- 先删列的中文注明扩展属性,再删列(否则残留孤儿属性)
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail')
                   AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'盘号','ColumnId') AND name='MS_Description')
            EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'盘号';
        EXEC(N'ALTER TABLE qc_insp_detail DROP COLUMN 盘号');
        PRINT N'[qc-pannum] 空列已 DROP(qc_insp_detail.盘号)';
    END
END
ELSE
    PRINT N'[qc-pannum] 盘号列已不存在,跳过(幂等)';
GO

-- ══════════════ 4. 自检 ══════════════
DECLARE @leftF int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'盘号');
DECLARE @leftT int = (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'盘号');
DECLARE @leftC int = CASE WHEN COL_LENGTH('dbo.qc_insp_detail', N'盘号') IS NULL THEN 0 ELSE 1 END;
DECLARE @insp int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP'
    AND col_name IN (N'检验编号',N'执行标准',N'检验类型',N'报废数量',N'损耗',N'损耗率',N'条码',N'成品编号',N'生产日期'));
IF @leftF <> 0 OR @leftC <> 0 OR @insp <> 9
    RAISERROR(N'[qc-pannum] 自检失败:字段行 %d / 列 %d(应 0/0);余下 9 字段实测 %d', 16, 1, @leftF, @leftC, @insp);
ELSE
    PRINT N'[qc-pannum] 自检通过:盘号字段行/列已清(译名残留 ' + CAST(@leftT AS nvarchar(10)) + N' 行),来料检验单余 9 个补齐字段';
GO
