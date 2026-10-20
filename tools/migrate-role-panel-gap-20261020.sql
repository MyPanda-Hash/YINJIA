/* ═══════════════════════════════════════════════════════════════════════════════
   组织架构·角色面板权限：补齐两处缺口
   (2026-10-20 用户口径:「更新一下组织架构的角色的面板,现在已经多了一个面板了,调整一下模块」)

   【实测缺口】(两账套一致;/api/sys/role/{id}/panels 与 yj_role_panel 双查)
     ① admin(role_id=1)**反而缺 5 个**,而其它三个角色都有 —— 倒挂:
        FIELDMGR(字段管理) / ZDGL(数据字典),这两个还是**管理员专属**面板
        (PanelPermissionService.ADMIN_ONLY_PANELS = 仅管理员可写,非管理员只读);
        ERP_INTEG / ERPLG / ERPLG_ROW(ERP 系统集成三件)。
     ② PU_ORDER_DETAIL(采购订单明细表) / PU_ORDER_STATS(采购订单统计表)**四个角色全都没有**
        —— 而兄弟面板 PU_ORDER / SALES_ORDER_DETAIL / SALE_OUT_DETAIL 都有;
        属于「加报表时漏登记授权」,导致任何角色在导航里都看不到这两张表。

   【口径】
     · admin 按角色 2(普通用户)的同款 perms 补齐 —— 管理员不该比普通角色少;
     · 两张采购报表按**兄弟面板 PU_ORDER 的授权行复制**(同角色、同 can_approve、同 perms),
       不自行扩大权限范围。
   · 只 INSERT 缺失行,已有的不动 ⇒ 幂等,不覆盖现场人工调过的权限。

   【回退】DELETE FROM yj_role_panel WHERE (role_id=1 AND panel_code IN
     ('ERP_INTEG','ERPLG','ERPLG_ROW','FIELDMGR','ZDGL'))
     OR (panel_code IN ('PU_ORDER_DETAIL','PU_ORDER_STATS'));
   ⚠ 回退会把原本就存在的行一起删,执行前先确认。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
PRINT N'== 角色面板权限补齐 ==';

/* ── ① admin 补齐那 5 个(照 role 2 的行复制) ── */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT 1, src.panel_code, src.can_approve, src.perms
FROM yj_role_panel src
WHERE src.role_id = 2
  AND src.panel_code IN (N'ERP_INTEG', N'ERPLG', N'ERPLG_ROW', N'FIELDMGR', N'ZDGL')
  AND NOT EXISTS (
      SELECT 1 FROM yj_role_panel t
      WHERE t.role_id = 1 AND t.panel_code = src.panel_code
  );
PRINT N'  [①] admin 补齐 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* ── ③ 清理孤儿授权:role_id 在 yj_role 里已不存在的行 ──
   (实测 role_id=3 有 28 行授权,但 yj_role 里没有 id=3、yj_user 里也没有 role_id=3 的用户
    ⇒ 角色被删而授权没跟着删的脏数据;留着会让"角色面板"统计虚高) */
DELETE FROM yj_role_panel
WHERE NOT EXISTS (SELECT 1 FROM yj_role r WHERE r.id = yj_role_panel.role_id);
PRINT N'  [③] 清理孤儿授权 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* ── ② 采购订单明细表/统计表:照 PU_ORDER 的授权行复制 ── */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT src.role_id, p.panel_code, src.can_approve, src.perms
FROM yj_role_panel src
CROSS JOIN (VALUES (N'PU_ORDER_DETAIL'), (N'PU_ORDER_STATS')) p(panel_code)
WHERE src.panel_code = N'PU_ORDER'
  AND NOT EXISTS (
      SELECT 1 FROM yj_role_panel t
      WHERE t.role_id = src.role_id AND t.panel_code = p.panel_code
  );
PRINT N'  [②] 采购订单明细/统计表补齐 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* ── 自检 ── */
DECLARE @adminCnt int = (SELECT COUNT(1) FROM yj_role_panel WHERE role_id = 1);
DECLARE @adminMissing int = (
    SELECT COUNT(1) FROM (VALUES (N'DASHBOARD'), (N'FIELDMGR'), (N'ZDGL'),
                                (N'ERP_INTEG'), (N'ERPLG'), (N'ERPLG_ROW')) v(c)
    WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel t WHERE t.role_id = 1 AND t.panel_code = v.c)
      AND v.c <> N'DASHBOARD'   -- DASHBOARD 是虚拟面板,admin 由代码恒放行,不需要授权行
);
DECLARE @puCnt int = (SELECT COUNT(1) FROM yj_role_panel WHERE panel_code IN (N'PU_ORDER_DETAIL', N'PU_ORDER_STATS'));
IF @adminMissing <> 0
BEGIN
    DECLARE @m1 nvarchar(200) = N'[FAIL] admin 仍缺 ' + CAST(@adminMissing AS nvarchar(10)) + N' 个面板';
    RAISERROR(@m1, 16, 1);
    RETURN;
END
IF @puCnt <> 8
BEGIN
    DECLARE @m2 nvarchar(200) = N'[FAIL] 采购两报表应有 8 行(4 角色×2),实际 ' + CAST(@puCnt AS nvarchar(10));
    RAISERROR(@m2, 16, 1);
    RETURN;
END
PRINT N'  [自检] admin 面板数 = ' + CAST(@adminCnt AS nvarchar(10))
    + N',采购两报表授权行 = ' + CAST(@puCnt AS nvarchar(10)) + N' ✓';
PRINT N'== 完成 ==';
