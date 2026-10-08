/* migrate-fourdoc-missing-cols-20261008.sql — 按文档补齐四单仍缺的物理列(2026-10-08)
 *
 * 【依据】唯一基线 = docs/development/采购链四单字段与显示字段.md(2026-10-03 冻结)。
 *   逐列对账(文档认定的 6 张表 vs 本机现状)后,仍缺 4 列:
 *     ① qc_return_detail.退货数量 —— 本机该列叫「数量」(15/15 行有数据,就是现在的退货数量)
 *        ⇒ 用 sp_rename 改名(数据、列序、扩展属性都不动)。
 *        顺带修掉一个静默 bug:后端 BatchService.returnedByOrderLine() 写死 `d.退货数量` 且外层
 *        catch(Exception ignore) 吞掉「列名无效」⇒ 退货回冲一直静默失效(PushGenerateHandler×2 /
 *        PuLabelService×2 / VoucherFlowService 共 4 处调用)。改回文档列名后该查询自然恢复。
 *     ② qc_return_detail.批号            ③ bd_purchase_in.审核时间2            ④ bd_purchase_in.审核人2
 *        —— 补空列(无字段登记 ⇒ 界面不显示;文档 §3.x 把它们列在「未登记列」里)。
 *
 * 【幂等】逐列 COL_LENGTH 守卫 + sp_rename 双向守卫(只有「数量还在、退货数量不在」才改名);重复执行空操作。
 * 【执行】两账套各跑一遍(先 HSDZ_MES、后 HSDZ_MES_TEST);本脚本必须排在回正脚本
 *         migrate-fourdoc-baseline-restore-20261008.sql 之前(登记顺序即执行顺序)。
 *
 * ⚠ 已知遗留(本脚本不处理,避免引发历史脚本重跑):tools/migrate-qc-tc-via-return.sql:144 里硬写了
 *   `d.[数量]`。该文件字节不变就不会被 DbSync 重跑;若将来要改它,须先把那处改成「血统二择一」写法
 *   (同族脚本已有先例),否则它下次执行会报「列名 '数量' 无效」。
 */
SET NOCOUNT ON;
GO

/* ---------- ① qc_return_detail.数量 → 退货数量(文档列名;数据不动) ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'数量') IS NOT NULL
   AND COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NULL
BEGIN
    EXEC sp_rename N'dbo.qc_return_detail.数量', N'退货数量', N'COLUMN';
    PRINT N'[四单补列] qc_return_detail.数量 → 退货数量(按文档 §3.3 列名)';
END
ELSE IF COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NOT NULL
    PRINT N'[四单补列] qc_return_detail.退货数量 已就位(跳过)';
ELSE
    RAISERROR(N'qc_return_detail 既无「数量」也无「退货数量」列,无法按文档补齐', 16, 1);
GO
-- 列中文注明改为文档口径(改名前留下的旧注明跟着 column_id 走,这里改成"退货数量"的语义)
IF COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties
              WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'退货数量', 'ColumnId')
                AND name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description',
           N'退货数量:本行退给供应商的数量(暂收退料单明细「退货数量」的落库列;与不良原因/报废数量分开记账)',
           N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'退货数量';
  ELSE
      EXEC sp_addextendedproperty N'MS_Description',
           N'退货数量:本行退给供应商的数量(暂收退料单明细「退货数量」的落库列;与不良原因/报废数量分开记账)',
           N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'退货数量';
END
GO

/* ---------- ② qc_return_detail.批号(文档「未登记列」;补空列) ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'批号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_return_detail ADD [批号] nvarchar(100) NULL;
    PRINT N'[四单补列] 新增 qc_return_detail.批号';
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'批号', 'ColumnId')
                  AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'批号:供应商批号(参照库口径的「批号」;面板未登记该字段,界面不显示)',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'批号';
GO

/* ---------- ③④ bd_purchase_in.审核时间2 / 审核人2(文档「未登记列」;补空列) ---------- */
IF COL_LENGTH('dbo.bd_purchase_in', N'审核时间2') IS NULL
BEGIN
    ALTER TABLE dbo.bd_purchase_in ADD [审核时间2] nvarchar(100) NULL;
    PRINT N'[四单补列] 新增 bd_purchase_in.审核时间2';
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.bd_purchase_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_purchase_in'), N'审核时间2', 'ColumnId')
                  AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间2:ERP 血统的第二个审核时间列(面板未登记,界面不显示)',
         N'SCHEMA', N'dbo', N'TABLE', N'bd_purchase_in', N'COLUMN', N'审核时间2';

IF COL_LENGTH('dbo.bd_purchase_in', N'审核人2') IS NULL
BEGIN
    ALTER TABLE dbo.bd_purchase_in ADD [审核人2] nvarchar(100) NULL;
    PRINT N'[四单补列] 新增 bd_purchase_in.审核人2';
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.bd_purchase_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_purchase_in'), N'审核人2', 'ColumnId')
                  AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人2:ERP 血统的第二个审核人列(面板未登记,界面不显示)',
         N'SCHEMA', N'dbo', N'TABLE', N'bd_purchase_in', N'COLUMN', N'审核人2';
GO

/* ---------- ⑤ 自检:文档认定的这 4 列必须齐 ---------- */
DECLARE @miss nvarchar(400) = N'';
IF COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NULL SET @miss += N' qc_return_detail.退货数量';
IF COL_LENGTH('dbo.qc_return_detail', N'批号')     IS NULL SET @miss += N' qc_return_detail.批号';
IF COL_LENGTH('dbo.bd_purchase_in',   N'审核时间2') IS NULL SET @miss += N' bd_purchase_in.审核时间2';
IF COL_LENGTH('dbo.bd_purchase_in',   N'审核人2')   IS NULL SET @miss += N' bd_purchase_in.审核人2';
IF @miss <> N'' RAISERROR(N'四单按文档补列失败,仍缺:%s', 16, 1, @miss);
ELSE PRINT N'✅ 四单按文档补齐完成(退货数量/批号/审核时间2/审核人2)';
GO
PRINT N'migrate-fourdoc-missing-cols-20261008 完成';
GO
