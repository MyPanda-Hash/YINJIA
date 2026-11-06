-- migrate-sample-int-row-owner-20261106.sql — 内部开发样品申请单：行级归属 + 「改他人行」权限词
--
-- 用户口径(2026-11-06 第三轮):
--   「内部的这个样品开发单去掉审批，不需要审批，性质是一个数据记录表，但是样式不变，可以新增行数进行填写，
--     多了就切页，20行就切，谁填写的申请人就是谁，每个人只能改自己作为申请人的行数据，点击保存之后
--     申请人就不能改了，只能由有更改权限的人来改，这个权限写进组织架构对应面板里面，
--     未点保存点击草稿，申请人还是可以改的，每一行数据就像一张独立的单据一样，保存修改状态是不互通的」
--
-- 本脚本只做**授权数据**：给 RD_SAMPLE_INT 的角色权限行补上 edit_others（改他人行）词。
--   · 管理员/文件负责人/研发审核 三个角色本来就有该面板的 audit/modify 权 ⇒ 默认给上；
--   · 普通用户（role 2）不给：只能改自己作为申请人的行（后端 ButtonService.applySampleIntRowRules 强制）。
-- 代码侧同源：SysAdminController.SAMPLE_INT_ACTIONS 把该词放进组织架构·角色与面板权限的矩阵列；
--             AuthController 下发 user.editOtherRowsPanels 供前端锁格。
-- 幂等：按 role_id + panel_code 更新，且已含该词则跳过。
-- 适用：本地/生产通用（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）。

IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

UPDATE yj_role_panel
SET perms = CASE
        WHEN perms IS NULL OR LTRIM(RTRIM(perms)) = N'' THEN N'edit_others'
        WHEN perms LIKE N'%edit_others%' THEN perms
        ELSE perms + N',edit_others'
    END
WHERE panel_code = N'RD_SAMPLE_INT'
  AND role_id IN (1, 3, 4);
GO

-- 自检：三个角色都应带该词
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_INT'
    AND role_id IN (1, 3, 4) AND perms LIKE N'%edit_others%') <> 3
  RAISERROR(N'[FAIL] RD_SAMPLE_INT 的 改他人行 授权未落到 3 个角色', 12, 1) WITH NOWAIT;
GO
SELECT role_id, panel_code, can_approve, perms FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_INT' ORDER BY role_id;
GO
RAISERROR(N'[PASS] 内部样品单：管理员/文件负责人/研发审核 已具备「改他人行」', 10, 1) WITH NOWAIT;
GO
