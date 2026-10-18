package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 数采平台对外契约层(用户 2026-10-18 需求:设备配置管理 / 数据监控 / 状态统计)。
 *
 * <p>职责边界:{@link DcService} 是库表与五连判据的唯一实现(设备/网关/采集点/规则/采样/报警),
 * 本类只做 <b>reshape + 区间聚合</b>,不重复写 CRUD SQL —— 前端三页(frontend/src/views/dc/)
 * 的字段契约以 {@code frontend/src/business/dcApi.js} 文件头注释为准:
 * <ul>
 *   <li>GET /dc/config → {kpis, gateways, devices},字段 camelCase、布尔为真布尔;</li>
 *   <li>GET /dc/monitor → {devices, points, alarms} 三个<b>扁平</b>数组;</li>
 *   <li>GET /dc/stats → {summary, byDevice, trend, alarms}。</li>
 * </ul>
 *
 * <p>数据口径(用户 2026-10-18「看板要真实数据」延续):在线率与趋势只来自
 * <code>bs_dc_status_log</code> 的真实状态变化,没有日志就是没有在线记录,不造数据;
 * 硬件未接入时三页如实显示空态/离线。
 */
@Service
public class DcPlatformService {

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("MM-dd");

    private static final int OFFLINE_MULTIPLIER = 3;
    private static final long OFFLINE_MIN_SECONDS = 180L;

    private static final String ALARM_HANDLED = "已处理";

    private final JdbcTemplate jdbc;
    private final DcService dc;

    public DcPlatformService(JdbcTemplate jdbc, DcService dc) {
        this.jdbc = jdbc;
        this.dc = dc;
    }

    // ───────────────────────── ① 设备配置管理 ─────────────────────────

    /** GET /dc/config:五连 KPI + 网关表 + 设备表(前端 DcConfig.vue 直接消费)。 */
    public Map<String, Object> config() {
        Map<String, Object> audit = dc.configAudit();
        List<Map<String, Object>> devices = new ArrayList<>();
        int bound = 0;
        int ready = 0;
        for (Map<String, Object> row : listOf(audit.get("devices"))) {
            Map<String, Object> v = deviceRow(row);
            devices.add(v);
            Map<String, Object> checks = mapOf(v.get("checks"));
            if (Boolean.TRUE.equals(checks.get("gateway"))) bound++;
            if (Boolean.TRUE.equals(v.get("configured"))) ready++;
        }
        List<Map<String, Object>> gateways = new ArrayList<>();
        for (Map<String, Object> row : dc.gateways()) gateways.add(gatewayRow(row));

        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("deviceTotal", devices.size());
        kpis.put("gatewayBound", bound);
        kpis.put("fullyReady", ready);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kpis", kpis);
        out.put("gateways", gateways);
        out.put("devices", devices);
        return out;
    }

    /** 设备行:snake_case 库列 → 前端 camelCase;progress = 五连完成数 × 20。 */
    private Map<String, Object> deviceRow(Map<String, Object> row) {
        int total = intValue(row.get("checkTotal")) > 0 ? intValue(row.get("checkTotal")) : 5;
        int done = intValue(row.get("doneCount"));
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("id", row.get("id"));
        d.put("code", str(row.get("code")));
        d.put("name", str(row.get("name")));
        d.put("type", str(row.get("device_type")));
        d.put("model", str(row.get("model")));
        d.put("serialNo", str(row.get("serial_no")));
        d.put("gatewayId", row.get("gateway_id"));
        d.put("gatewayName", str(row.get("gateway_name")));
        d.put("ip", str(row.get("ip")));
        d.put("port", row.get("port"));
        d.put("workshop", str(row.get("workshop")));
        d.put("projectCode", str(row.get("project_code")));
        d.put("scadaDrawn", "Y".equalsIgnoreCase(str(row.get("scada_drawn"))));
        d.put("heartbeatSeconds", intValue(row.get("heartbeat_seconds")));
        d.put("remark", str(row.get("remark")));
        d.put("enabled", "Y".equalsIgnoreCase(str(row.get("enabled"))));
        d.put("online", Boolean.TRUE.equals(row.get("online")));
        d.put("status", str(row.get("effectiveStatus")));
        // 墙钟字符串(2026-10-18):直传 java.sql.Timestamp 会被序列化成 UTC(界面显示早 8 小时),
        // 与采集点 at / serverTime 的本地墙钟口径统一
        d.put("lastSeenAt", wallClock(row.get("last_seen_at")));
        d.put("checks", row.get("checks"));
        d.put("configured", Boolean.TRUE.equals(row.get("configured")));
        d.put("progress", Math.round(done * 100f / total));
        d.put("pointCount", intValue(row.get("point_count")));
        d.put("ruleCount", intValue(row.get("rule_count")));
        d.put("sampleCount", intValue(row.get("sample_count")));
        d.put("alarmOpen", intValue(row.get("alarm_open")));
        List<?> missing = row.get("missing") instanceof List<?> l ? l : List.of();
        List<String> names = new ArrayList<>();
        for (Object o : missing) names.add(String.valueOf(o));
        d.put("missingTip", names.isEmpty() ? null : String.join("、", names));
        return d;
    }

    /** 网关行:status/enabled 转真布尔(前端 DcConfig 用 === false 判「已停用」)。 */
    private Map<String, Object> gatewayRow(Map<String, Object> row) {
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("id", row.get("id"));
        g.put("code", str(row.get("code")));
        g.put("name", str(row.get("name")));
        g.put("protocol", str(row.get("protocol")));
        g.put("host", str(row.get("host")));
        g.put("port", row.get("port"));
        g.put("remark", str(row.get("remark")));
        g.put("status", "online".equalsIgnoreCase(str(row.get("status"))));
        g.put("enabled", "Y".equalsIgnoreCase(str(row.get("enabled"))));
        g.put("lastSeenAt", wallClock(row.get("last_seen_at")));
        g.put("keySet", intValue(row.get("key_set")) > 0);
        g.put("deviceCount", intValue(row.get("device_count")));
        return g;
    }

    /** 保存网关(前端不传 apiKey ⇒ DcService 保持原密钥)。 */
    public Map<String, Object> saveGateway(Map<String, Object> body, String user) {
        return dc.saveGateway(body == null ? Map.of() : body, user);
    }

    /** 删除网关:先解绑设备,再软删(见 {@link DcService#deleteGateway})。 */
    public Map<String, Object> deleteGateway(int id, String user) {
        int detached = dc.deleteGateway(id, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("detachedDevices", detached);
        return out;
    }

    /** 保存设备:前端 type → deviceType,scadaDrawn 布尔 → 'Y'/'N'。 */
    public Map<String, Object> saveDevice(Map<String, Object> body, String user) {
        Map<String, Object> b = new LinkedHashMap<>(body == null ? Map.of() : body);
        if (b.containsKey("type") && !b.containsKey("deviceType")) b.put("deviceType", b.get("type"));
        b.put("scadaDrawn", boolOf(b.get("scadaDrawn")) ? "Y" : "N");
        return dc.saveDevice(b, user);
    }

    public Map<String, Object> deleteDevice(int id, String user) {
        dc.deleteDevice(id, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    public Map<String, Object> markDebug(int id, String user) {
        dc.markDebug(id, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    // ── 采集点 / 数采规则(五连「数采工程」「数采规则」的配置入口,也是硬件上报的前置) ──

    /** GET /dc/points:某台设备的采集点(snake_case 库列 → 前端 camelCase)。 */
    public List<Map<String, Object>> points(Integer deviceId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : dc.points(deviceId)) out.add(pointRow(row));
        return out;
    }

    private Map<String, Object> pointRow(Map<String, Object> row) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", row.get("id"));
        p.put("deviceId", row.get("device_id"));
        p.put("deviceCode", str(row.get("device_code")));
        p.put("code", str(row.get("code")));
        p.put("name", str(row.get("name")));
        p.put("dataType", str(row.get("data_type")));
        p.put("unit", str(row.get("unit")));
        p.put("addr", str(row.get("addr")));
        p.put("freqSeconds", intValue(row.get("freq_seconds")));
        p.put("lowLimit", row.get("low_limit"));
        p.put("highLimit", row.get("high_limit"));
        p.put("sortNo", intValue(row.get("sort_no")));
        p.put("enabled", "Y".equalsIgnoreCase(str(row.get("enabled"))));
        p.put("remark", str(row.get("remark")));
        return p;
    }

    /** 保存采集点(body 键与前端一致:deviceId/code/name/dataType/unit/lowLimit/highLimit…)。 */
    public Map<String, Object> savePoint(Map<String, Object> body, String user) {
        return dc.savePoint(body == null ? Map.of() : body, user);
    }

    public Map<String, Object> deletePoint(int id, String user) {
        dc.deletePoint(id, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    /** GET /dc/rules:某台设备的数采规则。 */
    public List<Map<String, Object>> rules(Integer deviceId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : dc.rules(deviceId)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", row.get("id"));
            r.put("deviceId", row.get("device_id"));
            r.put("deviceCode", str(row.get("device_code")));
            r.put("name", str(row.get("name")));
            r.put("ruleType", str(row.get("rule_type")));
            r.put("expression", str(row.get("expression")));
            r.put("params", str(row.get("params")));
            r.put("enabled", "Y".equalsIgnoreCase(str(row.get("enabled"))));
            r.put("remark", str(row.get("remark")));
            out.add(r);
        }
        return out;
    }

    /** 保存规则:前端 enabled 用真布尔,服务层吃 'Y'/'N'。 */
    public Map<String, Object> saveRule(Map<String, Object> body, String user) {
        Map<String, Object> b = new LinkedHashMap<>(body == null ? Map.of() : body);
        if (b.containsKey("enabled")) b.put("enabled", boolOf(b.get("enabled")) ? "Y" : "N");
        return dc.saveRule(b, user);
    }

    public Map<String, Object> deleteRule(int id, String user) {
        dc.deleteRule(id, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    // ───────────────────────── ② 数据监控 ─────────────────────────

    /** GET /dc/monitor:设备列表 + 选中设备的实时采集点 + 该设备报警(扁平数组)。 */
    public Map<String, Object> monitor(Integer deviceId) {
        List<Map<String, Object>> raw = dc.devices();
        List<Map<String, Object>> devices = new ArrayList<>();
        Map<Integer, Map<String, Object>> rawById = new HashMap<>();
        for (Map<String, Object> row : raw) {
            int id = intValue(row.get("id"));
            int total = intValue(row.get("checkTotal")) > 0 ? intValue(row.get("checkTotal")) : 5;
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("id", id);
            v.put("code", str(row.get("code")));
            v.put("name", str(row.get("name")));
            v.put("type", str(row.get("device_type")));
            v.put("enabled", "Y".equalsIgnoreCase(str(row.get("enabled"))));
            v.put("online", Boolean.TRUE.equals(row.get("online")));
            v.put("status", str(row.get("effectiveStatus")));
            v.put("progress", Math.round(intValue(row.get("doneCount")) * 100f / total));
            v.put("lastSeenAt", wallClock(row.get("last_seen_at")));
            v.put("alarmOpen", intValue(row.get("alarm_open")));
            devices.add(v);
            rawById.put(id, row);
        }
        Integer target = deviceId;
        if (target == null && !devices.isEmpty()) target = intValue(devices.get(0).get("id"));

        Map<String, Object> realtime = dc.realtime();
        List<Map<String, Object>> points = new ArrayList<>();
        Map<String, Object> rtDevice = null;
        for (Map<String, Object> d : listOf(realtime.get("devices"))) {
            if (target != null && intValue(d.get("deviceId")) == target) {
                rtDevice = d;
                break;
            }
        }
        Map<String, Object> rawTarget = target == null ? null : rawById.get(target);
        if (rtDevice != null) {
            long window = offlineWindow(rawTarget);
            for (Map<String, Object> p : listOf(rtDevice.get("points"))) {
                Map<String, Object> v = new LinkedHashMap<>();
                String text = str(p.get("valueText"));
                Object valueNum = p.get("valueNum");
                if (text.isEmpty()) text = valueNum == null ? "" : plain(valueNum);
                LocalDateTime at = toLocal(p.get("collectAt"));
                String status = "normal";
                if (Boolean.TRUE.equals(p.get("over"))) {
                    status = "alarm";
                } else if (at == null || Duration.between(at, LocalDateTime.now()).getSeconds() > window) {
                    status = "stale";
                }
                v.put("code", str(p.get("pointCode")));
                v.put("pointId", p.get("pointId"));
                v.put("name", str(p.get("pointName")));
                v.put("valueText", text);
                v.put("valueNum", valueNum);
                v.put("unit", str(p.get("unit")));
                v.put("at", at == null ? null : at.withNano(0).toString());
                v.put("lowLimit", p.get("lowLimit"));
                v.put("highLimit", p.get("highLimit"));
                v.put("quality", str(p.get("quality")));
                v.put("status", status);
                points.add(v);
            }
        }

        List<Map<String, Object>> alarms = new ArrayList<>();
        Map<String, Object> alarmPage = dc.alarms(null, null, target, 1, 50);
        for (Map<String, Object> r : listOf(alarmPage.get("rows"))) {
            Map<String, Object> a = new LinkedHashMap<>();
            LocalDateTime occur = toLocal(r.get("occur_at"));
            LocalDateTime handled = toLocal(r.get("handled_at"));
            a.put("id", r.get("id"));
            a.put("deviceId", r.get("device_id"));
            a.put("deviceCode", str(r.get("device_code")));
            a.put("deviceName", str(r.get("device_name")));
            a.put("pointCode", str(r.get("point_code")));
            a.put("pointName", str(r.get("point_name")));
            a.put("level", str(r.get("level")));
            a.put("message", str(r.get("message")));
            a.put("valueText", str(r.get("value_text")));
            a.put("occurAt", occur == null ? null : occur.withNano(0).toString());
            a.put("state", str(r.get("state")));
            a.put("handledBy", str(r.get("handled_by")));
            a.put("handledAt", handled == null ? null : handled.withNano(0).toString());
            a.put("handledNote", str(r.get("handled_note")));
            alarms.add(a);
        }
        int open = 0;
        for (Map<String, Object> a : alarms) if (!ALARM_HANDLED.equals(str(a.get("state")))) open++;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceId", target);
        out.put("devices", devices);
        out.put("points", points);
        out.put("alarms", alarms);
        out.put("alarmOpen", open);
        out.put("serverTime", LocalDateTime.now().withNano(0).toString());
        return out;
    }

    /** 处理报警(登录用户即可,写 handled_by/handled_at/handled_note)。 */
    public Map<String, Object> handleAlarm(int id, String note, String user) {
        dc.handleAlarm(id, user, note);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("state", ALARM_HANDLED);
        return out;
    }

    // ───────────────────────── ③ 状态统计 ─────────────────────────

    /**
     * GET /dc/stats:区间内在线率、按设备在线时长、按日在线/离线快照、报警汇总。
     * 所有时长来自 bs_dc_status_log 真实状态变化;窗口 = [from 00:00, to+1 00:00)。
     */
    public Map<String, Object> stats(String from, String to) {
        LocalDate toDate = parseDate(to, LocalDate.now());
        LocalDate fromDate = parseDate(from, toDate.minusDays(29));
        if (fromDate.isAfter(toDate)) {
            LocalDate swap = fromDate;
            fromDate = toDate;
            toDate = swap;
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime winStart = fromDate.atStartOfDay();
        LocalDateTime winEnd = toDate.plusDays(1).atStartOfDay();
        // 窗口末端不能越过“现在”:否则今天剩余的小时会被算成在线/离线时长(实测 14:18 上线却报在线 9.7h)
        if (winEnd.isAfter(now)) winEnd = now;
        if (winStart.isAfter(winEnd)) winStart = winEnd;
        long winMs = Math.max(1L, Duration.between(winStart, winEnd).toMillis());

        List<Map<String, Object>> devices = jdbc.queryForList("""
                SELECT d.id, d.code, d.name, d.device_type, d.status, d.last_seen_at, d.enabled, d.heartbeat_seconds
                  FROM bs_dc_device d
                 WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
                 ORDER BY d.device_type, d.code
                """);
        List<Map<String, Object>> logs = jdbc.queryForList("""
                SELECT device_id, status, changed_at
                  FROM bs_dc_status_log
                 WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND changed_at < ?
                 ORDER BY device_id, changed_at
                """, Timestamp.valueOf(winEnd));
        Map<Integer, List<Map<String, Object>>> logsByDevice = new HashMap<>();
        for (Map<String, Object> log : logs) {
            logsByDevice.computeIfAbsent(intValue(log.get("device_id")), k -> new ArrayList<>()).add(log);
        }
        Map<Integer, Integer> alarmCount = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList("""
                SELECT device_id, COUNT(1) AS cnt
                  FROM bs_dc_alarm
                 WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND occur_at >= ? AND occur_at < ?
                 GROUP BY device_id
                """, Timestamp.valueOf(winStart), Timestamp.valueOf(winEnd))) {
            alarmCount.put(intValue(row.get("device_id")), intValue(row.get("cnt")));
        }

        int enabledTotal = 0;
        int onlineNow = 0;
        int offlineNow = 0;
        int disabled = 0;
        List<Map<String, Object>> byDevice = new ArrayList<>();
        List<Map<String, Object>> activeDevices = new ArrayList<>();
        for (Map<String, Object> row : devices) {
            int id = intValue(row.get("id"));
            boolean enabled = "Y".equalsIgnoreCase(str(row.get("enabled")));
            boolean online = enabled && isOnlineNow(row);
            String current = !enabled ? "disabled" : (online ? "online" : "offline");
            if (enabled) {
                enabledTotal++;
                if (online) onlineNow++; else offlineNow++;
                activeDevices.add(row);
            } else {
                disabled++;
            }
            long[] usage = foldUsage(logsByDevice.get(id), winStart, winEnd);
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("deviceId", id);
            d.put("deviceCode", str(row.get("code")));
            d.put("deviceName", str(row.get("name")));
            d.put("deviceType", str(row.get("device_type")));
            d.put("currentStatus", current);
            d.put("onlineSeconds", Math.round(usage[0] / 1000.0));
            d.put("offlineSeconds", Math.round(usage[1] / 1000.0));
            d.put("onlineRate", round1(usage[0] * 100.0 / winMs));
            d.put("alarmCount", alarmCount.getOrDefault(id, 0));
            d.put("statusChanges", usage[2]);
            byDevice.add(d);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("deviceTotal", enabledTotal);
        summary.put("disabledTotal", disabled);
        summary.put("onlineNow", onlineNow);
        summary.put("offlineNow", offlineNow);
        summary.put("onlineRate", enabledTotal == 0 ? null : round1(onlineNow * 100.0 / enabledTotal));

        List<Map<String, Object>> trend = new ArrayList<>();
        for (LocalDate day = fromDate; !day.isAfter(toDate); day = day.plusDays(1)) {
            LocalDateTime snapshot = day.plusDays(1).atStartOfDay();
            if (snapshot.isAfter(now)) snapshot = now;
            int online = 0;
            int offline = 0;
            for (Map<String, Object> row : activeDevices) {
                String st = statusAt(logsByDevice.get(intValue(row.get("id"))), snapshot);
                if ("online".equalsIgnoreCase(st)) online++; else offline++;
            }
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("label", day.format(DAY_LABEL));
            t.put("date", day.toString());
            t.put("online", online);
            t.put("offline", offline);
            trend.add(t);
        }

        int alarmTotal = 0;
        int unhandled = 0;
        List<Map<String, Object>> byLevel = new ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList("""
                SELECT ISNULL(NULLIF(LTRIM(RTRIM(level)), ''), N'提示') AS level, COUNT(1) AS cnt,
                       SUM(CASE WHEN ISNULL(state, N'') <> N'已处理' THEN 1 ELSE 0 END) AS open_cnt
                  FROM bs_dc_alarm
                 WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND occur_at >= ? AND occur_at < ?
                 GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(level)), ''), N'提示')
                 ORDER BY COUNT(1) DESC
                """, Timestamp.valueOf(winStart), Timestamp.valueOf(winEnd))) {
            int cnt = intValue(row.get("cnt"));
            alarmTotal += cnt;
            unhandled += intValue(row.get("open_cnt"));
            Map<String, Object> lv = new LinkedHashMap<>();
            lv.put("level", str(row.get("level")));
            lv.put("count", cnt);
            byLevel.add(lv);
        }
        Map<String, Object> alarms = new LinkedHashMap<>();
        alarms.put("total", alarmTotal);
        alarms.put("unhandled", unhandled);
        alarms.put("byLevel", byLevel);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", fromDate.toString());
        out.put("to", toDate.toString());
        out.put("summary", summary);
        out.put("byDevice", byDevice);
        out.put("trend", trend);
        out.put("alarms", alarms);
        return out;
    }

    /** 折叠某设备在窗口内的在线/离线时长(毫秒)+ 状态变化次数;窗口起点前的最后状态作为初始态。 */
    private static long[] foldUsage(List<Map<String, Object>> logs, LocalDateTime winStart, LocalDateTime winEnd) {
        long onlineMs = 0L;
        long offlineMs = 0L;
        long changes = logs == null ? 0L : logs.size();
        String state = "offline";
        LocalDateTime cursor = winStart;
        if (logs != null) {
            for (Map<String, Object> log : logs) {
                LocalDateTime at = toLocal(log.get("changed_at"));
                if (at == null) continue;
                if (!at.isAfter(winStart)) {
                    state = str(log.get("status"));
                    continue;
                }
                if (at.isAfter(winEnd)) break;
                long seg = Math.max(0L, Duration.between(cursor, at).toMillis());
                if ("online".equalsIgnoreCase(state)) onlineMs += seg; else offlineMs += seg;
                state = str(log.get("status"));
                cursor = at;
            }
        }
        long tail = Math.max(0L, Duration.between(cursor, winEnd).toMillis());
        if ("online".equalsIgnoreCase(state)) onlineMs += tail; else offlineMs += tail;
        return new long[]{onlineMs, offlineMs, changes};
    }

    /** 某时刻的在线/离线快照:窗口内该时刻之前的最后一次状态变化。 */
    private static String statusAt(List<Map<String, Object>> logs, LocalDateTime at) {
        String state = "offline";
        if (logs == null) return state;
        for (Map<String, Object> log : logs) {
            LocalDateTime changed = toLocal(log.get("changed_at"));
            if (changed == null) continue;
            if (changed.isAfter(at)) break;
            state = str(log.get("status"));
        }
        return state;
    }

    // ───────────────────────── ④ 硬件接入 ─────────────────────────

    /**
     * POST /dc/ingest:一次上报多个采集点(values[{pointCode,value}])。
     * 单点写入仍走 {@link DcService#ingest}(写采样 + 刷新在线 + 越限报警),这里只做批量与网关一致性校验。
     */
    public Map<String, Object> ingestBatch(Map<String, Object> body, String key) {
        if (body == null) throw new IllegalArgumentException("请求体不能为空");
        String gatewayCode = str(body.get("gatewayCode"));
        String deviceCode = str(body.get("deviceCode"));
        if (deviceCode.isEmpty()) throw new IllegalArgumentException("缺少 deviceCode");
        List<Map<String, Object>> items = listOf(body.get("values"));
        if (items.isEmpty()) throw new IllegalArgumentException("values 不能为空");
        if (!gatewayCode.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList("""
                    SELECT ISNULL(g.code, N'') AS gateway_code
                      FROM bs_dc_device d
                      LEFT JOIN bs_dc_gateway g ON g.id = d.gateway_id
                     WHERE d.code = ? AND ISNULL(d.asp_cancel, 'N') <> 'Y'
                    """, deviceCode);
            if (rows.isEmpty()) throw new IllegalArgumentException("设备不存在：" + deviceCode);
            String bound = str(rows.get(0).get("gateway_code"));
            if (!bound.equals(gatewayCode)) {
                throw new IllegalArgumentException("设备未绑定该网关：" + deviceCode + " / " + gatewayCode);
            }
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> one = new LinkedHashMap<>(item);
            one.put("deviceCode", deviceCode);
            results.add(dc.ingest(one, key));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceCode", deviceCode);
        out.put("accepted", results.size());
        out.put("results", results);
        return out;
    }

    /**
     * POST /dc/heartbeat:硬件心跳,只刷新在线状态(在线↔离线切换会写 bs_dc_status_log,
     * 供状态统计算可用率)。鉴权与 ingest 同:请求头 X-DC-Key = 所绑网关的 api_key。
     */
    public Map<String, Object> heartbeat(Map<String, Object> body, String key) {
        if (body == null) throw new IllegalArgumentException("请求体不能为空");
        return dc.heartbeat(body, key);
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    private boolean isOnlineNow(Map<String, Object> row) {
        LocalDateTime seen = toLocal(row.get("last_seen_at"));
        if (seen == null) return false;
        long window = offlineWindow(row);
        return Duration.between(seen, LocalDateTime.now()).getSeconds() <= window;
    }

    private static long offlineWindow(Map<String, Object> row) {
        int hb = row == null || row.get("heartbeat_seconds") == null ? 60 : intValue(row.get("heartbeat_seconds"));
        return Math.max((long) hb * OFFLINE_MULTIPLIER, OFFLINE_MIN_SECONDS);
    }

    private static LocalDate parseDate(String text, LocalDate fallback) {
        String s = text == null ? "" : text.trim();
        if (s.isEmpty()) return fallback;
        try {
            return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s);
        } catch (RuntimeException ex) {
            return fallback;
        }
    }

    private static String plain(Object value) {
        if (value == null) return "";
        BigDecimal d = decOrNull(value);
        return d == null ? str(value) : d.stripTrailingZeros().toPlainString();
    }

    private static boolean boolOf(Object v) {
        if (v instanceof Boolean b) return b;
        String s = str(v);
        return "Y".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s) || "1".equals(s);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapOf(Object v) {
        return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private static List<Map<String, Object>> listOf(Object v) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (!(v instanceof List<?> list)) return out;
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                Map<String, Object> row = new LinkedHashMap<>();
                m.forEach((k, val) -> row.put(String.valueOf(k), val));
                out.add(row);
            }
        }
        return out;
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static int intValue(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.intValue();
        BigDecimal d = decOrNull(v);
        return d == null ? 0 : d.intValue();
    }

    private static BigDecimal decOrNull(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal d) return d;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(v).trim());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static LocalDateTime toLocal(Object v) {
        if (v == null) return null;
        if (v instanceof LocalDateTime t) return t;
        if (v instanceof Timestamp ts) return ts.toLocalDateTime();
        if (v instanceof java.sql.Date d) return d.toLocalDate().atStartOfDay();
        if (v instanceof LocalDate d) return d.atStartOfDay();
        if (v instanceof java.util.Date d) return new Timestamp(d.getTime()).toLocalDateTime();
        String s = str(v);
        if (s.isEmpty()) return null;
        if (s.length() > 19) s = s.substring(0, 19);
        try {
            return LocalDateTime.parse(s.replace(' ', 'T'));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    /**
     * 时间列统一按**本地墙钟字符串**下发(2026-10-18):直接 put 查询出来的
     * java.sql.Timestamp 会被 Jackson 序列化成 UTC 带 +00:00,前端原样显示就早 8 小时
     * (实测「最近上报 2026-10-18 08:52」而上报时间其实是 16:52)。采集点 at、serverTime
     * 一直是墙钟串,这里对齐同一口径。
     */
    private static String wallClock(Object v) {
        LocalDateTime t = toLocal(v);
        return t == null ? null : t.withNano(0).toString();
    }
}
