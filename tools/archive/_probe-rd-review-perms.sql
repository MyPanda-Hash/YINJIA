/* 临时排查(2026-10-09):核对 rd_review 对 RD_APPROVAL 的 yj_role_panel 两列
   是否被我今天那两条权限迁移(revoke→grant)改坏。
   用 RAISERROR(severity 16) 报数 —— DbSync 吞 PRINT、只回显错误,故把数字塞进错误消息里。 */
SET NOCOUNT ON;
GO
DECLARE @r int = (SELECT TOP 1 id FROM yj_role WHERE role_code = N'rd_review');
DECLARE @u int = (SELECT TOP 1 id FROM yj_role WHERE role_code = N'user');
DECLARE @msg nvarchar(2000);

SET @msg = N'PERMS_CHECK || rd_review(id=' + ISNULL(CAST(@r AS nvarchar(10)), N'null') + N') RD_APPROVAL: perms=['
  + ISNULL((SELECT perms FROM yj_role_panel WHERE role_id = @r AND panel_code = N'RD_APPROVAL'), N'<无行>')
  + N'] can_approve=['
  + ISNULL((SELECT can_approve FROM yj_role_panel WHERE role_id = @r AND panel_code = N'RD_APPROVAL'), N'<无行>')
  + N']'
  + N' || user(id=' + ISNULL(CAST(@u AS nvarchar(10)), N'null') + N') RD_APPROVAL: perms=['
  + ISNULL((SELECT perms FROM yj_role_panel WHERE role_id = @u AND panel_code = N'RD_APPROVAL'), N'<无行>')
  + N'] can_approve=['
  + ISNULL((SELECT can_approve FROM yj_role_panel WHERE role_id = @u AND panel_code = N'RD_APPROVAL'), N'<无行>')
  + N']';

RAISERROR(@msg, 16, 1);
GO
