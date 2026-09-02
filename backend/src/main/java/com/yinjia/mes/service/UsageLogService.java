package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 使用记录服务(CONTEXT.md「使用权限查看」决策):
 * - 登录成功 + 面板业务动作(按钮/删除)统一写入 yj_usage_log,event_type 区分 login/action;
 * - 查询/刷新/表格调整等纯浏览动作不记录;
 * - 写入失败静默(日志是旁路事实,不影响业务主流程);
 * - 查询接口仅管理员可调(调用方校验 is_admin)。
 */
@Service
public class UsageLogService {

    private final JdbcTemplate jdbc;

    public UsageLogService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 登录成功事件。 */
    public void recordLogin(String userName, String realName, String ip) {
        insert("login", userName, realName, null, "登录", null, ip);
    }

    /** 面板业务动作(buttonName 为按钮中文名;docNo 为单据号,取不到传 null)。 */
    public void recordAction(String userName, String realName, String panelName, String actionName, String docNo, String ip) {
        insert("action", userName, realName, panelName, actionName, docNo, ip);
    }

    private void insert(String eventType, String userName, String realName, String panelName,
                        String actionName, String docNo, String ip) {
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no, ip) "
                            + "VALUES (?,?,?,?,?,?,?)",
                    userName, realName, eventType, panelName, actionName, docNo, ip);
        } catch (Exception e) {
            // 记录失败不影响业务
        }
    }

    /** 分页查询(时间倒序);各条件为空即不过滤。 */
    public Map<String, Object> query(String userName, String panelName, String actionName,
                                     String start, String end, int page, int size) {
        StringBuilder cond = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (notBlank(userName)) { cond.append(" AND user_name LIKE ?"); args.add("%" + userName + "%"); }
        if (notBlank(panelName)) { cond.append(" AND panel_name LIKE ?"); args.add("%" + panelName + "%"); }
        if (notBlank(actionName)) { cond.append(" AND action_name LIKE ?"); args.add("%" + actionName + "%"); }
        if (notBlank(start)) { cond.append(" AND created_at >= ?"); args.add(start); }
        if (notBlank(end)) { cond.append(" AND created_at <= ?"); args.add(end + " 23:59:59"); }

        int total = jdbc.queryForObject("SELECT COUNT(*) FROM yj_usage_log" + cond, Integer.class, args.toArray());
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP " + size + " * FROM ("
                        + "SELECT ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS rn, "
                        + "id, user_name AS userName, real_name AS realName, event_type AS eventType, "
                        + "panel_name AS panelName, action_name AS actionName, doc_no AS docNo, ip, created_at AS createdAt "
                        + "FROM yj_usage_log" + cond
                        + ") t WHERE t.rn > " + (page - 1) * size,
                args.toArray());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("total", total);
        out.put("page", page);
        out.put("size", size);
        return out;
    }

    /** 按账号分组查询(admin):返回 groups=[{userName, realName, total, rows:[...]}],
     *  rows 时间倒序,组序=各组最新一条的倒序(账号活跃度在前);上限 2000 条。 */
    public Map<String, Object> queryGrouped(String userName, String panelName, String actionName,
                                            String start, String end) {
        StringBuilder cond = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (notBlank(userName)) { cond.append(" AND user_name LIKE ?"); args.add("%" + userName + "%"); }
        if (notBlank(panelName)) { cond.append(" AND panel_name LIKE ?"); args.add("%" + panelName + "%"); }
        if (notBlank(actionName)) { cond.append(" AND action_name LIKE ?"); args.add("%" + actionName + "%"); }
        if (notBlank(start)) { cond.append(" AND created_at >= ?"); args.add(start); }
        if (notBlank(end)) { cond.append(" AND created_at <= ?"); args.add(end + " 23:59:59"); }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 2000 id, user_name AS userName, real_name AS realName, event_type AS eventType, "
                        + "panel_name AS panelName, action_name AS actionName, doc_no AS docNo, ip, created_at AS createdAt "
                        + "FROM yj_usage_log" + cond + " ORDER BY created_at DESC, id DESC",
                args.toArray());

        Map<String, Map<String, Object>> groupMap = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            String u = String.valueOf(r.get("userName"));
            Map<String, Object> g = groupMap.get(u);
            if (g == null) {
                g = new LinkedHashMap<>();
                g.put("userName", u);
                g.put("realName", String.valueOf(r.get("realName")));
                g.put("rows", new ArrayList<Map<String, Object>>());
                groupMap.put(u, g);
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> gRows = (List<Map<String, Object>>) g.get("rows");
            gRows.add(r);
        }
        List<Map<String, Object>> groups = new ArrayList<>(groupMap.values());
        for (Map<String, Object> g : groups) {
            g.put("total", ((List<?>) g.get("rows")).size());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("groups", groups);
        out.put("total", rows.size());
        return out;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
