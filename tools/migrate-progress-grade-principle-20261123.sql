/* ============================================================================
 * migrate-progress-grade-principle-20261123.sql
 * 项目进度查询(RD_PROGRESS)：把「项目定级原则」说明段改成**可自己编辑**的字段
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-23）：「标红的项目控制列表的这个题头位置的内容改为可以自己编辑」
 *   —— 原来那段「项目定级原则：1.二级项目-… 2.三级项目-… 3.四级项目-…」
 *     是写死在前端 ProgressControlSheet.vue 里的静态文案，用户改不了、也带不进打印模板。
 *
 * 做法：
 *   ① rd_progress 加列 `项目定级原则` nvarchar(1000)（纸面标题段是整单一段，故放表头）；
 *   ② yj_field 登记一条 header 字段（editable=1、visible=1、seq=118，紧跟文档编号/备注之间）；
 *   ③ 纸面渲染由 ProgressControlSheet 改成 textarea（空值回落原来的默认文案，观感不变）。
 *
 * 幂等：列已存在则跳过 ALTER；yj_field 已存在则跳过插入。末尾自检列与字段都在。
 * 两账套（HSDZ_MES / HSDZ_MES_TEST）都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
PRINT N'=== RD_PROGRESS 项目定级原则 可为编辑字段 ===';

IF OBJECT_ID(N'dbo.rd_progress', N'U') IS NULL
BEGIN
    RAISERROR(N'rd_progress 不存在,跳过', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.rd_progress', N'项目定级原则') IS NULL
BEGIN
    ALTER TABLE dbo.rd_progress ADD [项目定级原则] nvarchar(1000) NULL;
    PRINT N'① 已加列 rd_progress.项目定级原则';
END
ELSE PRINT N'① 列已存在,跳过';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROGRESS' AND label = N'项目定级原则')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'RD_PROGRESS', N'项目定级原则', N'项目定级原则', N'多行文本', N'header', 118, 780, 1, 0, 0, 1);
    PRINT N'② 已登记 yj_field(RD_PROGRESS.项目定级原则)';
END
ELSE PRINT N'② 字段已存在,跳过';

-- 自检
IF COL_LENGTH(N'dbo.rd_progress', N'项目定级原则') IS NULL
   OR NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROGRESS' AND label = N'项目定级原则')
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'[progress-grade-principle] 自检失败：列或字段缺失', 16, 1);
END

COMMIT TRANSACTION;
PRINT N'[progress-grade-principle] 自检通过';
GO
