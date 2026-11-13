/* ============================================================
   migrate-wo-list-del-perm-20261113.sql — 2026-11-13(第二轮)
   生产工单页动作词 del(删除)+ 授权

   用户口径:「当前工单应该可以删除,从订单结转处转来的工单删除应该回到订单结转中,
   而已经排产的不能删除。其他存在报工的自然也不能删除了。」

   ⇒ 代码侧:
      · PagePanelRegistry.WORK_ORDER_LIST_ACTIONS 增 {"del","删除"};
      · PanelPermissionService 覆盖映射 WORK_ORDER_LIST|删除工单 → {"del"};
      · 后端 POST /px/workOrderList/delete 按该词鉴权;
      · 前端生产工单页工具栏「删除工单」按钮按 canDo('del') 显隐。
   本脚本只补授权(零 DDL):
      给**已授 create(新增)** 的角色补 del(能建单的岗位才需要删自己刚建的草稿单),
      不给「只能看」的角色发删除权 —— 删除是破坏性动作,按最小授权。
      管理员恒有权(is_admin 旁路),不受本脚本影响。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
UPDATE rp
   SET rp.perms = rp.perms + N',del'
  FROM dbo.yj_role_panel rp
 WHERE rp.panel_code = N'WORK_ORDER_LIST'
   AND ISNULL(rp.perms, N'') LIKE N'%create%'
   AND ISNULL(rp.perms, N'') NOT LIKE N'%del%';
GO
-- 自检:有 create 授权的行必须都已补 del
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
            WHERE panel_code = N'WORK_ORDER_LIST'
              AND ISNULL(perms,N'') LIKE N'%create%'
              AND ISNULL(perms,N'') NOT LIKE N'%del%') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'生产工单删除权(del)自检失败:仍有 create 行缺 del', 16, 1);
ELSE PRINT N'生产工单页 del(删除)授权就绪';
GO
