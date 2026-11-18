package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 特殊数据记录表（RD_EXTRA_REC_FILE）——「数据记录表」菜单下的上传类面板。
 *
 * <p>【用户口径 2026-11-17】「在数据记录表列下边…新设计一个面板，可以上传一些比较特殊的数据记录表
 * 进行保存，也可以点击预览这些文件，删除需要管理员审批…所有人只要能看这个面板就可以查看这些上传的
 * 数据记录表」。追问确认：全员可传 / 删除走**单独的「待审批删除」列表**。</p>
 *
 * <p>【形态】1 行 = 1 份文件；文件本体复用 yj_attachment（锚点 = 面板 + 文件编号 + 「文件」列），
 * 与「共享文件库」(ShareFileService) 同一套做法 —— 不另造文件存储。</p>
 *
 * <p>【删除审批】**不走**引擎的 yj_doc_status 审批流（本表不是单据，没有单据状态机），
 * 而是本表自带 {@code del_state}：</p>
 * <ul>
 *   <li>空 = 正常；</li>
 *   <li>PENDING = 已提交删除申请，等管理员在「待审批删除」列表里处理；</li>
 *   <li>通过 ⇒ **物理删除**（行 + 附件一起删）；驳回 ⇒ 回到空并留痕。</li>
 * </ul>
 *
 * <p>【权限】查看 = 面板 view/query；上传 = add；提交删除申请 = add（人人可申请）；
 * 审批 = 管理员 或 (can_approve 且 del)。所有校验都在服务端，前端只负责显示/隐藏按钮。</p>
 */
@Service
public class ExtraRecFileService {

    public static final String PANEL = "RD_EXTRA_REC_FILE";
    private static final String FIELD_KEY = "文件";
    private static final String TABLE = "rd_extra_rec_file";

    private final JdbcTemplate jdbc;
    private final AttachmentService attachments;
    private final PanelPermissionService perms;

    public ExtraRecFileService(JdbcTemplate jdbc, AttachmentService attachments, PanelPermissionService perms) {
        this.jdbc = jdbc;
        this.attachments = attachments;
        this.perms = perms;
    }

    /** 前端按钮门禁：能否上传 / 能否审批删除。管理员恒真。 */
    public Map<String, Object> permOfCurrentUser(String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("canUpload", perms.hasAnyPerm(PANEL, "add", "modify"));
        out.put("canApproveDelete", canApproveDelete(user));
        out.put("pendingCount", pendingCount());
        return out;
    }

    /**
     * 审批删除：管理员 或 (该面板 can_approve 且有 del 词)。
     * ⚠ PanelPermissionService.isAdmin 是**私有**的，这里按同一口径(yj_user.is_admin='Y')自判 ——
     *   与全站管理员定义同源，不另立标准。
     */
    private boolean canApproveDelete(String user) {
        return isAdminUser(user) || (canApprovePanel(user) && perms.hasAnyPerm(PANEL, "del"));
    }

    private boolean isAdminUser(String user) {
        if (user == null || user.isBlank()) return false;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT is_admin FROM yj_user WHERE username=?", user);
        return !rows.isEmpty() && "Y".equals(String.valueOf(rows.get(0).get("is_admin")));
    }

    /** 该用户是否本面板的审批人(can_approve='Y';管理员恒真) */
    private boolean canApprovePanel(String user) {
        if (isAdminUser(user)) return true;
        if (user == null || user.isBlank()) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user u JOIN yj_role_panel p ON p.role_id = u.role_id"
                        + " WHERE u.username=? AND p.panel_code=? AND p.can_approve='Y'",
                Integer.class, user, PANEL);
        return n != null && n > 0;
    }

    // ══════════ 列表 ══════════

    /**
     * 分页列表。
     *
     * @param keyword 匹配 文件名称/关键词/备注/分类/上传人
     * @param pending true = 只看「待审批删除」的行（管理员那个列表用）
     */
    public Map<String, Object> list(String keyword, boolean pending, int pageNo, int pageSize) {
        StringBuilder where = new StringBuilder(" WHERE ISNULL(f.asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        where.append(pending ? " AND f.del_state = 'PENDING'" : " AND ISNULL(f.del_state,'') <> 'PENDING'");
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            where.append(" AND (f.[文件名称] LIKE ? OR f.[关键词] LIKE ? OR f.[备注] LIKE ? OR f.[分类] LIKE ? OR f.[上传人] LIKE ?)");
            String like = "%" + kw + "%";
            for (int i = 0; i < 5; i++) args.add(like);
        }
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM " + TABLE + " f" + where, Integer.class, args.toArray());
        int size = Math.min(Math.max(pageSize, 1), 100);
        int offset = Math.max(pageNo - 1, 0) * size;
        Object[] qArgs = new Object[args.size() + 2];
        for (int i = 0; i < args.size(); i++) qArgs[i] = args.get(i);
        qArgs[args.size()] = offset;
        qArgs[args.size() + 1] = size;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT f.id, f.[文件编号] AS no, f.[文件名称] AS name, f.[分类] AS category,"
                        + " f.[关键词] AS keywords, f.[备注] AS remark, f.[上传人] AS uploader,"
                        + " CONVERT(varchar(19), f.[上传时间], 120) AS uploadTime,"
                        + " ISNULL(f.del_state,'') AS delState, f.del_req_by AS delReqBy,"
                        + " CONVERT(varchar(19), f.del_req_at, 120) AS delReqAt, f.del_req_note AS delReqNote,"
                        + " a.id AS attachmentId, a.file_name AS fileName, a.file_size AS fileSize, a.content_type AS contentType"
                        + " FROM " + TABLE + " f LEFT JOIN yj_attachment a"
                        + " ON a.panel_code='" + PANEL + "' AND a.doc_no=f.[文件编号] AND a.field_key=N'" + FIELD_KEY + "'"
                        + where + " ORDER BY f.id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                qArgs);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total == null ? 0 : total);
        out.put("rows", rows);
        return out;
    }

    /** 单行（上传/审批后回读用）。 */
    public Map<String, Object> rowOf(long id) {
        List<Map<String, Object>> rs = jdbc.queryForList(
                "SELECT f.id, f.[文件编号] AS no, f.[文件名称] AS name, f.[分类] AS category,"
                        + " f.[关键词] AS keywords, f.[备注] AS remark, f.[上传人] AS uploader,"
                        + " CONVERT(varchar(19), f.[上传时间], 120) AS uploadTime,"
                        + " ISNULL(f.del_state,'') AS delState"
                        + " FROM " + TABLE + " f WHERE f.id = ?", id);
        return rs.isEmpty() ? null : rs.get(0);
    }

    // ══════════ 上传 ══════════

    /** 上传：建记录（占位号 → XR+序号）→ 附件入库；附件失败则回滚记录。1 记录 1 文件。 */
    public Map<String, Object> upload(String name, String category, String keywords, String remark,
                                      MultipartFile file, String user) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择要上传的文件");
        String displayName = name == null || name.isBlank()
                ? stripExt(safePart(file.getOriginalFilename())) : name.trim();
        if (displayName.isEmpty()) throw new IllegalArgumentException("文件名称无效");
        // 占位编号 Java 侧生成（唯一、≤20 字符），插入后按它精确回查 id 再改成 XR 序号 —— 免并发歧义
        String placeholder = "TMP#" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 15);
        jdbc.update("INSERT INTO " + TABLE + " ([文件编号],[文件名称],[分类],[关键词],[备注],[上传人],[上传时间],asp_user1,asp_time1)"
                        + " VALUES (?,?,?,?,?,?,SYSDATETIME(),?,SYSDATETIME())",
                placeholder, displayName, trim(category), trim(keywords), trim(remark), user, user);
        Integer id = jdbc.queryForObject("SELECT id FROM " + TABLE + " WHERE [文件编号]=?", Integer.class, placeholder);
        String docNo = "XR" + String.format("%05d", id);
        try {
            jdbc.update("UPDATE " + TABLE + " SET [文件编号]=? WHERE id=?", docNo, id);
            attachments.upload(PANEL, docNo, FIELD_KEY, file, user);
        } catch (Exception e) {
            jdbc.update("DELETE FROM " + TABLE + " WHERE id=?", id);
            throw e instanceof RuntimeException re ? re : new IllegalStateException("文件保存失败:" + e.getMessage(), e);
        }
        return rowOf(id);
    }

    // ══════════ 删除审批 ══════════

    /** 提交删除申请（人人可申请，无需管理员）。正常 → PENDING。 */
    public Map<String, Object> requestDelete(long id, String note, String user) {
        Map<String, Object> row = requireRow(id);
        if ("PENDING".equals(str(row.get("delState")))) throw new IllegalArgumentException("该文件已在删除审批中");
        jdbc.update("UPDATE " + TABLE + " SET del_state='PENDING', del_req_by=?, del_req_at=SYSDATETIME(),"
                        + " del_req_note=?, del_appr_by=NULL, del_appr_at=NULL, del_appr_result=NULL, asp_user2=?, asp_time2=SYSDATETIME()"
                        + " WHERE id=?", user, trim(note), user, id);
        return rowOf(id);
    }

    /** 撤回自己的删除申请：PENDING → 正常。 */
    public Map<String, Object> cancelDelete(long id, String user) {
        Map<String, Object> row = requireRow(id);
        String st = str(row.get("delState"));
        if (!"PENDING".equals(st)) throw new IllegalArgumentException("该文件没有待审批的删除申请");
        String reqBy = str(row.get("delReqBy"));
        if (!isAdminUser(user) && reqBy != null && !reqBy.equals(user)) {
            throw new IllegalArgumentException("只有申请人本人或管理员可以撤回删除申请");
        }
        jdbc.update("UPDATE " + TABLE + " SET del_state=NULL, del_req_by=NULL, del_req_at=NULL, del_req_note=NULL"
                        + " WHERE id=?", id);
        return rowOf(id);
    }

    /**
     * 审批删除申请（管理员或 can_approve+del）。
     *
     * @param approve true = 通过 ⇒ **物理删除**（行 + 附件）；false = 驳回 ⇒ 回到正常并留痕
     */
    public Map<String, Object> decideDelete(long id, boolean approve, String user) throws IOException {
        if (!canApproveDelete(user)) throw new IllegalArgumentException("没有审批删除的权限");
        Map<String, Object> row = requireRow(id);
        if (!"PENDING".equals(str(row.get("delState")))) throw new IllegalArgumentException("该文件没有待审批的删除申请");
        String docNo = str(row.get("no"));
        if (approve) {
            // 先删附件本体（失败就整体失败，不留孤儿行），再删登记行。
            // ⚠ AttachmentService 没有"按单据批量删"的方法，这里查出该锚点的附件 id 逐个删。
            if (docNo != null) {
                List<Map<String, Object>> files = attachments.list(PANEL, docNo, FIELD_KEY);
                for (Map<String, Object> f : files) {
                    Object aid = f.get("id");
                    if (aid instanceof Number n) attachments.delete(n.longValue(), user);
                }
            }
            jdbc.update("DELETE FROM " + TABLE + " WHERE id=?", id);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("deleted", true);
            out.put("id", id);
            return out;
        }
        jdbc.update("UPDATE " + TABLE + " SET del_state=NULL, del_appr_by=?, del_appr_at=SYSDATETIME(), del_appr_result='REJECTED'"
                        + " WHERE id=?", user, id);
        return rowOf(id);
    }

    /** 待审批删除条数（前端红点/角标用） */
    public int pendingCount() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + TABLE
                + " WHERE del_state='PENDING' AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class);
        return n == null ? 0 : n;
    }

    // ══════════ 内部 ══════════

    private Map<String, Object> requireRow(long id) {
        List<Map<String, Object>> rs = jdbc.queryForList(
                "SELECT id, [文件编号] AS no, ISNULL(del_state,'') AS delState, del_req_by AS delReqBy"
                        + " FROM " + TABLE + " WHERE id=? AND ISNULL(asp_cancel,'N') <> 'Y'", id);
        if (rs.isEmpty()) throw new IllegalArgumentException("文件不存在或已删除");
        return rs.get(0);
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }

    private static String trim(String s) { return s == null ? null : s.trim(); }

    /** 只保留文件名（去掉客户端可能带的路径），防目录穿越 */
    private static String safePart(String name) {
        if (name == null) return "";
        String n = name.replace('\\', '/');
        int i = n.lastIndexOf('/');
        return i >= 0 ? n.substring(i + 1) : n;
    }

    private static String stripExt(String name) {
        if (name == null) return "";
        int i = name.lastIndexOf('.');
        return i > 0 ? name.substring(0, i) : name;
    }
}
