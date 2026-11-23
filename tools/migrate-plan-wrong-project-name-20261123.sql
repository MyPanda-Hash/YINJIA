/* ============================================================================
 * migrate-plan-wrong-project-name-20261123.sql
 * 修复「项目实施计划 · 项目名称」被自动建单写成尺寸的存量数据
 * ----------------------------------------------------------------------------
 * 根因（已定位到代码行，同批已修）：
 *   ButtonService.ensurePlanForApproval 里 `项目名称 = 立项.机型及应用位置`，
 *   而机型格实际常填尺寸（生产实测 LXA-2026-11-0031 的机型 = `44.5*9.5*46±0.5mm(包布)`）
 *   ⇒ 自动建出来的实施计划项目名称显示成尺寸，并被 syncPlanToProgress 同步进项目进度查询。
 *
 * 本脚本只修**存量**，且判据很窄，避免误伤：
 *   · 项目名称必须是「像尺寸」的串（同时含 * 或 × ，且含 mm）；
 *   · 对应立项申请的「立项背景」必须有值（那是用户写项目名/项目背景的那一格）；
 *   · 只处理未作废的单。
 *   ⇒ 实测只有 1 行命中（LXB-2026-11-0012：44.5*9.5*46±0.5mm(包布) → C3项目）；
 *     另一行 LXB-2026-11-0011 的项目名称「冰箱炭棒滤芯」是正常名字、机型也是它，**不动**。
 *
 * 幂等：修过之后不再命中该 WHERE；重复执行 0 行。执行前后打印行数与样例。
 * 两账套（HSDZ_MES / HSDZ_MES_TEST）都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
PRINT N'=== 修复 项目实施计划.项目名称 = 尺寸 ===';

IF OBJECT_ID(N'dbo.rd_plan', N'U') IS NULL OR OBJECT_ID(N'dbo.rd_approval', N'U') IS NULL
BEGIN
    RAISERROR(N'rd_plan / rd_approval 不存在,跳过', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

-- 修前快照（便于核对/回滚）：被命中的行与新值
PRINT N'-- 修前（单据编号 | 旧项目名称 | 将改为）';
SELECT 单据编号 = p.单据编号,
       旧项目名称 = p.项目名称,
       改为 = LEFT(LTRIM(RTRIM(a.立项背景)), 50)
  FROM rd_plan p
  JOIN rd_approval a ON a.单据编号 = p.文档编号
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND ISNULL(a.asp_cancel,'N') <> 'Y'
   AND ISNULL(p.项目名称,'') <> N''
   AND (p.项目名称 LIKE N'%*%mm%' OR p.项目名称 LIKE N'%×%mm%')
   AND LTRIM(RTRIM(ISNULL(a.立项背景,N''))) <> N'';

UPDATE p
   SET p.项目名称 = LEFT(LTRIM(RTRIM(a.立项背景)), 50)
  FROM rd_plan p
  JOIN rd_approval a ON a.单据编号 = p.文档编号
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND ISNULL(a.asp_cancel,'N') <> 'Y'
   AND ISNULL(p.项目名称,'') <> N''
   AND (p.项目名称 LIKE N'%*%mm%' OR p.项目名称 LIKE N'%×%mm%')
   AND LTRIM(RTRIM(ISNULL(a.立项背景,N''))) <> N'';
PRINT N'-- 更新行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- 自检：仍有「像尺寸且立项背景有值」的项目名称 ⇒ 回滚
IF EXISTS (SELECT 1 FROM rd_plan p JOIN rd_approval a ON a.单据编号 = p.文档编号
            WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(a.asp_cancel,'N') <> 'Y'
              AND (p.项目名称 LIKE N'%*%mm%' OR p.项目名称 LIKE N'%×%mm%')
              AND LTRIM(RTRIM(ISNULL(a.立项背景,N''))) <> N'')
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'[plan-wrong-project-name] 自检失败：仍有尺寸型项目名称', 16, 1);
END

COMMIT TRANSACTION;
PRINT N'[plan-wrong-project-name] 自检通过';
GO
