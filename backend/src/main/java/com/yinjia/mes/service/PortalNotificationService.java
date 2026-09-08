package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 门户通知(移植自 light-mes 的三分类结构,数据源换成 HSDZ_MES):
 * - todo:未审核单据(yj_doc_status 有留痕但未审核)
 * - message:系统操作日志(s_log 最近记录)
 * - alarm:低库存预警(kucun 结余低于阈值)
 */
@Service
public class PortalNotificationService {

    static final BigDecimal LOW_STOCK_THRESHOLD = new BigDecimal("100");
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int LIST_LIMIT = 100;

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    public PortalNotificationService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    public Map<String, Integer> badge(String userName) {
        Map<String, Integer> result = new LinkedHashMap<>();
        result.put("todo", todos(userName).size());
        result.put("message", messages().size());
        result.put("alarm", alarms().size());
        return result;
    }

    public List<Map<String, Object>> list(String userName, String type) {
        return switch (type == null ? "" : type) {
            case "todo" -> todos(userName);
            case "message" -> messages();
            case "alarm" -> alarms();
            default -> List.of();
        };
    }

    /** 待办:当前账号有权审批的面板上的待审单据(审批中/修改申请中/删除申请中),按审批权限过滤 */
    private List<Map<String, Object>> todos(String userName) {
        List<String> panels = approverPanels(userName);
        if (panels.isEmpty()) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        appendTodos(result, "pending", "待审批", "已提交", panels);
        appendTodos(result, "modify", "待修改审批", "已申请修改", panels);
        appendTodos(result, "delete", "待删除审批", "已申请删除", panels);
        return result;
    }

    /** 按状态拼接待办(panels=["*"] 表示管理员不过滤) */
    private void appendTodos(List<Map<String, Object>> out, String kind, String label, String verb, List<String> panels) {
        String cond;
        String by;
        switch (kind) {
            case "modify" -> { cond = "ISNULL(modify_state,'') = 'R'"; by = "modify_req_by"; }
            case "delete" -> { cond = "ISNULL(deleting,'N') = 'Y'"; by = "delete_req_by"; }
            default -> { cond = "ISNULL(pending,'N') = 'Y'"; by = "pending_by"; }
        }
        StringBuilder sql = new StringBuilder(
                "SELECT TOP " + LIST_LIMIT + " panel_code, doc_no, " + by + " AS req_by, update_at"
                        + " FROM yj_doc_status WHERE " + cond + " AND ISNULL(canceled,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        if (!panels.contains("*")) {
            sql.append(" AND panel_code IN (")
                    .append(String.join(",", panels.stream().map(p -> "?").toList())).append(")");
            args.addAll(panels);
        }
        sql.append(" ORDER BY update_at DESC");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        for (Map<String, Object> row : rows) {
            String panelCode = String.valueOf(row.get("panel_code"));
            String docNo = String.valueOf(row.get("doc_no"));
            String panelName = panelName(panelCode);
            Timestamp time = (Timestamp) row.get("update_at");
            String submitter = row.get("req_by") == null ? "未知账号" : String.valueOf(row.get("req_by"));
            Map<String, Object> item = base("todo:" + kind + ':' + panelCode + ':' + docNo, "todo",
                    panelName + " " + docNo + " " + label, time,
                    "提交人「" + submitter + "」" + verb + panelName + " " + docNo + ",等待当前账号审批。",
                    panelCode, docNo);
            item.put("submitter", submitter);
            item.put("actionLabel", "去审批");
            out.add(item);
        }
    }

    /** 审批权限面板:管理员=全部("*");普通用户=角色勾了审批的面板(can_approve='Y') */
    private List<String> approverPanels(String userName) {
        List<Integer> admin = jdbc.query(
                "SELECT CASE WHEN is_admin = 'Y' THEN 1 ELSE 0 END FROM yj_user WHERE username = ?",
                (rs, i) -> rs.getInt(1), userName);
        if (!admin.isEmpty() && admin.get(0) == 1) return List.of("*");
        return jdbc.query(
                "SELECT rp.panel_code FROM yj_role_panel rp JOIN yj_user u ON u.role_id = rp.role_id"
                        + " WHERE u.username = ? AND rp.can_approve = 'Y'",
                (rs, i) -> rs.getString(1), userName);
    }

    /** 消息:HSDZ_MES 操作日志(s_log)最近记录 */
    private List<Map<String, Object>> messages() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP " + LIST_LIMIT + " ID, USERID, RQ, MODULENA, GN, REMARK, COMM"
                        + " FROM s_log ORDER BY ID DESC");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String module = text(row.get("MODULENA"), "系统");
            String gn = text(row.get("GN"), "");
            String remark = text(row.get("REMARK"), "");
            String comm = text(row.get("COMM"), "");
            Timestamp time = (Timestamp) row.get("RQ");
            Map<String, Object> item = base("message:" + row.get("ID"), "message",
                    module + (gn.isBlank() ? "" : " · " + gn), time,
                    (comm.isBlank() ? "" : comm + " ") + "用户 " + text(row.get("USERID"), "-")
                            + (gn.isBlank() ? "" : " " + gn) + (remark.isBlank() ? "" : "(" + remark + ")"),
                    null, null);
            item.put("read", true);
            result.add(item);
        }
        return result;
    }

    /** 预警:kucun 结余低于预警阈值 —— 行级预警数量优先(ISNULL(NULLIF(预警数量,0),100)),未设回退全局阈值 */
    private List<Map<String, Object>> alarms() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP " + LIST_LIMIT + " wzdm, ckdm, lot_no, yl, ISNULL(NULLIF([预警数量],0),100) AS thr FROM kucun"
                        + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND yl IS NOT NULL"
                        + " AND yl < ISNULL(NULLIF([预警数量],0),100)"
                        + " ORDER BY yl");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String code = text(row.get("wzdm"), "-");
            String warehouse = text(row.get("ckdm"), "未指定仓库");
            Map<String, Object> item = base("alarm:" + warehouse + ':' + code + ':' + text(row.get("lot_no"), ""),
                    "alarm", "低库存:" + code + "(" + warehouse + ")", null,
                    "库存台账显示「" + code + "」在「" + warehouse + "」的结余为 "
                            + row.get("yl") + ",低于预警阈值 " + row.get("thr") + "。",
                    "STOCK_STATUS", null);
            item.put("warehouse", warehouse);
            item.put("inventoryCode", code);
            item.put("quantity", row.get("yl"));
            item.put("threshold", LOW_STOCK_THRESHOLD);
            item.put("actionLabel", "查看库存");
            result.add(item);
        }
        return result;
    }

    private Map<String, Object> base(String id, String type, String title, Timestamp time,
                                     String content, String panelCode, String formNo) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("type", type);
        item.put("title", title);
        item.put("time", time == null ? java.time.LocalDateTime.now().format(TIME_FORMAT)
                : time.toLocalDateTime().format(TIME_FORMAT));
        item.put("read", true);
        item.put("content", content);
        item.put("panelCode", panelCode);
        item.put("formNo", formNo);
        item.put("targetPath", panelCode == null ? "" : "/panelx/list/" + panelCode);
        return item;
    }

    private String panelName(String panelCode) {
        try {
            return registry.panel(panelCode).name();
        } catch (Exception e) {
            return panelCode;
        }
    }

    private String text(Object value, String fallback) {
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value);
    }
}
