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
    /** 消息码:审批通过 → **单据上的检验人**(2026-11-11 用户口径「审批通过和驳回也要有消息提示对应的检验人」) */
    public static final String APPROVAL_APPROVED_INSPECTOR = "APPROVAL_APPROVED_INSPECTOR";
    /** 消息码:审批驳回 → **单据上的检验人**(同上) */
    public static final String APPROVAL_REJECTED_INSPECTOR = "APPROVAL_REJECTED_INSPECTOR";
    /** 消息码:申请修改 → 管理员 */
    public static final String MODIFY_REQUESTED = "MODIFY_REQUESTED";
    /** 消息码:申请删除 → 管理员 */
    public static final String DELETE_REQUESTED = "DELETE_REQUESTED";
    /** 消息码:规格书检验项目及标准已改 → 关联出货检验计划表的经办人+管理员(核对一致性提醒) */
    public static final String SPEC_ITEMS_CHANGED = "SPEC_ITEMS_CHANGED";
    /** 消息码:产品信息表申请修改 / 被弃审(会变质)→ 引用它的四文件责任人(核对数据提醒,2026-10-16 用户口径) */
    public static final String PRODINFO_CHANGED = "PRODINFO_CHANGED";
    /** 消息码:项目实施计划申请终止 → 立项人(一级审批) */
    public static final String TERM_REQUESTED = "TERM_REQUESTED";
    /** 消息码:立项人已同意终止 → 管理员(二级审批) */
    public static final String TERM_TO_ADMIN = "TERM_TO_ADMIN";
    /** 消息码:终止已落实(管理员同意) → 申请人 */
    public static final String TERM_APPROVED = "TERM_APPROVED";
    /** 消息码:终止被驳回(任一级) → 申请人 */
    public static final String TERM_REJECTED = "TERM_REJECTED";
    /** 消息码:删除申请已同意(单据作废) → 删除申请人(2026-09-12 补齐,审批结果此前无通知) */
    public static final String DELETE_APPROVED = "DELETE_APPROVED";
    /** 消息码:删除申请被驳回 → 删除申请人(2026-09-12 补齐) */
    public static final String DELETE_REJECTED = "DELETE_REJECTED";
    /** 消息码:修改申请已同意(进入修改中) → 修改申请人(2026-09-12 补齐) */
    public static final String MODIFY_APPROVED = "MODIFY_APPROVED";
    /** 消息码:修改申请被驳回 → 修改申请人(2026-09-12 补齐) */
    public static final String MODIFY_REJECTED = "MODIFY_REJECTED";
    /** 消息码:产品开发已下发 → 总负责人(请用「规格书分发」安排规格书编写) */
    public static final String SPEC_DISPATCHED = "SPEC_DISPATCHED";
    /** 消息码:规格书已分发 → 责任人(填写并保存) */
    public static final String SPEC_ASSIGNED = "SPEC_ASSIGNED";
    /** 消息码:一级通过并选定二级审核人 → 被选人(2026-09-20 两级审批) */
    public static final String APPROVAL_L2_ASSIGNED = "APPROVAL_L2_ASSIGNED";
    /** 消息码:一级审核通过、待超级管理员批准 → 超级管理员(2026-10-04 特采单两级审批) */
    public static final String APPROVAL_L2_PENDING = "APPROVAL_L2_PENDING";
    /** 消息码:超级管理员已批准 → 一级审核人(2026-10-04 特采单) */
    public static final String APPROVAL_L2_DONE = "APPROVAL_L2_DONE";
    /** 消息码:二级审批(批准)被驳回 → 一级审核人(2026-10-04 特采单) */
    public static final String APPROVAL_L2_REJECTED = "APPROVAL_L2_REJECTED";
    /** 消息码:产品开发已分发责任人 → 四个下游文件的责任人(2026-09-20 分发责任人) */
    public static final String TASK_ASSIGNED = "TASK_ASSIGNED";
    /** 消息码:立项申请定级后已分发对接人 → 被选中的对接人(2026-10-08 研发流程图③) */
    public static final String LIAISON_ASSIGNED = "LIAISON_ASSIGNED";
    /** 消息码:对接人签核并确认项目责任人 → 被确认的项目责任人(2026-10-08 研发流程图④) */
    public static final String OWNER_CONFIRMED = "OWNER_CONFIRMED";
    /** 消息码:产品变更申请单提交会签 → 各会签人(2026-09-21 变更线上流程④) */
    public static final String SIGNOFF_REQUESTED = "SIGNOFF_REQUESTED";
    /** 消息码:会签全部通过、已自动转审批 → 发起人 */
    public static final String SIGNOFF_PASSED = "SIGNOFF_PASSED";
    /** 消息码:会签被驳回 → 发起人(回草稿) */
    public static final String SIGNOFF_REJECTED = "SIGNOFF_REJECTED";
    /** 消息码:变更已生效、本文件已生成下一版草稿 → 该文件责任人 */
    public static final String CHANGE_EFFECTIVE = "CHANGE_EFFECTIVE";
    /** 消息码:变更单审批被驳回 → 发起人与已填写部门(2026-09-21 变更线上流程⑤) */
    public static final String CHANGE_REJECTED = "CHANGE_REJECTED";

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

    /**
     * 单据上的「检验人 / 检验员」列 → 账号(2026-11-11 用户口径:
     * 「审批通过和驳回也要有消息提示对应的检验人」)。
     *
     * <p>为什么不能直接用 {@link #authorOf}:制单人 = 建这张单的账号,
     * 而纸面上的「检验人/检验员」是**这一单实际做检验的人**(检验单由自动生单建出来时,
     * 建单人往往是系统/别人,检验人另有人在)—— 审批结果要落在真正干活的人手上。
     *
     * <p>列名各表不同(检验报告=检验人;首件/制程/组装成品/出厂报告=检验员),
     * 按表里实际存在的列顺序取第一个非空的。表里没有这类列 ⇒ 返回空串(调用方按"没这个人"处理)。
     */
    public String inspectorOf(String headTable, String docNo) {
        try {
            List<String> cols = jdbc.queryForList(
                    "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name IN (N'检验人', N'检验员', N'检测人', N'化验人')",
                    String.class, headTable);
            if (cols.isEmpty()) return "";
            // 固定优先级:检验人 > 检验员 > 检测人 > 化验人(同表既有检验人又有检验员时以检验人为准)
            List<String> order = List.of("检验人", "检验员", "检测人", "化验人");
            for (String want : order) {
                if (!cols.contains(want)) continue;
                List<String> vals = jdbc.queryForList(
                        "SELECT TOP 1 [" + want + "] FROM " + headTable
                                + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                        String.class, docNo);
                String v = vals.isEmpty() || vals.get(0) == null ? "" : String.valueOf(vals.get(0)).trim();
                if (!v.isEmpty()) return v;
            }
            return "";
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
        List<String> configured = approvalNotifyTargets(panelCode);
        List<String> targets = (configured.isEmpty() ? approversOf(panelCode) : configured)
                .stream().filter((a) -> !a.equals(actor)).toList();
        return send(targets, code, panelCode, docNo, params, actor);
    }

    /**
     * 面板级「待审批通知只发给谁」(2026-11-11 用户口径:「如果我只想这个数据记录通知 fm 要怎么才能做到」)。
     *
     * <p>配置位置 = {@code yj_panel.config} 的 JSON 键 {@code approvalNotify},值是账号数组:
     * <pre>{"approvalNotify":["fm"]}</pre>
     * 配了它,该面板的「提交审批」消息**只发给这些人**(管理员也不再自动带),审批权本身不受影响 ——
     * 「谁能审批」仍由 {@code yj_role_panel.can_approve} 决定,两者刻意分开:很多场景是
     * 「多人都能审,但只在某个人的消息里提醒」。
     *
     * <p>没配(或配成空数组/解析失败)⇒ 维持原口径:管理员 ∪ 该面板所有 can_approve 角色的账号。
     *
     * @return 配置的账号列表;未配置返回空列表(调用方据此判断走哪条口径)
     */
    public List<String> approvalNotifyTargets(String panelCode) {
        try {
            String raw = registry.panel(panelCode).config();
            if (raw == null || !raw.contains("approvalNotify")) return List.of();
            com.fasterxml.jackson.databind.JsonNode node =
                    JSON.readTree(raw).path("approvalNotify");
            if (!node.isArray()) return List.of();
            List<String> out = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode n : node) {
                String u = n.asText("").trim();
                if (!u.isEmpty()) out.add(u);
            }
            return out;
        } catch (Exception e) {
            log.warn("approvalNotify 解析失败(按未配置处理): panel={} err={}", panelCode, e.getMessage());
            return List.of();
        }
    }

    /**
     * 纸面「检验人/检验员」格里的值 → 收件账号(2026-11-11)。
     *
     * <p>⚠ 这一格在库里**两种写法都有**(历史遗留):有的单写账号({@code admin}),
     * 有的单写姓名({@code 系统管理员}/{@code 钟芳云},新增时按登录人 real_name 写入)
     * ⇒ 一律先按 username 精确匹配,匹配不到再按 real_name 匹配(重名就都发,通常只有一个人)。
     */
    public List<String> accountsOf(String who) {
        if (who == null || who.isBlank()) return List.of();
        String w = who.trim();
        try {
            List<String> byName = jdbc.queryForList(
                    "SELECT username FROM yj_user WHERE username = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    String.class, w);
            if (!byName.isEmpty()) return byName;
            return jdbc.queryForList(
                    "SELECT username FROM yj_user WHERE real_name = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    String.class, w);
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 单据上的「检验人/检验员」格 → 收件账号列表(见 {@link #inspectorOf} 与 {@link #accountsOf}) */
    public List<String> inspectorAccounts(String headTable, String docNo) {
        return accountsOf(inspectorOf(headTable, docNo));
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
            // 时间列转 LocalDateTime 再出:JdbcTemplate 给的是 java.sql.Timestamp,Jackson 会按 UTC
            // 序列化成 "...Z"/带偏移的串 ⇒ 前端 slice 出来比本地时间**早 8 小时**
            // (2026-11-11 实测:库里 11:37:53 的消息在弹层显示 03:37:53)。LocalDateTime 没有时区,
            // 序列化就是库里那份"墙上时间",与页面其它时间口径一致。
            for (String k : List.of("创建时间", "读取时间")) {
                if (m.get(k) instanceof java.sql.Timestamp ts) m.put(k, ts.toLocalDateTime());
            }
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
