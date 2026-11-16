package com.yinjia.mes.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 自动打印 · 任务缓存(离线补打)。2026-11-16 建。
 *
 * <h3>用户原话(需求来源)</h3>
 * <blockquote>
 * 「能在自动打印里面做个打印缓存吗，就是在打印代理掉了后，重新连接这个打印缓存，
 *  会将这期间打印的补回来。」
 * </blockquote>
 *
 * <h3>改造前为什么"补不回来"</h3>
 * 队列是 {@code PrintStationController.QUEUE}(内存 deque)，两个硬伤：
 * <ol>
 *   <li>入队时只算**在线**站点 ⇒ 代理掉线的那台**根本不在目标里**，手机点的打印直接丢；</li>
 *   <li>只在内存 + 5 分钟 TTL ⇒ 服务端一重启(每次部署都重启)整队清空。</li>
 * </ol>
 *
 * <h3>现在的口径</h3>
 * <ul>
 *   <li><b>目标站点按配置算</b>：开关打开 + 勾了这个打印类型，**不管在不在线** ——
 *       掉线期间的单子就攒在库里，代理回来第一次 {@code /pending} 按 id 顺序一条条领走；</li>
 *   <li><b>落库</b>：一条任务一行({@code yj_print_task})，载荷整条 JSON 存，
 *       以后打印字段怎么加都不用改表；</li>
 *   <li><b>每站只投一次</b>：取任务时把站点名追加到 {@code delivered}，
 *       再取同一张单时判重 → 不会因为"代理连着轮询"而重复出纸；</li>
 *   <li><b>超时</b>：默认 **3 天 = 72 小时**(见 {@code print.cache_hours}；用户口径「补打印保留3天」)，
 *       过期标 EXPIRED 不删，面板上能看见"这单没补上"。</li>
 * </ul>
 *
 * <h3>为什么不做"取走就删"</h3>
 * 删了就没有回执可查、面板也没法显示"已补打/失败"。状态机保留一行：
 * PENDING(有站点还没拿到) → SENT(已发全，等回执) → DONE / FAILED；超时 EXPIRED。
 * 7 天后由 {@link #sweep(int)} 清掉终态行，表不会无限长。
 *
 * <h3>并发</h3>
 * 取任务用"读旧值 + 条件更新"({@code WHERE id=? AND ISNULL(delivered,'')=?})：
 * 两台电脑同时抢同一条时只有一台更新成功，另一台本轮拿不到、下一轮再算，
 * 宁可晚 4 秒也不重复出纸。
 */
@Service
public class PrintCacheService {

    private static final Logger log = LoggerFactory.getLogger(PrintCacheService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 状态值(字符串常量：面板/日志直接可读，别改成数字) */
    public static final String PENDING = "PENDING";
    public static final String SENT = "SENT";
    public static final String DONE = "DONE";
    public static final String FAILED = "FAILED";
    public static final String EXPIRED = "EXPIRED";

    /** 终态保留天数(过期/完成/失败的行留这么久给现场看，之后物理删) */
    private static final int KEEP_DAYS = 7;

    private final JdbcTemplate jdbc;

    public PrintCacheService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 一条缓存任务(给面板列表用的轻量视图；完整载荷在 payload 里)。
     */
    public record CachedTask(long id, String type, String title, String slipNo, String woNo,
                             Set<String> targets, Set<String> delivered, String state,
                             String createdAt, String failReason, Map<String, Object> payload) {

        Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("类型", type);
            m.put("标题", title);
            m.put("单号", slipNo == null ? "" : slipNo);
            m.put("工单号", woNo == null ? "" : woNo);
            m.put("目标站点", new ArrayList<>(targets));
            m.put("已送达", new ArrayList<>(delivered));
            m.put("状态", state);
            m.put("时间", createdAt == null ? "" : createdAt);
            m.put("失败原因", failReason == null ? "" : failReason);
            return m;
        }
    }

    /**
     * 入队(落库)。
     *
     * @param type     打印类型 code(与 {@code PrintStationController.PRINT_TYPES} 一致)
     * @param title    纸面标题
     * @param slipNo   单号(领料单号优先，没有传工单号) —— 只给面板列表显示
     * @param woNo     工单号 —— 只给面板列表显示
     * @param payload  整条任务载荷(代理 {@code /print} 直接吃这份，键都是中文)
     * @param targets  目标站点名(入队就算好：开关开 + 勾了该类型，不看在线)
     * @param user     发起人(手机端账号)
     * @param ttlHours 保留小时数(默认 24，来自 print.cache_hours)
     * @return 新行 id
     */
    public long enqueue(String type, String title, String slipNo, String woNo,
                        Map<String, Object> payload, Set<String> targets, String user, int ttlHours) {
        String json;
        try {
            json = JSON.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("打印任务序列化失败:" + e.getMessage(), e);
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime exp = now.plusHours(Math.max(1, ttlHours));
        org.springframework.jdbc.support.GeneratedKeyHolder kh =
                new org.springframework.jdbc.support.GeneratedKeyHolder();
        final String insSql = "INSERT INTO yj_print_task (task_type, title, slip_no, wo_no, payload_json, targets,"
                + " delivered, state, created_at, expires_at, asp_user1, asp_time1, asp_time2)"
                + " VALUES (?,?,?,?,?,?,'',?,?,?,?,SYSDATETIME(),SYSDATETIME())";
        final String typeV = type;
        final String titleV = cut(title, 100);
        final String slipV = cut(slipNo, 50);
        final String woV = cut(woNo, 50);
        final String targetsV = csv(targets);
        final String userV = user;
        final java.sql.Timestamp nowV = java.sql.Timestamp.valueOf(now);
        final java.sql.Timestamp expV = java.sql.Timestamp.valueOf(exp);
        jdbc.update((java.sql.Connection con) -> {
            java.sql.PreparedStatement ps = con.prepareStatement(insSql, new String[]{"id"});
            ps.setString(1, typeV);
            ps.setString(2, titleV);
            ps.setString(3, slipV);
            ps.setString(4, woV);
            ps.setString(5, json);
            ps.setString(6, targetsV);
            ps.setString(7, PENDING);
            ps.setTimestamp(8, nowV);
            ps.setTimestamp(9, expV);
            ps.setString(10, userV);
            return ps;
        }, kh);
        Number key = kh.getKey();
        return key == null ? 0L : key.longValue();
    }

    /**
     * 取一条**还没投给这个站点**的任务(按入队先后)，取到即记账(写入 delivered)。
     *
     * @return 任务载荷(可直接下发代理；纸张由调用方按站点塞)；没有就 null
     */
    public Map<String, Object> takeFor(String station) {
        if (station == null || station.isBlank()) return null;
        String n = station.trim();
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT TOP 1 id, payload_json, targets, delivered FROM yj_print_task"
                        + " WHERE state = ? AND expires_at > SYSDATETIME()"
                        + "   AND CHARINDEX(',' + ? + ',', ',' + targets + ',') > 0"
                        + "   AND CHARINDEX(',' + ? + ',', ',' + ISNULL(delivered,'') + ',') = 0"
                        + " ORDER BY id",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    m.put("payload", rs.getString("payload_json"));
                    m.put("targets", rs.getString("targets"));
                    m.put("delivered", rs.getString("delivered"));
                    return m;
                }, PENDING, n, n);
        if (rows.isEmpty()) return null;

        Map<String, Object> row = rows.get(0);
        long id = (Long) row.get("id");
        String oldDelivered = (String) row.get("delivered");
        Set<String> delivered = parseCsv(oldDelivered);
        delivered.add(n);
        Set<String> targets = parseCsv((String) row.get("targets"));
        boolean allSent = !targets.isEmpty() && delivered.containsAll(targets);
        int n2 = jdbc.update("UPDATE yj_print_task SET delivered = ?, state = ?, asp_time2 = SYSDATETIME()"
                        + " WHERE id = ? AND ISNULL(delivered,'') = ?",
                csv(delivered), allSent ? SENT : PENDING, id, oldDelivered == null ? "" : oldDelivered);
        if (n2 == 0) {
            // 别的电脑刚抢走这一条：本轮不投，下一轮再算(宁可晚 4 秒，不重复出纸)
            log.debug("打印任务 {} 被并发取走，本轮回退", id);
            return null;
        }
        try {
            Map<String, Object> payload = JSON.readValue((String) row.get("payload"),
                    new TypeReference<Map<String, Object>>() { });
            // 🔴 任务 id 必须随载荷下发:代理出纸后要拿它回执(`/ack {taskId}`)。
            //   2026-11-16 实测踩过:落库版忘了塞 id,代理回执 taskId=0 ⇒ 缓存行永远停在 PENDING,
            //   面板上一直显示"已发出,等回执"直到过期。id 不存进 payload_json(那是真源的镜像),
            //   而是在每次下发时现塞 —— 它与行 id 恒等。
            payload.put("id", id);
            return payload;
        } catch (Exception e) {
            log.warn("打印任务 {} 载荷解析失败，丢弃该条:{}", id, e.toString());
            ack(id, false, "载荷解析失败:" + e.getMessage());
            return null;
        }
    }

    /** 代理回执：出纸成功/失败。失败保留原因，面板上看得见。 */
    public void ack(long id, boolean ok, String reason) {
        try {
            jdbc.update("UPDATE yj_print_task SET state = ?, fail_reason = ?, done_at = SYSDATETIME(),"
                            + " asp_time2 = SYSDATETIME() WHERE id = ?",
                    ok ? DONE : FAILED, cut(reason, 200), id);
        } catch (RuntimeException e) {
            log.warn("打印任务 {} 回执落库失败(不影响打印本身):{}", id, e.toString());
        }
    }

    /** 缓存列表(等补打 + 已发等回执)，新→旧，最多 100 条 */
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            List<CachedTask> rows = jdbc.query(
                    "SELECT TOP 100 id, task_type, title, slip_no, wo_no, targets, delivered, state,"
                            + " CONVERT(nvarchar(19), created_at, 120) AS created_at_txt, fail_reason, payload_json"
                            + " FROM yj_print_task WHERE state IN (?, ?) ORDER BY id DESC",
                    (rs, i) -> mapTask(rs), PENDING, SENT);
            for (CachedTask t : rows) out.add(t.json());
        } catch (RuntimeException e) {
            log.warn("读打印缓存失败:{}", e.toString());
        }
        return out;
    }

    /** 待补打条数(面板徽标/手机端提示用) */
    public int countPending() {
        try {
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM yj_print_task WHERE state IN (?, ?)",
                    Integer.class, PENDING, SENT);
            return n == null ? 0 : n;
        } catch (RuntimeException e) {
            return 0;
        }
    }

    /**
     * 清缓存。{@code station} 为空 = 清全部待补打；给站点名 = 只把这条任务对这个站点摘掉
     * (摘完没目标了就整行删)。
     *
     * @return 影响的行数
     */
    public int clear(String station) {
        int n = 0;
        try {
            if (station == null || station.isBlank()) {
                n = jdbc.update("DELETE FROM yj_print_task WHERE state IN (?, ?)", PENDING, SENT);
                return n;
            }
            String nm = station.trim();
            List<CachedTask> rows = jdbc.query(
                    "SELECT id, task_type, title, slip_no, wo_no, targets, delivered, state,"
                            + " CONVERT(nvarchar(19), created_at, 120) AS created_at_txt, fail_reason, NULL AS payload_json"
                            + " FROM yj_print_task WHERE state IN (?, ?)"
                            + "   AND CHARINDEX(',' + ? + ',', ',' + targets + ',') > 0",
                    (rs, i) -> mapTask(rs), PENDING, SENT, nm);
            for (CachedTask t : rows) {
                Set<String> targets = new LinkedHashSet<>(t.targets());
                targets.remove(nm);
                Set<String> delivered = new LinkedHashSet<>(t.delivered());
                delivered.remove(nm);
                if (targets.isEmpty()) {
                    n += jdbc.update("DELETE FROM yj_print_task WHERE id = ?", t.id());
                } else {
                    n += jdbc.update("UPDATE yj_print_task SET targets = ?, delivered = ?, asp_time2 = SYSDATETIME()"
                            + " WHERE id = ?", csv(targets), csv(delivered), t.id());
                }
            }
        } catch (RuntimeException e) {
            log.warn("清打印缓存失败:{}", e.toString());
        }
        return n;
    }

    /** 删一条(面板「删除」按钮：这条不要补打了) */
    public int delete(long id) {
        try {
            return jdbc.update("DELETE FROM yj_print_task WHERE id = ?", id);
        } catch (RuntimeException e) {
            log.warn("删打印缓存 {} 失败:{}", id, e.toString());
            return 0;
        }
    }

    /**
     * 重发一条(面板「补打」按钮)：把 delivered 清空、状态回 PENDING、过期时间顺延。
     * 代理只要在线，下一次轮询(≤4 秒)就会把它取走。
     */
    public int retry(long id, int ttlHours) {
        try {
            return jdbc.update("UPDATE yj_print_task SET delivered = '', state = ?, fail_reason = NULL,"
                            + " expires_at = DATEADD(hour, ?, SYSDATETIME()), asp_time2 = SYSDATETIME()"
                            + " WHERE id = ? AND state IN (?, ?, ?, ?)",
                    PENDING, Math.max(1, ttlHours), id, PENDING, SENT, DONE, FAILED);
        } catch (RuntimeException e) {
            log.warn("补打打印缓存 {} 失败:{}", id, e.toString());
            return 0;
        }
    }

    /**
     * 定期清理：① 到期的 PENDING/SENT 标 EXPIRED；② 终态行超过 {@link #KEEP_DAYS} 天物理删。
     * 由控制器每次 /pending、/station 调用时顺手跑(单实例、量小，不需要独立调度)。
     */
    public void sweep() {
        try {
            int exp = jdbc.update("UPDATE yj_print_task SET state = ?, asp_time2 = SYSDATETIME()"
                    + " WHERE state IN (?, ?) AND expires_at <= SYSDATETIME()", EXPIRED, PENDING, SENT);
            if (exp > 0) log.info("打印缓存:{} 条超过保留时长，标记 EXPIRED", exp);
            int del = jdbc.update("DELETE FROM yj_print_task WHERE state IN (?, ?, ?)"
                    + " AND ISNULL(done_at, asp_time2) < DATEADD(day, -?, SYSDATETIME())", DONE, FAILED, EXPIRED, KEEP_DAYS);
            if (del > 0) log.info("打印缓存:清理 {} 条终态记录(>{} 天)", del, KEEP_DAYS);
        } catch (RuntimeException e) {
            log.warn("打印缓存清理失败(不影响派单):{}", e.toString());
        }
    }

    // ══════════════════════ 内部 ══════════════════════

    private CachedTask mapTask(ResultSet rs) throws SQLException {
        String payloadJson = null;
        try {
            payloadJson = rs.getString("payload_json");
        } catch (SQLException ignore) {
            // list()/clear() 里不查这一列(几 MB 的二维码图没必要每次都读)
        }
        Map<String, Object> payload = null;
        if (payloadJson != null && !payloadJson.isBlank()) {
            try {
                payload = JSON.readValue(payloadJson, new TypeReference<Map<String, Object>>() { });
            } catch (Exception e) {
                payload = null;
            }
        }
        return new CachedTask(rs.getLong("id"), rs.getString("task_type"), rs.getString("title"),
                rs.getString("slip_no"), rs.getString("wo_no"),
                parseCsv(rs.getString("targets")), parseCsv(rs.getString("delivered")),
                rs.getString("state"), rs.getString("created_at_txt"), rs.getString("fail_reason"), payload);
    }

    private static Set<String> parseCsv(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null) return out;
        for (String p : csv.split(",")) {
            String s = p.trim();
            if (!s.isEmpty()) out.add(s);
        }
        return out;
    }

    private static String csv(Set<String> set) {
        return set == null ? "" : String.join(",", set);
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    /** 给日志/排查用的当前时间串(与面板显示口径一致) */
    public static String nowText() {
        return LocalDateTime.now().format(TS);
    }
}
