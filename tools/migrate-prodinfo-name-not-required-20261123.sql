/* ============================================================================
 * migrate-prodinfo-name-not-required-20261123.sql
 * 产品信息表：「产品名称」取消必填（纸面大标题已固定为「产品信息表」，不再有该输入格）
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-23）：
 *   「第一，这个产品名称已经固定了，但是必填没有取消」
 *
 * 背景：
 *   2026-10-16 曾把左上角大标题改成「产品名称」输入框，并同步 yj_field.required=1
 *   （tools/migrate-prodinfo-name-required-20261016.sql）。
 *   2026-11-19 用户改口径「左上角的大的产品名称固定为产品信息表」⇒ 前端 titleKey 已撤掉，
 *   纸面上**没有任何输入口**；但 required=1 仍在，于是保存/提交会被
 *   「产品名称不能为空」挡住，而用户无处可填（死结）。
 *   ⚠ 与「隐藏字段不校验」同一类问题：字段已不在纸面，就不该再拦必填。
 *
 * 做法：只把 RD_PROD_INFO 的「产品名称」表头行 required 置 0；
 *   字段本身与历史值**保留**（下游成型/组装工艺清单仍靠它按产品编号参照带回，
 *   只是不再由用户手填、也不再参与必填校验）。
 *
 * 幂等：仅当前 required=1 才更新；重复执行 0 行。末尾自检 that required=0。
 * 两账套（HSDZ_MES / HSDZ_MES_TEST）都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
PRINT N'=== RD_PROD_INFO.产品名称 取消必填 ===';

IF OBJECT_ID(N'dbo.yj_field', N'U') IS NULL
BEGIN
    RAISERROR(N'yj_field 不存在,跳过', 16, 1);
    RETURN;
END

-- ⚠ 同标签可能有 place='query' 的筛选用行,只改**表头行**
UPDATE yj_field SET required = 0
WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品名称'
  AND place LIKE N'%header%' AND ISNULL(required, 0) = 1;
PRINT N'取消必填(表头行)更新行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- 自检：表头行的 required 必须已是 0
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO'
           AND label = N'产品名称' AND place LIKE N'%header%' AND ISNULL(required, 0) = 1)
    RAISERROR(N'[prodinfo-name-not-required] 自检失败：产品名称仍为必填', 16, 1);
PRINT N'[prodinfo-name-not-required] 自检通过：产品名称不再是必填';
GO
