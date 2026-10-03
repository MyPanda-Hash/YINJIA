/* ============================================================================
 * 材料码打印单:**已生单的量也可以补登打印**(2026-10-04 追加口径)
 * ----------------------------------------------------------------------------
 * 用户口径:「还有已经生单的数据也应该可以打印」——货已经收了(暂收单已生成)才想起来要打材料码,
 * 或者先送了一部分没打码、后来补打。这类打印**不是"待生单的预约"**,而是**补登**:
 *   · **不产生隔离行**(生单弹窗里不会多出一行"已打印待生单",也就不会再被生单);
 *   · **不扣余量**(量已经送过了,头寸里早就扣掉,再扣一遍等于把额度吃掉);
 *   · 批次号**取该行已生单单据的号**(标签必须与实物/单据同号),锁定不可改;
 *   · 打印记录仍然留痕(打了几张、什么时候、挂在哪张单上),供扫码追溯。
 *
 * 落库怎么表达"这是补登":
 *   bl_pu_label 加两列 ——
 *     [补登]     nvarchar(1)  NOT NULL DEFAULT 'N' :Y = 已生单补登(不预约、不出隔离行)
 *     [去向单据] nvarchar(40) NULL                 :补登时记它对应的那张已生单单据号(追溯用)
 *
 * 由此「未生单量」的派生也要带条件(见 PuLabelService.labelRows / PushGenerateHandler.batchRows):
 *   补登行:未生单量恒为 0(它从来就不等生单);
 *   待生单行:未生单量 = 打印数量 − 已生单量(form_flow_link 派生,不变)。
 *
 * 幂等:列存在即跳过;注明用 sp_updateextendedproperty;两账套均执行。
 * 配套代码(同提交):PuLabelService(补登口径 + 补登上限 = 该行该批次已收 − 已补登)、
 *   PushGenerateHandler.batchRows(补登行不参与切量/不出隔离行)、
 *   PushGenerateHandler.generateBatch(打印量 + 未打印量**合并成一行明细**),
 *   PxController(/px/puLabel/batchLock 供前端锁批次号)、MaterialLabelDialog.vue(下层「已生单可补打」)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- ① bl_pu_label 加「补登 / 去向单据」 ---------- */
IF COL_LENGTH(N'dbo.bl_pu_label', N'补登') IS NULL
BEGIN
    ALTER TABLE dbo.bl_pu_label ADD [补登] nvarchar(1) NOT NULL
        CONSTRAINT df_bl_pu_label_supplement DEFAULT N'N';
    PRINT N'① bl_pu_label.补登 已加(默认 N)';
END
ELSE PRINT N'① bl_pu_label.补登 已存在,跳过';
GO

IF COL_LENGTH(N'dbo.bl_pu_label', N'去向单据') IS NULL
BEGIN
    ALTER TABLE dbo.bl_pu_label ADD [去向单据] nvarchar(40) NULL;
    PRINT N'① bl_pu_label.去向单据 已加';
END
ELSE PRINT N'① bl_pu_label.去向单据 已存在,跳过';
GO

/* ---------- ② 中文注明 ---------- */
DECLARE @c TABLE (col sysname, txt nvarchar(400));
INSERT INTO @c (col, txt) VALUES
  (N'补登',     N'是否"已生单补登"打印:Y=只为**已经生单(已收)**的量补打材料码 —— 不产生隔离行、不扣余量、批次号取该行已生单单据的号;N=常规打印(待生单,打印量从原行切走并预约)'),
  (N'去向单据', N'补登打印对应的那张已生单单据号(暂收/检验/入库链路的目标单;追溯"这批纸是给哪张单收的货"用)');

DECLARE @col sysname, @txt nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, txt FROM @c;
OPEN cur; FETCH NEXT FROM cur INTO @col, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.bl_pu_label', @col) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID(N'dbo.bl_pu_label')
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_pu_label'), @col, 'ColumnId')
                     AND name = 'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'bl_pu_label', N'COLUMN', @col;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'bl_pu_label', N'COLUMN', @col;
    END
    FETCH NEXT FROM cur INTO @col, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'② 补登/去向单据 的中文注明已写入';
GO

/* ---------- ③ 自检 ---------- */
IF COL_LENGTH(N'dbo.bl_pu_label', N'补登') IS NULL
    RAISERROR(N'自检失败:bl_pu_label.补登 未建', 16, 1);
IF COL_LENGTH(N'dbo.bl_pu_label', N'去向单据') IS NULL
    RAISERROR(N'自检失败:bl_pu_label.去向单据 未建', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.bl_pu_label')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_pu_label'), N'补登', 'ColumnId')
                 AND name = 'MS_Description')
    RAISERROR(N'自检失败:bl_pu_label.补登 缺中文注明', 16, 1);

-- 老数据一律按"待生单"口径回填(默认值已保证,这里只核对有无异常值)
IF EXISTS (SELECT 1 FROM dbo.bl_pu_label WHERE ISNULL([补登], N'N') NOT IN (N'Y', N'N'))
    RAISERROR(N'自检失败:bl_pu_label.补登 出现 Y/N 之外的值', 16, 1);

SELECT N'自检' AS k, c.name AS 列, TYPE_NAME(c.user_type_id) AS 类型,
       ISNULL(CAST(ep.value AS nvarchar(120)), N'(缺注明)') AS 注明
FROM sys.columns c
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID(N'dbo.bl_pu_label') AND c.name IN (N'补登', N'去向单据');
GO

PRINT N'✅ 材料码打印行已支持「已生单补登」(补登 Y/N + 去向单据)';
GO
