SET NOCOUNT ON;
PRINT '=== 三单与采购入库 面板表绑定 ===';
SELECT panel_code, panel_name, mode, head_table, line_table, code_col, prefix FROM yj_panel WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','QC_TC','OTHER_IN','OTHER_OUT','PU_ORDER','SL_RECV');
GO
PRINT '=== yj_std_lib 内容(前 40 行) ===';
SELECT TOP 40 lib_code, item_code, LEFT(content, 60) AS content, seq, enabled FROM yj_std_lib ORDER BY lib_code, seq;
GO
PRINT '=== yj_std_lib 按库分组 ===';
SELECT lib_code, COUNT(*) AS n FROM yj_std_lib GROUP BY lib_code;
GO
PRINT '=== 用户与角色分配 ===';
SELECT u.username, u.real_name, u.is_admin, r.role_code, r.role_name, u.enabled FROM yj_user u LEFT JOIN yj_role r ON r.id=u.role_id ORDER BY u.username;
GO
PRINT '=== 角色面板授权行数 ===';
SELECT r.role_code, COUNT(*) AS panels, SUM(CASE WHEN rp.can_approve='Y' THEN 1 ELSE 0 END) AS approvable FROM yj_role r LEFT JOIN yj_role_panel rp ON rp.role_id=r.id GROUP BY r.role_code;
