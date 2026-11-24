/* ============================================================================
 * migrate-prodinfo-notrequired-20261123.sql
 * 产品信息表：「产品名称」「客户编码」取消必填
 * ----------------------------------------------------------------------------
 * 用户口径：
 *   2026-11-23「这个产品名称已经固定了，但是必填没有取消」；
 *   2026-11-19「把客户编码去掉」。
 *
 * 问题（同一类死结）：
 *   两个字段都已按用户口径**从纸面撤下**，但 yj_field.required 仍为 1
 *   ⇒ 保存/提交被「X 不能为空」挡住，而界面上没有任何输入口，用户永远补不上。
 *   与「隐藏字段不校验」同一类：字段不在纸面，就不该拦必填。
 *
 *   · 产品名称：纸面大标题已固定为「产品信息表」（utils 2026-11-19 改版），
 *     字段与历史值保留 —— 下游成型/组装工艺清单仍靠「产品编号参照」同名带回。
 *   · 客户编码：纸面已按 2026-11-19 口径撤掉，值改由「客户名称」参照 KHDA 档案带入
 *     （recordSheetConfigs 的 refMap：客户名称→客户编码），不需要人工填。
 *
 * 幂等：只更新当前 required=1 的行；重复执行 0 行。末尾自检两字段均 required=0。
 * 两账套（HSDZ_MES / HSDZ_MES_TEST）都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
PRINT N'=== RD_PROD_INFO：产品名称 / 客户编码 取消必填 ===';

IF OBJECT_ID(N'dbo.yj_field', N'U') IS NULL
BEGIN
    RAISERROR(N'yj_field 不存在,跳过', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

-- 只改**表头行**（同标签可能还有 place='query' 的筛选用行，那行不参与保存校验）
UPDATE yj_field SET required = 0
WHERE panel_code = N'RD_PROD_INFO'
  AND label IN (N'产品名称', N'客户编码')
  AND place LIKE N'%header%'
  AND ISNULL(required, 0) = 1;
PRINT N'取消必填(表头行)更新行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO'
           AND label IN (N'产品名称', N'客户编码') AND place LIKE N'%header%'
           AND ISNULL(required, 0) = 1)
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'[prodinfo-notrequired] 自检失败：仍有字段是必填', 16, 1);
END

COMMIT TRANSACTION;
PRINT N'[prodinfo-notrequired] 自检通过：产品名称 / 客户编码 都不是必填';
GO
