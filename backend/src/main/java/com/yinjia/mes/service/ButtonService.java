package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 按钮服务:对齐 light-mes PxService.callButton 的中文按钮分发与状态机。
 * - 保存/提交(空编号=新建单据,与 light-mes directAdd 语义一致)
 * - 审核/弃审(yj_doc_status 记录,不动旧表)
 * - 删除:单据=yj_doc_status.canceled='Y';档案行=旧行 asp_cancel='Y'(对齐旧系统软删)
 * 留痕约定:asp_user1/asp_time1=创建,asp_user2/asp_time2=最后修改(与旧数据一致)
 */
@Service
public class ButtonService {

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final FormNoService formNoService;
    private final JdbcTemplate jdbc;

    public ButtonService(PanelRegistry registry, QueryService queryService,
                         FormNoService formNoService, JdbcTemplate jdbc) {
        this.registry = registry;
        this.queryService = queryService;
        this.formNoService = formNoService;
        this.jdbc = jdbc;
    }

    @Transactional
    public Map<String, Object> callButton(String panelCode, String buttonName,
                                          Map<String, Object> formData, Map<String, Object> buttonParam) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        return switch (buttonName == null ? "" : buttonName) {
            case "刷新" -> new HashMap<>();
            case "新增流程", "新增" -> save(def, formData == null ? new HashMap<>() : formData);
            case "保存", "提交", "保存新增", "保存为草稿" -> save(def, formData == null ? new HashMap<>() : formData);
            case "审核" -> audit(def, formData);
            case "弃审" -> unaudit(def, formData);
            // 审批流(照搬 light-mes:草稿→提交审批→审批中→通过/驳回;弃审全留痕)
            case "提交审批" -> submitApproval(def, formData);
            case "审批通过" -> approveApproval(def, formData);
            case "审批驳回" -> rejectApproval(def, formData);
            case "审批情况" -> approvalHistory(def, formData);
            case "删除", "删除单据" -> delete(def, formData);
            default -> throw new IllegalStateException("未定义按钮规则：" + buttonName + "（可在 ButtonService 扩展）");
        };
    }

    // ============ 保存 ============

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> save(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        Map<String, Object> body = new LinkedHashMap<>(formData == null ? Map.of() : formData);
        Object detailObj = body.remove("detail");
        Object noObj = body.remove("编号");
        body.remove("单据状态");
        body.remove("创建时间");
        body.remove("更新时间");
        body.remove("审核人");
        body.remove("审核时间");
        Map<String, Object> detail = detailObj instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : new HashMap<>();
        // 明细键 = 面板 detail.tabs[].key(基础档案为业务键,单据为 items);兜底取首个数组值
        List<Map<String, Object>> items = detail.get(def.tabKey()) instanceof List<?> tabRows
                ? new ArrayList<>((List<Map<String, Object>>) tabRows)
                : detail.get("items") instanceof List<?> l
                ? new ArrayList<>((List<Map<String, Object>>) l) : new ArrayList<>();
        if (items.isEmpty() && detail.values().stream().findFirst().map(v -> v instanceof List).orElse(false)) {
            items = new ArrayList<>((List<Map<String, Object>>) detail.values().iterator().next());
        }

        String no = noObj == null || String.valueOf(noObj).isBlank() ? null : String.valueOf(noObj);
        if (def.isDoc()) {
            return saveDoc(def, body, items, no, user);
        }
        return saveArchive(def, items, user);
    }

    /** 单据保存:头字段并入每行(单表式)或分别写头表/行表(头行式);无编号=新建 */
    private Map<String, Object> saveDoc(PanelRegistry.PanelDef def, Map<String, Object> head,
                                        List<Map<String, Object>> items, String no, String user) {
        boolean split = def.hasHeadTable();
        if (no == null) {
            if (items.isEmpty()) {
                // directAdd 语义:空表单 -> 建一张空白草稿单(头行式写头表,单表式写一行占位行)
                no = formNoService.next(def.prefix(), user);
                String table = split ? def.headTable() : def.lineTable();
                Map<String, Object> cols = new LinkedHashMap<>();
                cols.put(def.groupCol(), no);
                if (def.dateCol() != null) cols.put(def.dateCol(), LocalDate.now());
                if (!split && def.codeCol() != null) cols.put(def.codeCol(), no);
                insertRow(table, cols, user);
                return result(no, "草稿");
            }
            no = formNoService.next(def.prefix(), user);
        }
        // 已审核/审批中单据不允许保存(照搬 light-mes:仅草稿可改)
        Map<String, Object> st = docStatusOf(def.code(), no);
        if ("已审核".equals(st.get("status"))) throw new IllegalStateException("已审核单据不可保存，请先弃审");
        if ("审批中".equals(st.get("status"))) throw new IllegalStateException("审批中单据不可保存，请等待审批完成或驳回");

        Map<String, String> l2c = def.labelToCol();
        if (split) {
            upsertHeadRow(def, head, no, user);
            upsertLineRows(def, items, no, l2c, user);
        } else {
            // 单表式:头字段并入每行
            for (Map<String, Object> item : items) {
                Map<String, Object> merged = new LinkedHashMap<>(head);
                merged.putAll(item);
                item.putAll(merged);
            }
            upsertLineRows(def, items, no, l2c, user);
        }
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    /** 行表 upsert:有 id 更新,无 id 插入(回填自增 id),缺席行软删(asp_cancel='Y') */
    private void upsertLineRows(PanelRegistry.PanelDef def, List<Map<String, Object>> items,
                                String no, Map<String, String> l2c, String user) {
        Set<Object> liveIds = new HashSet<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            Map<String, Object> cols = labelsToCols(def.fields(), item);
            cols.put(def.groupCol(), no);
            if (id != null && !String.valueOf(id).isBlank()) {
                liveIds.add(id);
                updateRow(def.lineTable(), def.pkCol(), id, cols, user);
            } else {
                Object newId = insertRow(def.lineTable(), cols, user);
                if (newId != null) liveIds.add(newId);
            }
        }
        // 缺席行软删:本单中不在 liveIds 的存活行 -> asp_cancel='Y'
        softDeleteMissing(def.lineTable(), def.groupCol(), no, def.pkCol(), liveIds, user);
    }

    /** 把 group 下不在 keepIds 的存活行软删 */
    private void softDeleteMissing(String table, String groupCol, String groupVal, String pk,
                                   Set<Object> keepIds, String user) {
        StringBuilder sql = new StringBuilder("UPDATE " + table + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                + " WHERE " + groupCol + " = ? AND ISNULL(asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>(List.of(user, groupVal));
        if (!keepIds.isEmpty()) {
            sql.append(" AND ").append(pk).append(" NOT IN (")
                    .append(String.join(",", keepIds.stream().map(x -> "?").toList())).append(")");
            args.addAll(keepIds);
        }
        jdbc.update(sql.toString(), args.toArray());
    }

    /** 头表 upsert(头行式):按 group_col 定位 */
    private void upsertHeadRow(PanelRegistry.PanelDef def, Map<String, Object> head, String no, String user) {
        List<PanelRegistry.FieldDef> fields = def.fieldsAt("header");
        Map<String, Object> cols = labelsToCols(fields, head);
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.headTable() + " WHERE " + def.groupCol() + " = ?",
                Integer.class, no);
        if (existing != null && existing > 0) {
            updateRow(def.headTable(), "id", null, cols, user, def.groupCol(), no);
        } else {
            cols.put(def.groupCol(), no);
            insertRow(def.headTable(), cols, user);
        }
    }

    /** 档案保存:整份明细 upsert(插入回填自增 id),缺席行软删 */
    private Map<String, Object> saveArchive(PanelRegistry.PanelDef def, List<Map<String, Object>> items, String user) {
        Set<Object> liveIds = new HashSet<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            Map<String, Object> cols = labelsToCols(def.fields(), item);
            if (id != null && !String.valueOf(id).isBlank()) {
                liveIds.add(id);
                updateRow(def.lineTable(), def.pkCol(), id, cols, user);
            } else {
                Object newId = insertRow(def.lineTable(), cols, user);
                if (newId != null) liveIds.add(newId);
            }
        }
        // 档案缺席行 = 已删除 -> 全表软删不在 keepIds 的存活行(全部缺席时不清理,防止误清整档)
        if (!liveIds.isEmpty()) {
            StringBuilder sql = new StringBuilder("UPDATE " + def.lineTable()
                    + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE ISNULL(asp_cancel,'N')<>'Y'");
            List<Object> args = new ArrayList<>(List.of(user));
            sql.append(" AND ").append(def.pkCol()).append(" NOT IN (")
                    .append(String.join(",", liveIds.stream().map(x -> "?").toList())).append(")");
            args.addAll(liveIds);
            jdbc.update(sql.toString(), args.toArray());
        }
        return result(def.name(), "启用");
    }

    /** 标签键 -> 列名键(仅取字段定义内的列,忽略 id/__no 等保留键) */
    private Map<String, Object> labelsToCols(List<PanelRegistry.FieldDef> fields, Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (PanelRegistry.FieldDef f : fields) {
            Object v = row.get(f.label());
            if (v != null) out.put(f.col(), normalizeByType(f, v));
        }
        return out;
    }

    private static final java.util.regex.Pattern ISO_DATETIME =
            java.util.regex.Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})(?:[T ](\\d{2}:\\d{2})(?::(\\d{2}))?)?");

    /**
     * 写入值规范化:
     * - 空串 -> null
     * - 日期/日期时间字段:界面回传的 Jackson ISO-8601(2026-08-26T00:00:00.000+08:00)
     *   转为 SQL Server 可解析的 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    private Object normalizeByType(PanelRegistry.FieldDef f, Object v) {
        if (!(v instanceof String s)) return v;
        if (s.isBlank()) return null;
        String type = f.dataType() == null ? "" : f.dataType();
        if (type.contains("日期")) {
            java.util.regex.Matcher m = ISO_DATETIME.matcher(s);
            if (m.find()) {
                if (type.contains("时间") && m.group(2) != null) {
                    return m.group(1) + " " + m.group(2) + (m.group(3) != null ? ":" + m.group(3) : ":00");
                }
                return m.group(1);
            }
        }
        return s;
    }

    /** 插入并返回自增主键(无主键时返回 null) */
    private Object insertRow(String table, Map<String, Object> cols, String user) {
        if (cols.isEmpty()) return null;
        fillRequiredDefaults(table, cols);
        cols.put("asp_user1", user);
        cols.put("asp_time1", LocalDateTime.now());
        // 列名含特殊字符(%、.等)必须方括号包裹
        String names = String.join(",", cols.keySet().stream().map(c -> "[" + c + "]").toList());
        String marks = String.join(",", cols.values().stream().map(x -> "?").toList());
        String sql = "INSERT INTO " + table + " (" + names + ") VALUES (" + marks + ")";
        Object[] args = cols.values().toArray();
        org.springframework.jdbc.support.GeneratedKeyHolder kh = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            java.sql.PreparedStatement ps = con.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps;
        }, kh);
        if (!kh.getKeyList().isEmpty() && kh.getKeyList().get(0) != null) {
            for (Object v : kh.getKeyList().get(0).values()) {
                if (v instanceof Number) return v;
            }
        }
        return null;
    }

    private final Map<String, List<String[]>> requiredColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** 补齐无默认值的 NOT NULL 列(排除 IDENTITY):comm->'0',字符->'',数值->0 —— 与旧系统写入习惯一致 */
    private void fillRequiredDefaults(String table, Map<String, Object> cols) {
        List<String[]> required = requiredColsCache.computeIfAbsent(table, t -> {
            try {
                return jdbc.query(
                        "SELECT c.name, ty.name FROM sys.columns c JOIN sys.types ty ON c.user_type_id = ty.user_type_id"
                                + " WHERE c.object_id = OBJECT_ID(?) AND c.is_nullable = 0 AND c.is_identity = 0"
                                + " AND NOT EXISTS (SELECT 1 FROM sys.default_constraints dc"
                                + " WHERE dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id)",
                        (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, table);
            } catch (Exception e) {
                return List.of();
            }
        });
        for (String[] col : required) {
            if (cols.containsKey(col[0])) continue;
            String type = col[1] == null ? "" : col[1];
            Object dv = "comm".equals(col[0]) ? "0"
                    : type.contains("char") ? ""
                    : (type.contains("int") || type.contains("decimal") || type.contains("numeric")
                    || type.contains("float") || type.contains("money") || type.contains("bit")) ? 0
                    : null;
            if (dv != null) cols.put(col[0], dv);
        }
    }

    private void updateRow(String table, String pk, Object id, Map<String, Object> cols, String user) {
        updateRow(table, pk, id, cols, user, null, null);
    }

    private void updateRow(String table, String pk, Object id, Map<String, Object> cols, String user,
                           String groupCol, String groupVal) {
        if (cols.isEmpty()) return;
        cols.put("asp_user2", user);
        cols.put("asp_time2", LocalDateTime.now());
        StringBuilder set = new StringBuilder();
        List<Object> args = new ArrayList<>();
        for (Map.Entry<String, Object> e : cols.entrySet()) {
            if (set.length() > 0) set.append(", ");
            set.append("[").append(e.getKey()).append("] = ?");
            args.add(e.getValue());
        }
        StringBuilder where = new StringBuilder();
        if (id != null) {
            where.append("[").append(pk).append("] = ?");
            args.add(id);
        } else if (groupCol != null) {
            where.append("[").append(groupCol).append("] = ?");
            args.add(groupVal);
        }
        jdbc.update("UPDATE " + table + " SET " + set + " WHERE " + where, args.toArray());
    }

    // ============ 状态机(照搬 light-mes:草稿⇄已审核 + 审批流) ============

    private Map<String, Object> audit(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!def.isDoc()) throw new IllegalStateException("档案面板无审核动作");
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if ("已作废".equals(st.get("status"))) throw new IllegalStateException("已作废单据不可审核");
        if ("已审核".equals(st.get("status"))) throw new IllegalStateException("单据已是已审核状态");
        if ("审批中".equals(st.get("status"))) throw new IllegalStateException("审批中单据不可直接审核，请走审批流");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET shr = ?, shsj = GETDATE(), canceled = 'N', pending = 'N', update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, ?, GETDATE(), 'N', 'N', GETDATE());",
                def.code(), no, currentUserName(), currentUserName());
        return result(no, "已审核");
    }

    private Map<String, Object> unaudit(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"已审核".equals(st.get("status"))) throw new IllegalStateException("仅已审核状态可弃审");
        jdbc.update("UPDATE yj_doc_status SET shr = NULL, shsj = NULL, update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        recordApproval(def.code(), no, "UNAUDIT", "PENDING", opinionOf(formData));
        return result(no, "草稿");
    }

    // ---- 审批流(照搬 light-mes PxService):提交/通过/驳回全留痕,防伪校验 ----

    /** 提交审批:仅草稿 → 审批中 */
    private Map<String, Object> submitApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"草稿".equals(st.get("status"))) throw new IllegalStateException("仅草稿状态可提交审批");
        String operator = currentUserName();
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET pending = 'Y', pending_by = ?, pending_at = GETDATE(), shr = NULL, shsj = NULL, canceled = 'N', update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, pending, pending_by, pending_at, canceled, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), 'N', GETDATE());",
                def.code(), no, operator, operator);
        recordApproval(def.code(), no, "SUBMIT", "PENDING", opinionOf(formData));
        return result(no, "审批中");
    }

    /** 审批通过:仅审批中 → 已审核(需管理员/审批权限;审核人=当前登录人) */
    private Map<String, Object> approveApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"审批中".equals(st.get("status"))) throw new IllegalStateException("仅审批中状态可审批通过");
        requirePendingSubmission(def.code(), no);
        requireApprover();
        String operator = currentUserName();
        String opinion = opinionOf(formData);
        jdbc.update("UPDATE yj_doc_status SET pending = 'N', shr = ?, shsj = GETDATE(), update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", operator, def.code(), no);
        recordApproval(def.code(), no, "APPROVE", "APPROVED", opinion);
        return result(no, "已审核");
    }

    /** 审批驳回:仅审批中 → 草稿(意见必填,驳回后修改可重新提交) */
    private Map<String, Object> rejectApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"审批中".equals(st.get("status"))) throw new IllegalStateException("仅审批中状态可审批驳回");
        requirePendingSubmission(def.code(), no);
        requireApprover();
        String opinion = opinionOf(formData);
        if (opinion.isEmpty()) throw new IllegalStateException("审批驳回必须填写审批意见");
        jdbc.update("UPDATE yj_doc_status SET pending = 'N', update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        recordApproval(def.code(), no, "REJECT", "REJECTED", opinion);
        return result(no, "草稿");
    }

    /** 审批情况:返回该单据全部审批记录(时间升序) */
    private Map<String, Object> approvalHistory(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("list", queryApprovalHistory(def.code(), no));
        return out;
    }

    /** 审批通过/驳回必须紧跟一次有效提交,防止仅改状态后伪造审批结果(light-mes requirePendingSubmission) */
    private void requirePendingSubmission(String panelCode, String formNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 action, result FROM yj_form_approval WHERE panel_code = ? AND form_no = ? ORDER BY id DESC",
                panelCode, formNo);
        if (rows.isEmpty() || !"SUBMIT".equals(rows.get(0).get("action"))
                || !"PENDING".equals(rows.get(0).get("result"))) {
            throw new IllegalStateException("单据尚未提交审批，不能审批通过或驳回");
        }
    }

    /** 审批权限:YINJIA 以 yj_user.is_admin 承载(light-mes 为角色 can_approve) */
    private void requireApprover() {
        String user = currentUserName();
        List<String> admins = jdbc.query(
                "SELECT username FROM yj_user WHERE username = ? AND is_admin = 'Y'",
                (rs, i) -> rs.getString(1), user);
        if (admins.isEmpty()) throw new org.springframework.security.access.AccessDeniedException("当前用户无审批权限");
    }

    private void recordApproval(String panelCode, String formNo, String action, String result, String opinion) {
        jdbc.update("INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time) "
                        + "VALUES (?,?,?,?,1,?,?,SYSDATETIME())",
                panelCode, formNo, action, result, currentUserName(),
                opinion == null || opinion.isEmpty() ? null : opinion);
    }

    private String opinionOf(Map<String, Object> formData) {
        Object v = formData == null ? null : formData.get("审批意见");
        return v == null ? "" : String.valueOf(v).trim();
    }

    public List<Map<String, Object>> queryApprovalHistory(String panelCode, String formNo) {
        return jdbc.query("SELECT action, result, node_no, operator, opinion, create_time FROM yj_form_approval"
                        + " WHERE panel_code = ? AND form_no = ? ORDER BY id ASC",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("action", rs.getString("action"));
                    m.put("result", rs.getString("result"));
                    m.put("operator", rs.getString("operator"));
                    m.put("opinion", rs.getString("opinion"));
                    m.put("nodeNo", rs.getInt("node_no"));
                    m.put("createTime", rs.getTimestamp("create_time") == null ? ""
                            : rs.getTimestamp("create_time").toLocalDateTime()
                            .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                    return m;
                }, panelCode, formNo);
    }

    /** 删除:单据=作废(仅草稿可删,对齐 light-mes);档案=当前行软删 */
    private Map<String, Object> delete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (def.isDoc()) {
            String no = requireNo(formData);
            Map<String, Object> st = docStatusOf(def.code(), no);
            if (!"草稿".equals(st.get("status"))) throw new IllegalStateException("仅草稿状态可删除（已审核请先弃审）");
            jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                            + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                            + "WHEN MATCHED THEN UPDATE SET canceled = 'Y', cancel_by = ?, cancel_at = GETDATE(), update_at = GETDATE() "
                            + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, cancel_by, cancel_at, update_at) "
                            + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                    def.code(), no, user, user);
            return result(no, "已作废");
        }
        Object no = formData.get("编号");
        if (no != null && !String.valueOf(no).isBlank()) {
            jdbc.update("UPDATE " + def.lineTable() + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                    + " WHERE " + def.codeCol() + " = ?", user, no);
        }
        return result(String.valueOf(no), "已作废");
    }

    public void deleteForms(String panelCode, List<String> rowCodes) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        for (String code : rowCodes) {
            Map<String, Object> fd = new HashMap<>();
            fd.put("编号", code);
            delete(def, fd);
        }
    }

    // ============ 工具 ============

    private String requireNo(Map<String, Object> formData) {
        Object no = formData == null ? null : formData.get("编号");
        if (no == null || String.valueOf(no).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        return String.valueOf(no);
    }

    private void ensureDocExists(PanelRegistry.PanelDef def, String no) {
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, no);
        if (c == null || c == 0) throw new IllegalArgumentException("表单数据不存在：" + no);
    }

    /** 状态推导:已作废 > 已审核(shr) > 审批中(pending) > 草稿 */
    private Map<String, Object> docStatusOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT shr, canceled, pending, pending_by, pending_at FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                panelCode, no);
        Map<String, Object> out = new HashMap<>();
        Map<String, Object> r = rows.isEmpty() ? null : rows.get(0);
        if (r == null) {
            out.put("status", "草稿");
        } else if ("Y".equals(r.get("canceled"))) {
            out.put("status", "已作废");
        } else if (r.get("shr") != null) {
            out.put("status", "已审核");
        } else if ("Y".equals(r.get("pending"))) {
            out.put("status", "审批中");
        } else {
            out.put("status", "草稿");
        }
        if (r != null) out.put("row", r);
        return out;
    }

    private Map<String, Object> result(String no, String status) {
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("单据状态", status);
        return out;
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
