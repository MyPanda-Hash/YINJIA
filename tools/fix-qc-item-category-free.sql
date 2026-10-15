/* fix-qc-item-category-free.sql(2026-10-12):撤回「检验内容」的固定字典,改为自由维护。
 *
 * 背景:migrate-qc-item-category-dict.sql 把 QC_ITEM.检验内容 设成了固定下拉(6 个值)。
 * 用户 2026-10-12 纠正:「在项目维护处增加一个项目类别来实现对这个项目实现各个分类的实现,
 *   就是我比如都是外观类别的为一组,就是可以这样维护而不是让当前的写死几个字段为什么类别什么类别的」
 *   ⇒ 类别要**由维护时自由录入**(前端已改 filterable+allow-create),不能写死成字典。
 *
 * 本脚本:
 *   ① QC_ITEM.检验内容 → 回到纯文本(去掉 dict_sql),类别想叫什么就叫什么;
 *   ② QC_PROC_INSP.表区 → 同样回到文本(它的值由「带入明细」按项目类别自动写入,
 *      手工补行时也可自由填,不该被固定 6 个值限住)。
 * 幂等;两账套均执行。
 */
SET NOCOUNT ON;
GO

UPDATE yj_field SET data_type = N'文本', dict_sql = NULL
 WHERE panel_code = N'QC_ITEM' AND col_name = N'检验内容';
PRINT N'[OK] QC_ITEM.检验内容 恢复为自由文本,' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

UPDATE yj_field SET data_type = N'文本', dict_sql = NULL
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表区';
PRINT N'[OK] QC_PROC_INSP.表区 恢复为自由文本,' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

/* 自检:两列都不应再带 dict_sql */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ITEM' AND col_name = N'检验内容'
             AND ISNULL(dict_sql, N'') <> N'') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表区'
             AND ISNULL(dict_sql, N'') <> N'') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'检验类别自由化自检失败', 16, 1);
ELSE PRINT N'检验类别已自由化(检验内容 / 表区 均可自由录入)';
GO
