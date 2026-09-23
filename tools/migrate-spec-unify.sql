/* ============================================================================
 * 规格命名统一:送料暂收单的「型号」→「规格型号」(采购链字段流转修复 ①)
 * ----------------------------------------------------------------------------
 * 背景(用户口径 2026-09-21):采购订单→来料暂收单→来料检验单→采购入库单/暂收退料单
 *   链路流转时部分表格数据没过去,例:规格型号与规格/型号不一致 —— 「把规格统一写成规格型号」。
 *
 * 根因(实测):
 *   全链 5 张明细表里,只有 **送料暂收单( sl_recv_detail )** 把"规格"列命名为「型号」,
 *   其余(bl_pu_order / qc_insp_detail / bl_purchase_in / qc_return_detail)都叫「规格型号」。
 *   · 采购订单→暂收单:靠同义词 {规格型号→型号} 勉强接上(实测 59/59 行有值 ✓)
 *   · 暂收单→检验单:同步 SQL 按**列名**写 `d.型号 = s.型号`,于是值落进了 qc_insp_detail.型号
 *     ——而检验单页面显示的是「规格型号」列 → **实测 qc_insp_detail.规格型号 0/40 行有值**(规格丢失)
 *   · 检验单→入库/退料:自动生单读 `型号` 写 `规格型号`,因上游只写了 型号,取值同样不稳
 *     (实测 采购入库.规格型号 81/149;暂收退料.规格型号 0/10)
 *
 * 修法:把暂收单这一列的**列名与字段标签**统一成「规格型号」,链路两侧从此**同名直通**;
 *      同时按链路台账 form_flow_link 回填存量行(只填空值,不覆盖已有数据),并补列中文注明。
 *
 * 幂等:改列名/改字段行都带存在性守卫;回填只写空值;可重复执行。
 * 配套代码(同一次提交):ButtonService 三处 型号 → 规格型号(暂收同步 / 检验→入库 / 检验→退料)
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 列名统一:sl_recv_detail.型号 → 规格型号 ---------- */
IF COL_LENGTH('dbo.sl_recv_detail', N'型号') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'规格型号') IS NULL
BEGIN
    EXEC sp_rename N'dbo.sl_recv_detail.型号', N'规格型号', N'COLUMN';
    PRINT N'已重命名列:sl_recv_detail.型号 → 规格型号';
END
ELSE IF COL_LENGTH('dbo.sl_recv_detail', N'型号') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'规格型号') IS NOT NULL
BEGIN
    /* 2026-09-23 合并重放修复:两列并存(本地库当年由不同脚本分别建过 型号 与 规格型号)——
       先把 规格型号 的空值用 型号 补齐(不覆盖已有值),再清注明、DROP 型号,收敛为单列。 */
    EXEC sp_executesql N'UPDATE sl_recv_detail SET [规格型号] = [型号]
                          WHERE ISNULL([规格型号], N'''') = N'''' AND ISNULL([型号], N'''') <> N'''';';
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.sl_recv_detail')
               AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'), N'型号', 'ColumnId') AND name = 'MS_Description')
        EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', N'sl_recv_detail', N'COLUMN', N'型号';
    EXEC(N'ALTER TABLE sl_recv_detail DROP COLUMN [型号]');
    PRINT N'两列并存已合并:规格型号 补空值后 DROP 型号 列';
END
ELSE IF COL_LENGTH('dbo.sl_recv_detail', N'规格型号') IS NOT NULL
    PRINT N'列 sl_recv_detail.规格型号 已存在,跳过重命名';
ELSE
    RAISERROR(N'sl_recv_detail 既无 型号 也无 规格型号 列,请人工核对', 16, 1);
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.sl_recv_detail') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'), N'规格型号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'规格型号(2026-09-21 由「型号」更名:全链统一为规格型号,与采购订单/检验单/入库单/退料单同名直通)', N'SCHEMA', N'dbo', N'TABLE', N'sl_recv_detail', N'COLUMN', N'规格型号';
GO

/* ---------- ② 字段登记统一:QC_RECV 明细字段 型号 → 规格型号 ---------- */
UPDATE yj_field
   SET col_name = N'规格型号', label = N'规格型号'
 WHERE panel_code IN ('QC_RECV', 'SL_RECV') AND col_name = N'型号' AND label = N'型号';
PRINT N'yj_field 更新行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 存量回填(只填空值):检验行 ← 暂收行 ---------- */
UPDATE d
   SET d.[规格型号] = s.[规格型号]
  FROM qc_insp_detail d
  JOIN form_flow_link l
    ON l.target_panel_code = 'QC_INSP'
   AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
  JOIN sl_recv_detail s
    ON l.source_panel_code = 'QC_RECV'
   AND l.source_line_key = l.source_form_no + N'#' + CAST(s.id AS nvarchar(20))
 WHERE ISNULL(d.[规格型号], N'') = N'' AND ISNULL(s.[规格型号], N'') <> N'';
PRINT N'检验行回填(链路台账): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* 兜底:无链路台账的老数据,按「同单据 + 同物料编码」从暂收行取一次 */
UPDATE d
   SET d.[规格型号] = s.[规格型号]
  FROM qc_insp_detail d
  JOIN qc_insp h ON h.[单据编号] = d.[单据编号]
  JOIN sl_recv hr ON hr.[采购订单号] = h.[采购订单号]
  JOIN sl_recv_detail s ON s.[单据编号] = hr.[单据编号] AND s.[物料编码] = d.[物料编码]
 WHERE ISNULL(d.[规格型号], N'') = N'' AND ISNULL(s.[规格型号], N'') <> N'';
PRINT N'检验行回填(同物料兜底): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* 检验行 → 采购入库行 / 暂收退料行 */
UPDATE t SET t.[规格型号] = s.[规格型号]
  FROM bl_purchase_in t
  JOIN form_flow_link l ON l.target_panel_code = 'PURCHASE_IN'
   AND l.target_line_key = l.target_form_no + N'#' + CAST(t.id AS nvarchar(20))
  JOIN qc_insp_detail s ON l.source_panel_code = 'QC_INSP'
   AND l.source_line_key = l.source_form_no + N'#' + CAST(s.id AS nvarchar(20))
 WHERE ISNULL(t.[规格型号], N'') = N'' AND ISNULL(s.[规格型号], N'') <> N'';
PRINT N'采购入库行回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

UPDATE t SET t.[规格型号] = s.[规格型号]
  FROM qc_return_detail t
  JOIN form_flow_link l ON l.target_panel_code = 'QC_RETURN'
   AND l.target_line_key = l.target_form_no + N'#' + CAST(t.id AS nvarchar(20))
  JOIN qc_insp_detail s ON l.source_panel_code = 'QC_INSP'
   AND l.source_line_key = l.source_form_no + N'#' + CAST(s.id AS nvarchar(20))
 WHERE ISNULL(t.[规格型号], N'') = N'' AND ISNULL(s.[规格型号], N'') <> N'';
PRINT N'暂收退料行回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ④ 自检 ---------- */
IF COL_LENGTH('dbo.sl_recv_detail', N'型号') IS NOT NULL
    RAISERROR(N'sl_recv_detail.型号 仍存在(重命名未生效)', 16, 1);
IF COL_LENGTH('dbo.sl_recv_detail', N'规格型号') IS NULL
    RAISERROR(N'sl_recv_detail.规格型号 缺失', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code IN ('QC_RECV', 'SL_RECV') AND col_name = N'型号')
    RAISERROR(N'暂收单仍有 col_name=型号 的字段行', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code IN ('QC_RECV', 'SL_RECV') AND col_name = N'规格型号' AND label = N'规格型号')
    RAISERROR(N'暂收单未登记 规格型号 字段', 16, 1);
DECLARE @left INT = (SELECT COUNT(*) FROM qc_insp_detail d JOIN form_flow_link l
        ON l.target_panel_code='QC_INSP' AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
      WHERE ISNULL(d.[规格型号], N'') = N'');
PRINT N'✅ 规格命名已统一为「规格型号」;仍空规格的链路检验行: ' + CAST(@left AS nvarchar(10)) + N' 行(上游本就为空的行不计)';
GO
