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
        result.put("todo", todos().size());
        result.put("message", messages().size());
        result.put("alarm", alarms().size());
        return result;
    }

    public List<Map<String, Object>> list(String userName, String type) {
        return switch (type == null ? "" : type) {
            case "todo" -> todos();
            case "message" -> messages();
            case "alarm" -> alarms();
            default -> List.of();
        };
    }

    /** 待办:审批中单据(照搬 light-mes 语义,数据源 yj_doc_status.pending) */
    private List<Map<String, Object>> todos() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP " + LIST_LIMIT + " panel_code, doc_no, pending_by, pending_at, update_at"
                        + " FROM yj_doc_status WHERE ISNULL(pending,'N') = 'Y' AND ISNULL(canceled,'N') <> 'Y'"
                        + " ORDER BY update_at DESC");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String panelCode = String.valueOf(row.get("panel_code"));
            String docNo = String.valueOf(row.get("doc_no"));
            String panelName = panelName(panelCode);
            Timestamp time = (Timestamp) row.get("update_at");
            String submitter = row.get("pending_by") == null ? "未知账号" : String.valueOf(row.get("pending_by"));
            Map<String, Object> item = base("todo:" + panelCode + ':' + docNo, "todo",
                    panelName + " " + docNo + " 待审批", time,
                    "提交人「" + submitter + "」已提交" + panelName + " " + docNo + ",等待当前账号审批。",
                    panelCode, docNo);
            item.put("submitter", submitter);
            item.put("actionLabel", "去审批");
            result.add(item);
        }
        return result;
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

    /** 预警:kucun 结余低于阈值的物料库存 */
    private List<Map<String, Object>> alarms() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP " + LIST_LIMIT + " wzdm, ckdm, lot_no, yl FROM kucun"
                        + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND yl IS NOT NULL AND yl < ?"
                        + " ORDER BY yl", LOW_STOCK_THRESHOLD);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String code = text(row.get("wzdm"), "-");
            String warehouse = text(row.get("ckdm"), "未指定仓库");
            Map<String, Object> item = base("alarm:" + warehouse + ':' + code + ':' + text(row.get("lot_no"), ""),
                    "alarm", "低库存:" + code + "(" + warehouse + ")", null,
                    "库存台账显示「" + code + "」在「" + warehouse + "」的结余为 "
                            + row.get("yl") + ",低于预警阈值 " + LOW_STOCK_THRESHOLD + "。",
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
