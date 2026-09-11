package com.yinjia.mes.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 业务事件消息(2026-09-09)。
 *
 * 与「待办/预警/产品开发」的实时视图区分:那些是"当前还没处理的事",做完即消失;
 * 本服务是**事件留痕**——发生过的流转通知,可已读、可追溯。
 *
 * 约定:
 * - 收件人在发送时**展开成具体账号**(每人一行),已读按人记录;后续角色/权限变化不影响已发出的消息
 * - 正文不存中文,存「消息码 + 参数 JSON」,前端按 i18n 渲染(切语言消息跟着变)
 * - 发送失败**不影响业务操作**(内部吞异常并记日志)
 */
@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** 消息码:提交审批 → 待审批人 */
    public static final String APPROVAL_SUBMITTED = "APPROVAL_SUBMITTED";
    /** 消息码:审批通过 → 制单人 */
    public static final String APPROVAL_APPROVED = "APPROVAL_APPROVED";
    /** 消息码:审批驳回 → 制单人 */
    public static final String APPROVAL_REJECTED = "APPROVAL_REJECTED";
    /** 消息码:申请修改 → 管理员 */
    public static final String MODIFY_REQUESTED = "MODIFY_REQUESTED";
    /** 消息码:申请删除 → 管理员 */
    public static final String DELETE_REQUESTED = "DELETE_REQUESTED";
    /** 消息码:规格书检验项目及标准已改 → 关联出货检验计划表的经办人+管理员(核对一致性提醒) */
    public static final String SPEC_ITEMS_CHANGED = "SPEC_ITEMS_CHANGED";
    /** 消息码:项目实施计划申请终止 → 立项人(一级审批) */
    public static final String TERM_REQUESTED = "TERM_REQUESTED";
    /** 消息码:立项人已同意终止 → 管理员(二级审批) */
    public static final String TERM_TO_ADMIN = "TERM_TO_ADMIN";
    /** 消息码:终止已落实(管理员同意) → 申请人 */
    public static final String TERM_APPROVED = "TERM_APPROVED";
    /** 消息码:终止被驳回(任一级) → 申请人 */
    public static final String TERM_REJECTED = "TERM_REJECTED";

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    public MessageService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    /** 面板显示名(供消息参数用;前端按面板译名再翻译一次) */
    private String panelNameOf(String panelCode) {
        try {
            return registry.panel(panelCode).name();
        } catch (Exception e) {
            return panelCode == null ? "" : panelCode;
        }
    }

    // ==================== 收件人解析 ====================

    /** 该面板的审批人:管理员 + 角色勾了 can_approve 的账号 */
    public List<String> approversOf(String panelCode) {
        Set<String> out = new LinkedHashSet<>(admins());
        out.addAll(jdbc.queryForList(
                "SELECT DISTINCT u.username FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE rp.panel_code = ? AND rp.can_approve = 'Y'",
                String.class, panelCode));
        return new ArrayList<>(out);
    }

    /** 全部管理员账号 */
    public List<String> admins() {
        return jdbc.queryForList("SELECT username FROM yj_user WHERE is_admin = 'Y'", String.class);
    }

    /** 单据制单人(头表创建人 asp_user1);查不到返回空 */
    public String authorOf(String headTable, String docNo) {
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT TOP 1 asp_user1 FROM " + headTable + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    String.class, docNo);
            return rows.isEmpty() ? "" : String.valueOf(rows.get(0));
        } catch (Exception e) {
            return "";
        }
    }

    // ==================== 发送 ====================

    /** 发送消息(展开收件人;失败不影响调用方) */
    public int send(List<String> recipients, String code, String panelCode, String docNo,
                    Map<String, Object> params, String actor) {
        if (recipients == null || recipients.isEmpty() || code == null || code.isBlank()) return 0;
        String json = "";
        try {
            Map<String, Object> all = new LinkedHashMap<>();
            if (params != null) all.putAll(params);
            if (panelCode != null && !panelCode.isBlank()) all.putIfAbsent("panelName", panelNameOf(panelCode));
            if (docNo != null) all.putIfAbsent("docNo", docNo);
            if (!all.isEmpty()) json = JSON.writeValueAsString(all);
        } catch (Exception e) {
            json = "";
        }
        int n = 0;
        LocalDateTime now = LocalDateTime.now();
        Set<String> unique = new LinkedHashSet<>();
        for (String r : recipients) {
            if (r != null && !r.isBlank()) unique.add(r.trim());
        }
        for (String receiver : unique) {
            try {
                jdbc.update("INSERT INTO yj_message (收件人,消息码,参数,面板编码,单据编号,已读,创建时间,asp_user1,asp_time1) "
                                + "VALUES (?,?,?,?,?, 'N', ?,?,?)",
                        receiver, code, json.isEmpty() ? null : json, panelCode, docNo, now, actor, now);
                n++;
            } catch (Exception e) {
                log.warn("message-send failed: receiver={} code={} doc={} err={}", receiver, code, docNo, e.getMessage());
            }
        }
        return n;
    }

    /** 便捷:按面板审批人发送(排除操作者自己) */
    public int sendToApprovers(String panelCode, String code, String docNo, Map<String, Object> params, String actor) {
        List<String> targets = approversOf(panelCode).stream().filter((a) -> !a.equals(actor)).toList();
        return send(targets, code, panelCode, docNo, params, actor);
    }

    /** 便捷:发给制单人(排除操作者自己) */
    public int sendToAuthor(String headTable, String panelCode, String docNo, String code,
                            Map<String, Object> params, String actor) {
        String author = authorOf(headTable, docNo);
        if (author.isBlank() || author.equals(actor)) return 0;
        return send(List.of(author), code, panelCode, docNo, params, actor);
    }

    /** 便捷:发给全部管理员(排除操作者自己) */
    public int sendToAdmins(String panelCode, String docNo, String code, Map<String, Object> params, String actor) {
        List<String> targets = admins().stream().filter((a) -> !a.equals(actor)).toList();
        return send(targets, code, panelCode, docNo, params, actor);
    }

    // ==================== 查询与已读 ====================

    /** 未读数 */
    public int unreadCount(String user) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_message WHERE 收件人 = ? AND 已读 = 'N' AND ISNULL(asp_cancel,'N') <> 'Y'",
                Integer.class, user);
        return n == null ? 0 : n;
    }

    /** 消息列表(未读优先,再按时间倒序) */
    public List<Map<String, Object>> list(String user, boolean onlyUnread, int limit) {
        String sql = "SELECT TOP " + Math.max(1, Math.min(limit, 500))
                + " id, 消息码, 参数, 面板编码, 单据编号, 已读, 读取时间, 创建时间, asp_user1"
                + " FROM yj_message WHERE 收件人 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                + (onlyUnread ? " AND 已读 = 'N'" : "")
                + " ORDER BY CASE WHEN 已读 = 'N' THEN 0 ELSE 1 END, 创建时间 DESC";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, user);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("params", parseParams(r.get("参数")));
            m.remove("参数");
            out.add(m);
        }
        return out;
    }

    /** 标记单条已读(仅本人的消息) */
    public int markRead(String user, long id) {
        return jdbc.update("UPDATE yj_message SET 已读 = 'Y', 读取时间 = SYSDATETIME(), asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE id = ? AND 收件人 = ? AND 已读 = 'N'", user, id, user);
    }

    /** 全部已读 */
    public int markAllRead(String user) {
        return jdbc.update("UPDATE yj_message SET 已读 = 'Y', 读取时间 = SYSDATETIME(), asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE 收件人 = ? AND 已读 = 'N'", user, user);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseParams(Object raw) {
        if (raw == null) return Map.of();
        try {
            return JSON.readValue(String.valueOf(raw), Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }
}
