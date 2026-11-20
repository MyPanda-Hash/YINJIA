/* migrate-qc-line-patrol-approval-20261120.sql(2026-11-20):成型车间巡线记录表 QC_LINE_PATROL —— 一级审批权
 *
 * 需求来源(用户 2026-11-20 第 5 条):
 *   「为当前页面增加一级审批流程。」
 *   追问「审批通过权给哪些角色」→ 用户选定:**与首件检验单 / 制程检验单同口径**
 *   (生产 / 质量审核 / 总经理 / 品质审核)。
 *
 * 背景(为什么还要一条迁移):
 *   2026-11-17 已把 QC_LINE_PATROL 登记进 ButtonService.SINGLE_LEVEL_INSP_PANELS(后端单级审批),
 *   但①前端 PanelxList.hasApprovalBtns 漏登记 ⇒ 侧栏没有「提交审批」按钮(本次已补);
 *     ②本面板的 can_approve 只管到「总经理(1042)/仓库审核(1043)」,与首件/制程的审批人不是一个口径;
 *     ③「品质审核(1048)」在本面板**连授权行都没有**(2026-11-14 那次照抄 QC_OQC_REPORT 的授权,
 *       当时 1048 还没建)。
 *   ⇒ 本脚本只动 yj_role_panel:给 1033 生产 / 1039 质量审核 / 1042 总经理 / 1048 品质审核
 *     置 can_approve='Y',缺行则补行(perms 照该角色在 QC_FIRST_INSP 上的 perms)。
 *
 * 审批口径(与首件/制程/出货检验表观完全同形,不改后端):
 *   草稿 → 提交审批(审批中) → 审批通过(一次) = 已审核 → 弃审 → 草稿;
 *   编制格 = 「巡线人员」(业务值,可手填;提交审批时为空才兜底写提交人);
 *   审批通过时后端写纸面「审核人 / 审核时间」,弃审/驳回清空。
 *
 * 幂等:已有行只 UPDATE can_approve(N→Y);缺行 INSERT ... WHERE NOT EXISTS;
 *   末尾自检:面板存在的前提下,4 个角色必须都是 Y,否则 RAISERROR 16(DbSync 判失败、不记哈希)。
 * 账套:正式 HSDZ_MES 与测试 HSDZ_MES_TEST **两个都执行**(脚本本身不挑库)。
 */

DECLARE @want TABLE (role_id int PRIMARY KEY, role_name nvarchar(50) NOT NULL);
INSERT INTO @want (role_id, role_name) VALUES
  (1033, N'生产'),
  (1039, N'质量审核'),
  (1042, N'总经理'),
  (1048, N'品质审核');

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_LINE_PATROL')
BEGIN
  /* 三态自检之一:本账套还没装这个面板(极旧/精简账套)⇒ 明确提示跳过,不当失败 */
  PRINT N'[SKIP] 本账套无 QC_LINE_PATROL 面板，跳过审批权授权';
END
ELSE
BEGIN
  /* A. 已有授权行:置审批权(只动 can_approve,perms 保持原样,避免顺手改掉别的能力) */
  UPDATE rp
     SET rp.can_approve = N'Y'
    FROM yj_role_panel rp
    JOIN @want w ON w.role_id = rp.role_id
   WHERE rp.panel_code = N'QC_LINE_PATROL'
     AND ISNULL(rp.can_approve, N'N') <> N'Y';
  PRINT N'[UPD] QC_LINE_PATROL 置审批权行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

  /* B. 缺授权行:补行(perms 照同角色在首件检验单上的口径;没有就照通用质量单据口径) */
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
  SELECT w.role_id,
         N'QC_LINE_PATROL',
         N'Y',
         ISNULL((SELECT TOP 1 fi.perms
                   FROM yj_role_panel fi
                  WHERE fi.role_id = w.role_id AND fi.panel_code = N'QC_FIRST_INSP'),
                N'view,query,add,modify,modlog,del,export,print,audit,field,warn')
    FROM @want w
   WHERE EXISTS (SELECT 1 FROM yj_role r WHERE r.id = w.role_id)
     AND NOT EXISTS (SELECT 1 FROM yj_role_panel rp
                      WHERE rp.role_id = w.role_id AND rp.panel_code = N'QC_LINE_PATROL');
  PRINT N'[INS] QC_LINE_PATROL 补授权行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
GO

/* C. 自检(面板存在时:4 个角色必须都能审批) */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_LINE_PATROL')
BEGIN
  DECLARE @hit int = (
    SELECT COUNT(*)
      FROM yj_role_panel rp
      JOIN (VALUES (1033), (1039), (1042), (1048)) w(id) ON w.id = rp.role_id
     WHERE rp.panel_code = N'QC_LINE_PATROL'
       AND ISNULL(rp.can_approve, N'N') = N'Y');
  IF @hit <> 4
    RAISERROR(N'QC_LINE_PATROL 审批权自检失败:应 4 个角色(1033/1039/1042/1048)可审批,实际 %d', 16, 1, @hit);
  ELSE
    PRINT N'巡线记录表一级审批权就绪(1033 生产 / 1039 质量审核 / 1042 总经理 / 1048 品质审核)';
END
GO
