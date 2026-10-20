package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 数采平台(设备数据采集)—— 用户 2026-10-18「把数采平台管理模块加进系统,方便后续硬件接入」。
 *
 * <h3>三个功能与各自的表</h3>
 * <ol>
 *   <li><b>IOT设备配置</b>{@link #configAudit}:五连检查(绑定网关 / 数采工程 / 组态 / 数采规则 /
 *       数据调试)全部由台账字段推导,不另存冗余标记 —— 判据见 {@link #checks};</li>
 *   <li><b>数据监控</b>{@link #realtime} + {@link #alarms}:实时值取 bs_dc_sample 每个采集点的
 *       TOP 1(参数化,无缓存);报警取 bs_dc_alarm(可筛选/可处理);</li>
 *   <li><b>状态统计</b>{@link #statusStats}:在线/离线数量取设备有效状态(心跳推算),
 *       在线率同时给「当前在线率」和「窗口可用率」(窗口可用率来自 bs_dc_status_log 的状态时长)。</li>
 * </ol>
 *
 * <h3>数据真实性口径(沿用用户 2026-10-18 对看板的既有要求)</h3>
 * 不造采样、不造报警:没有硬件上报就是「离线 / 待配置 / 无数据」。演示用的模拟上报见
 * tools/archive/_dc-ingest/ 下的脚本(输出明确标注 demo)。
 *
 * <h3>硬件侧鉴权</h3>
 * 设备没有登录账号,故 {@code /api/dc/ingest}、{@code /api/dc/heartbeat} 在 SecurityConfig 里
 * permitAll,由 {@link #requireGatewayKey} 校验请求头 X-DC-Key = 设备所绑网关 bs_dc_gateway.api_key。
 * 未绑网关或密钥为空 ⇒ 拒绝(与「绑定网关」检查项同一口径,不允许绕过配置直接上报)。
 */
@Service
public class DcService {

    private final JdbcTemplate jdbc;

    /** 设备有效状态:超过 心跳 × 该倍数 未上报 ⇒ 视为离线(下限见 {@link #OFFLINE_MIN_SECONDS}) */
    private static final int OFFLINE_MULTIPLIER = 3;

    /** 心跳窗口下限(秒):心跳配 5 秒的设备不至于抖一下就被判离线 */
    private static final int OFFLINE_MIN_SECONDS = 180;

    /** 五连检查的键与中文名(前端照此渲染,顺序即展示顺序) */
    private static final String[][] CHECKS = {
            {"gateway", "绑定网关"},
            {"project", "数采工程"},
            {"scada", "绘制组态"},
            {"rule", "数采规则"},
            {"debug", "数据调试"},
    };

    public DcService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ───────────────────────────── IOT设备配置 ─────────────────────────────

    /** 设备台账(带网关名、点位数、规则数),按设备类型 + 编码排序。 */
    private List<Map<String, Object>> deviceRows() {
        return jdbc.queryForList("""
                SELECT d.id, d.code, d.name, d.device_type, d.model, d.serial_no,
                       d.gateway_id, g.name AS gateway_name, g.code AS gateway_code,
                       d.ip, d.port, d.protocol, d.workshop, d.project_code,
                       d.scada_drawn, d.last_debug_at, d.heartbeat_seconds,
                       d.status, d.last_seen_at, d.enabled, d.remark,
                       (SELECT COUNT(1) FROM bs_dc_point p
                         WHERE p.device_id = d.id AND ISNULL(p.asp_cancel,'N') <> 'Y' AND p.enabled = 'Y') AS point_count,
                       (SELECT COUNT(1) FROM bs_dc_rule r
                         WHERE r.device_id = d.id AND ISNULL(r.asp_cancel,'N') <> 'Y' AND r.enabled = 'Y') AS rule_count,
                       (SELECT COUNT(1) FROM bs_dc_sample s WHERE s.device_id = d.id) AS sample_count,
                       (SELECT COUNT(1) FROM bs_dc_alarm a
                         WHERE a.device_id = d.id AND ISNULL(a.asp_cancel,'N') <> 'Y' AND a.state = N'未处理') AS alarm_open
                  FROM bs_dc_device d
                  LEFT JOIN bs_dc_gateway g ON g.id = d.gateway_id
                 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
                 ORDER BY d.device_type, d.code
                """);
    }

    /** 设备视图 = 台账 + 五连检查结果 + 缺项提示 + 有效在线状态。 */
    public List<Map<String, Object>> devices() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : deviceRows()) out.add(view(row));
        return out;
    }

    private Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> v = new LinkedHashMap<>(row);
        Map<String, Boolean> checks = checks(row);
        List<String> missing = new ArrayList<>();
        int done = 0;
        for (String[] c : CHECKS) {
            boolean ok = Boolean.TRUE.equals(checks.get(c[0]));
            if (ok) done++; else missing.add(c[1]);
        }
        v.put("checks", checks);
        v.put("doneCount", done);
        v.put("checkTotal", CHECKS.length);
        v.put("missing", missing);
        v.put("configured", done == CHECKS.length);
        v.put("online", isOnline(row));
        v.put("effectiveStatus", effectiveStatus(row));
        return v;
    }

    /**
     * 五连检查判据(**只看台账字段,不引入额外的"已配"标记**,免得出现"标记已配但实际没有"的假绿):
     * <ul>
     *   <li>绑定网关:gateway_id 非空</li>
     *   <li>数采工程:project_code 非空</li>
     *   <li>绘制组态:scada_drawn = 'Y'</li>
     *   <li>数采规则:存在启用的 bs_dc_rule</li>
     *   <li>数据调试:last_debug_at 非空(**只有真正收到过数据或人工点过"调试通过"才会被写**)</li>
     * </ul>
     */
    private Map<String, Boolean> checks(Map<String, Object> row) {
        Map<String, Boolean> c = new LinkedHashMap<>();
        c.put("gateway", row.get("gateway_id") != null);
        c.put("project", !blank(row.get("project_code")));
        c.put("scada", "Y".equalsIgnoreCase(str(row.get("scada_drawn"))));
        c.put("rule", num(row.get("rule_count")) > 0);
        c.put("debug", row.get("last_debug_at") != null);
        return c;
    }

    /** IOT设备配置汇总:按类型的总数 / 已配齐数 / 缺项分布(提示用)。 */
    public Map<String, Object> configAudit() {
        List<Map<String, Object>> list = devices();
        Map<String, Integer> byType = new LinkedHashMap<>();
        Map<String, Integer> missingCount = new LinkedHashMap<>();
        for (String[] c : CHECKS) missingCount.put(c[1], 0);
        int configured = 0;
        for (Map<String, Object> d : list) {
            String type = str(d.get("device_type"));
            byType.merge(type, 1, Integer::sum);
            if (Boolean.TRUE.equals(d.get("configured"))) configured++;
            @SuppressWarnings("unchecked")
            Map<String, Boolean> c = (Map<String, Boolean>) d.get("checks");
            for (String[] chk : CHECKS) {
                if (!Boolean.TRUE.equals(c.get(chk[0]))) missingCount.merge(chk[1], 1, Integer::sum);
            }
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", list.size());
        summary.put("configured", configured);
        summary.put("unconfigured", list.size() - configured);
        summary.put("byType", byType);
        summary.put("missing", missingCount);
        summary.put("checkDefs", checkDefs());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("summary", summary);
        out.put("devices", list);
        return out;
    }

    /** 五连检查的键/中文名(前端表头与提示直接用它,避免两边写死顺序)。 */
    public List<Map<String, Object>> checkDefs() {
        List<Map<String, Object>> defs = new ArrayList<>();
        for (String[] c : CHECKS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", c[0]);
            m.put("label", c[1]);
            defs.add(m);
        }
        return defs;
    }

    /** 新增/修改设备(body 见 DcController.saveDevice 注释);code 唯一,重复即报错。 */
    public Map<String, Object> saveDevice(Map<String, Object> body, String user) {
        Integer id = intOrNull(body.get("id"));
        String code = str(body.get("code")).trim();
        String name = str(body.get("name")).trim();
        if (code.isEmpty() || name.isEmpty()) throw new IllegalArgumentException("设备编码与设备名称必填");
        String type = str(body.get("deviceType"));
        if (type.isEmpty()) type = "其他";
        List<Integer> dup = jdbc.queryForList(
                "SELECT id FROM bs_dc_device WHERE code = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, code);
        if (!dup.isEmpty() && (id == null || !dup.get(0).equals(id))) throw new IllegalArgumentException("设备编码已存在：" + code);
        Object gatewayId = intOrNull(body.get("gatewayId"));
        if (gatewayId == null) gatewayId = intOrNull(body.get("gateway_id"));
        String scada = "Y".equalsIgnoreCase(str(body.get("scadaDrawn")) == null ? "" : str(body.get("scadaDrawn"))) ? "Y" : "N";
        Object hb = body.get("heartbeatSeconds");
        int heartbeat = hb == null || String.valueOf(hb).isBlank() ? 60 : Math.max(5, Integer.parseInt(String.valueOf(hb)));
        if (id == null) {
            jdbc.update("""
                    INSERT INTO bs_dc_device
                      (code, name, device_type, model, serial_no, gateway_id, ip, port, protocol, workshop,
                       project_code, scada_drawn, heartbeat_seconds, status, enabled, remark,
                       asp_user1, asp_time1)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,N'offline',?,?,?,SYSDATETIME())
                    """,
                    code, name, type, str(body.get("model")), str(body.get("serialNo")), gatewayId,
                    str(body.get("ip")), intOrNull(body.get("port")), str(body.get("protocol")),
                    str(body.get("workshop")), blank(body.get("projectCode")) ? null : str(body.get("projectCode")),
                    scada, heartbeat, "N".equalsIgnoreCase(str(body.get("enabled"))) ? "N" : "Y",
                    str(body.get("remark")), user);
            id = jdbc.queryForObject("SELECT id FROM bs_dc_device WHERE code = ?", Integer.class, code);
        } else {
            jdbc.update("""
                    UPDATE bs_dc_device SET
                      code = ?, name = ?, device_type = ?, model = ?, serial_no = ?, gateway_id = ?,
                      ip = ?, port = ?, protocol = ?, workshop = ?, project_code = ?, scada_drawn = ?,
                      heartbeat_seconds = ?, remark = ?, asp_user2 = ?, asp_time2 = SYSDATETIME()
                    WHERE id = ?
                    """,
                    code, name, type, str(body.get("model")), str(body.get("serialNo")), gatewayId,
                    str(body.get("ip")), intOrNull(body.get("port")), str(body.get("protocol")),
                    str(body.get("workshop")), blank(body.get("projectCode")) ? null : str(body.get("projectCode")),
                    scada, heartbeat, str(body.get("remark")), user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    /** 删除设备 = 软删(asp_cancel='Y'),保留采样/报警历史。 */
    public int deleteDevice(int id, String user) {
        return jdbc.update("UPDATE bs_dc_device SET asp_cancel = 'Y', asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?", user, id);
    }

    /** 人工点「调试通过」:写 last_debug_at(设备接到硬件后由 ingest 自动写,这里供无硬件时先登记)。 */
    public int markDebug(int deviceId, String user) {
        return jdbc.update("UPDATE bs_dc_device SET last_debug_at = SYSDATETIME(), asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?", user, deviceId);
    }

    // ───────────────────────────── 网关 / 采集点 / 规则 ─────────────────────────────

    public List<Map<String, Object>> gateways() {
        return jdbc.queryForList("""
                SELECT g.id, g.code, g.name, g.protocol, g.host, g.port, g.status, g.last_seen_at, g.enabled, g.remark,
                       CASE WHEN ISNULL(g.api_key, N'') = N'' THEN 0 ELSE 1 END AS key_set,
                       (SELECT COUNT(1) FROM bs_dc_device d
                         WHERE d.gateway_id = g.id AND ISNULL(d.asp_cancel,'N') <> 'Y') AS device_count
                  FROM bs_dc_gateway g
                 WHERE ISNULL(g.asp_cancel,'N') <> 'Y'
                 ORDER BY g.code
                """);
    }

    /** 保存网关。apiKey 传空字符串 = 清除密钥;不传该键 = 保持原值(避免前端回显密钥)。 */
    public Map<String, Object> saveGateway(Map<String, Object> body, String user) {
        Integer id = intOrNull(body.get("id"));
        String code = str(body.get("code")).trim();
        String name = str(body.get("name")).trim();
        if (code.isEmpty() || name.isEmpty()) throw new IllegalArgumentException("网关编码与网关名称必填");
        if (id == null) {
            jdbc.update("""
                    INSERT INTO bs_dc_gateway (code, name, protocol, host, port, status, enabled, remark, api_key, asp_user1, asp_time1)
                    VALUES (?,?,?,?,?,N'offline',?,?,?,?,SYSDATETIME())
                    """,
                    code, name, defaultIfBlank(body.get("protocol"), "MQTT"), str(body.get("host")),
                    intOrNull(body.get("port")), "Y", str(body.get("remark")),
                    blank(body.get("apiKey")) ? null : str(body.get("apiKey")), user);
            id = jdbc.queryForObject("SELECT id FROM bs_dc_gateway WHERE code = ?", Integer.class, code);
        } else {
            boolean touchKey = body.containsKey("apiKey");
            jdbc.update("""
                    UPDATE bs_dc_gateway SET code = ?, name = ?, protocol = ?, host = ?, port = ?, remark = ?,
                           api_key = CASE WHEN ? = 1 THEN ? ELSE api_key END,
                           asp_user2 = ?, asp_time2 = SYSDATETIME()
                     WHERE id = ?
                    """,
                    code, name, defaultIfBlank(body.get("protocol"), "MQTT"), str(body.get("host")),
                    intOrNull(body.get("port")), str(body.get("remark")),
                    touchKey ? 1 : 0, blank(body.get("apiKey")) ? null : str(body.get("apiKey")), user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    /**
     * 删除网关:先把挂在这个网关上的设备解绑(gateway_id = NULL,五连里的「绑定网关」随即变 ✗,
     * 而不是留下一个指向已删网关的悬空 id),再软删网关本身。采样/报警历史保留。
     *
     * @return 被解绑的设备数
     */
    public int deleteGateway(int id, String user) {
        int detached = jdbc.update("""
                UPDATE bs_dc_device SET gateway_id = NULL, asp_user2 = ?, asp_time2 = SYSDATETIME()
                 WHERE gateway_id = ? AND ISNULL(asp_cancel, 'N') <> 'Y'
                """, user, id);
        jdbc.update("UPDATE bs_dc_gateway SET asp_cancel = 'Y', asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                user, id);
        return detached;
    }

    public List<Map<String, Object>> points(Integer deviceId) {
        StringBuilder sql = new StringBuilder("""
                SELECT p.id, p.device_id, d.code AS device_code, p.code, p.name, p.data_type, p.unit, p.addr,
                       p.freq_seconds, p.low_limit, p.high_limit, p.sort_no, p.enabled, p.remark
                  FROM bs_dc_point p
                  JOIN bs_dc_device d ON d.id = p.device_id
                 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
                """);
        List<Object> args = new ArrayList<>();
        if (deviceId != null) {
            sql.append(" AND p.device_id = ?");
            args.add(deviceId);
        }
        sql.append(" ORDER BY p.device_id, p.sort_no, p.code");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    public Map<String, Object> savePoint(Map<String, Object> body, String user) {
        Integer id = intOrNull(body.get("id"));
        Integer deviceId = intOrNull(body.get("deviceId"));
        String code = str(body.get("code")).trim();
        String name = str(body.get("name")).trim();
        if (deviceId == null) throw new IllegalArgumentException("请选择设备");
        if (code.isEmpty() || name.isEmpty()) throw new IllegalArgumentException("采集点编码与名称必填");
        if (id == null) {
            jdbc.update("""
                    INSERT INTO bs_dc_point (device_id, code, name, data_type, unit, addr, freq_seconds,
                                             low_limit, high_limit, sort_no, enabled, remark, asp_user1, asp_time1)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME())
                    """,
                    deviceId, code, name, defaultIfBlank(body.get("dataType"), "数值"), str(body.get("unit")),
                    str(body.get("addr")), intOr(body.get("freqSeconds"), 5),
                    decOrNull(body.get("lowLimit")), decOrNull(body.get("highLimit")),
                    intOr(body.get("sortNo"), 0), "Y", str(body.get("remark")), user);
            id = jdbc.queryForObject("SELECT TOP 1 id FROM bs_dc_point WHERE device_id = ? AND code = ? ORDER BY id DESC",
                    Integer.class, deviceId, code);
        } else {
            jdbc.update("""
                    UPDATE bs_dc_point SET device_id = ?, code = ?, name = ?, data_type = ?, unit = ?, addr = ?,
                           freq_seconds = ?, low_limit = ?, high_limit = ?, sort_no = ?, remark = ?,
                           asp_user2 = ?, asp_time2 = SYSDATETIME()
                     WHERE id = ?
                    """,
                    deviceId, code, name, defaultIfBlank(body.get("dataType"), "数值"), str(body.get("unit")),
                    str(body.get("addr")), intOr(body.get("freqSeconds"), 5),
                    decOrNull(body.get("lowLimit")), decOrNull(body.get("highLimit")),
                    intOr(body.get("sortNo"), 0), str(body.get("remark")), user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    public List<Map<String, Object>> rules(Integer deviceId) {
        StringBuilder sql = new StringBuilder("""
                SELECT r.id, r.device_id, d.code AS device_code, r.name, r.rule_type, r.expression, r.params,
                       r.enabled, r.remark
                  FROM bs_dc_rule r
                  JOIN bs_dc_device d ON d.id = r.device_id
                 WHERE ISNULL(r.asp_cancel,'N') <> 'Y'
                """);
        List<Object> args = new ArrayList<>();
        if (deviceId != null) {
            sql.append(" AND r.device_id = ?");
            args.add(deviceId);
        }
        sql.append(" ORDER BY r.device_id, r.id");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    public Map<String, Object> saveRule(Map<String, Object> body, String user) {
        Integer id = intOrNull(body.get("id"));
        Integer deviceId = intOrNull(body.get("deviceId"));
        String name = str(body.get("name")).trim();
        if (deviceId == null) throw new IllegalArgumentException("请选择设备");
        if (name.isEmpty()) throw new IllegalArgumentException("规则名称必填");
        String type = defaultIfBlank(body.get("ruleType"), "定时采集");
        if (id == null) {
            jdbc.update("""
                    INSERT INTO bs_dc_rule (device_id, name, rule_type, expression, params, enabled, remark, asp_user1, asp_time1)
                    VALUES (?,?,?,?,?,?,?,?,SYSDATETIME())
                    """,
                    deviceId, name, type, str(body.get("expression")), str(body.get("params")),
                    "N".equalsIgnoreCase(str(body.get("enabled"))) ? "N" : "Y", str(body.get("remark")), user);
            id = jdbc.queryForObject(
                    "SELECT TOP 1 id FROM bs_dc_rule WHERE device_id = ? AND name = ? ORDER BY id DESC",
                    Integer.class, deviceId, name);
        } else {
            jdbc.update("""
                    UPDATE bs_dc_rule SET device_id = ?, name = ?, rule_type = ?, expression = ?, params = ?,
                           enabled = ?, remark = ?, asp_user2 = ?, asp_time2 = SYSDATETIME()
                     WHERE id = ?
                    """,
                    deviceId, name, type, str(body.get("expression")), str(body.get("params")),
                    "N".equalsIgnoreCase(str(body.get("enabled"))) ? "N" : "Y", str(body.get("remark")), user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        return out;
    }

    public int deletePoint(int id, String user) {
        return jdbc.update("UPDATE bs_dc_point SET asp_cancel = 'Y', asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?", user, id);
    }

    public int deleteRule(int id, String user) {
        return jdbc.update("UPDATE bs_dc_rule SET asp_cancel = 'Y', asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?", user, id);
    }

    // ───────────────────────────── 数据监控 ─────────────────────────────

    /**
     * 实时数据:每台设备的每个采集点取最新一条采样(没有采样就 null,如实显示「无数据」)。
     * 同时给每台设备的有效状态与未处理报警数,前端据此画设备卡片 + 点位表。
     */
    public Map<String, Object> realtime() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT d.id AS device_id, d.code AS device_code, d.name AS device_name, d.device_type,
                       d.heartbeat_seconds, d.last_seen_at, d.status, d.enabled,
                       p.id AS point_id, p.code AS point_code, p.name AS point_name, p.unit,
                       p.low_limit, p.high_limit,
                       s.value_num, s.value_text, s.quality, s.collect_at
                  FROM bs_dc_device d
                  LEFT JOIN bs_dc_point p
                         ON p.device_id = d.id AND ISNULL(p.asp_cancel,'N') <> 'Y' AND p.enabled = 'Y'
                  OUTER APPLY (
                        SELECT TOP 1 x.value_num, x.value_text, x.quality, x.collect_at
                          FROM bs_dc_sample x
                         WHERE x.point_id = p.id AND ISNULL(x.asp_cancel,'N') <> 'Y'
                         ORDER BY x.collect_at DESC, x.id DESC
                  ) s
                 WHERE ISNULL(d.asp_cancel,'N') <> 'Y' AND d.enabled = 'Y'
                 ORDER BY d.device_type, d.code, p.sort_no, p.code
                """);
        Map<Integer, Map<String, Object>> devices = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            int deviceId = num(r.get("device_id"));
            Map<String, Object> dev = devices.computeIfAbsent(deviceId, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("deviceId", deviceId);
                m.put("deviceCode", r.get("device_code"));
                m.put("deviceName", r.get("device_name"));
                m.put("deviceType", r.get("device_type"));
                m.put("online", isOnline(r));
                m.put("effectiveStatus", effectiveStatus(r));
                m.put("lastSeenAt", wallClock(r.get("last_seen_at")));
                m.put("points", new ArrayList<Map<String, Object>>());
                m.put("alarmOpen", 0);
                return m;
            });
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> pts = (List<Map<String, Object>>) dev.get("points");
            if (r.get("point_id") != null) {
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("pointId", r.get("point_id"));
                p.put("pointCode", r.get("point_code"));
                p.put("pointName", r.get("point_name"));
                p.put("unit", r.get("unit"));
                p.put("lowLimit", r.get("low_limit"));
                p.put("highLimit", r.get("high_limit"));
                p.put("valueNum", r.get("value_num"));
                p.put("valueText", r.get("value_text"));
                p.put("quality", r.get("quality"));
                p.put("collectAt", r.get("collect_at"));
                p.put("over", isOver(r.get("low_limit"), r.get("high_limit"), r.get("value_num")));
                pts.add(p);
            }
        }
        for (Map<String, Object> dev : devices.values()) {
            Integer open = jdbc.queryForObject(
                    "SELECT COUNT(1) FROM bs_dc_alarm WHERE device_id = ? AND ISNULL(asp_cancel,'N') <> 'Y' AND state = N'未处理'",
                    Integer.class, dev.get("deviceId"));
            dev.put("alarmOpen", open == null ? 0 : open);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("devices", new ArrayList<>(devices.values()));
        out.put("alarmOpen", jdbc.queryForObject(
                "SELECT COUNT(1) FROM bs_dc_alarm WHERE ISNULL(asp_cancel,'N') <> 'Y' AND state = N'未处理'", Integer.class));
        out.put("serverTime", LocalDateTime.now().withNano(0).toString());
        return out;
    }

    /** 报警列表(分页;可按状态/级别/设备筛)。 */
    public Map<String, Object> alarms(String state, String level, Integer deviceId, int pageNo, int pageSize) {
        StringBuilder where = new StringBuilder(" WHERE ISNULL(a.asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        if (!blank(state)) {
            where.append(" AND a.state = ?");
            args.add(str(state));
        }
        if (!blank(level)) {
            where.append(" AND a.level = ?");
            args.add(str(level));
        }
        if (deviceId != null) {
            where.append(" AND a.device_id = ?");
            args.add(deviceId);
        }
        Integer total = jdbc.queryForObject("SELECT COUNT(1) FROM bs_dc_alarm a" + where, Integer.class, args.toArray());
        int offset = Math.max(0, (pageNo - 1) * pageSize);
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(offset);
        pageArgs.add(Math.max(1, pageSize));
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.device_id, d.code AS device_code, d.name AS device_name, a.point_id,
                       p.code AS point_code, p.name AS point_name, a.level, a.message, a.value_text,
                       a.occur_at, a.state, a.handled_by, a.handled_at, a.handled_note
                  FROM bs_dc_alarm a
                  LEFT JOIN bs_dc_device d ON d.id = a.device_id
                  LEFT JOIN bs_dc_point p ON p.id = a.point_id
                """ + where + " ORDER BY CASE WHEN a.state = N'未处理' THEN 0 ELSE 1 END, a.occur_at DESC "
                + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY", pageArgs.toArray());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total == null ? 0 : total);
        out.put("pageNo", pageNo);
        out.put("pageSize", pageSize);
        out.put("rows", rows);
        return out;
    }

    /** 处理报警:state 只能置「已处理」(未处理由硬件侧上报产生)。 */
    public int handleAlarm(int id, String user, String note) {
        return jdbc.update("""
                UPDATE bs_dc_alarm SET state = N'已处理', handled_by = ?, handled_at = SYSDATETIME(), handled_note = ?
                 WHERE id = ? AND ISNULL(asp_cancel,'N') <> 'Y'
                """, user, str(note), id);
    }

    // ───────────────────────────── 状态统计 ─────────────────────────────

    /**
     * 状态统计:
     * <ul>
     *   <li>current:{@code total/online/offline/disabled/onlineRate} —— 由心跳推算的**当前**状态;</li>
     *   <li>byType:按设备类型的在线/离线数;</li>
     *   <li>availability:窗口(默认 24h)内基于 bs_dc_status_log 的**可用率**;没有状态日志时
     *       返回 {@code null}(前端显示「暂无历史」,不编造数字)。</li>
     * </ul>
     */
    public Map<String, Object> statusStats(int hours) {
        int h = hours <= 0 ? 24 : Math.min(hours, 24 * 30);
        LocalDateTime to = LocalDateTime.now();
        LocalDateTime from = to.minusHours(h);

        List<Map<String, Object>> rows = deviceRows();
        int total = 0, online = 0, disabled = 0;
        Map<String, int[]> byType = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            if (!"Y".equalsIgnoreCase(str(r.get("enabled")))) {
                disabled++;
                continue;
            }
            total++;
            boolean on = isOnline(r);
            if (on) online++;
            String type = str(r.get("device_type"));
            int[] cell = byType.computeIfAbsent(type, k -> new int[2]);
            cell[0]++;
            if (on) cell[1]++;
        }
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("total", total);
        current.put("online", online);
        current.put("offline", total - online);
        current.put("disabled", disabled);
        current.put("onlineRate", total == 0 ? null : round1(online * 100.0 / total));

        List<Map<String, Object>> byTypeList = new ArrayList<>();
        for (Map.Entry<String, int[]> e : byType.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("deviceType", e.getKey());
            m.put("total", e.getValue()[0]);
            m.put("online", e.getValue()[1]);
            m.put("offline", e.getValue()[0] - e.getValue()[1]);
            m.put("onlineRate", round1(e.getValue()[1] * 100.0 / e.getValue()[0]));
            byTypeList.add(m);
        }

        // 窗口可用率:按设备折叠 bs_dc_status_log 的状态时长
        List<Map<String, Object>> logs = jdbc.queryForList("""
                SELECT l.device_id, d.code AS device_code, d.name AS device_name, d.device_type, l.status, l.changed_at
                  FROM bs_dc_status_log l
                  JOIN bs_dc_device d ON d.id = l.device_id
                 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND l.changed_at >= ?
                 ORDER BY l.device_id, l.changed_at
                """, java.sql.Timestamp.valueOf(from));

        Map<Integer, Map<String, Object>> perDevice = new LinkedHashMap<>();
        Map<Integer, Object[]> state = new LinkedHashMap<>();   // deviceId -> {当前状态, 自何时}
        for (Map<String, Object> lg : logs) {
            int deviceId = num(lg.get("device_id"));
            String st = "online".equalsIgnoreCase(str(lg.get("status"))) ? "online" : "offline";
            LocalDateTime at = toLocal(lg.get("changed_at"));
            if (at == null) continue;
            Object[] prev = state.get(deviceId);
            if (prev == null) {
                Map<String, Object> cell = perDevice.computeIfAbsent(deviceId, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("deviceId", deviceId);
                    m.put("deviceCode", lg.get("device_code"));
                    m.put("deviceName", lg.get("device_name"));
                    m.put("deviceType", lg.get("device_type"));
                    m.put("onlineMs", 0L);
                    m.put("offlineMs", 0L);
                    m.put("changes", 0);
                    return m;
                });
                cell.put("changes", num(cell.get("changes")) + 1);
            } else {
                String prevSt = String.valueOf(prev[0]);
                LocalDateTime prevAt = (LocalDateTime) prev[1];
                long ms = Math.max(0, Duration.between(prevAt, at).toMillis());
                Map<String, Object> cell = perDevice.get(deviceId);
                if ("online".equals(prevSt)) cell.put("onlineMs", (Long) cell.get("onlineMs") + ms);
                else cell.put("offlineMs", (Long) cell.get("offlineMs") + ms);
                cell.put("changes", num(cell.get("changes")) + 1);
            }
            state.put(deviceId, new Object[]{st, at});
        }
        long windowMs = Math.max(1, Duration.between(from, to).toMillis());
        for (Map.Entry<Integer, Object[]> e : state.entrySet()) {
            Map<String, Object> cell = perDevice.get(e.getKey());
            if (cell == null) continue;
            LocalDateTime prevAt = (LocalDateTime) e.getValue()[1];
            long ms = Math.max(0, Duration.between(prevAt, to).toMillis());
            if ("online".equals(e.getValue()[0])) cell.put("onlineMs", (Long) cell.get("onlineMs") + ms);
            else cell.put("offlineMs", (Long) cell.get("offlineMs") + ms);
        }
        long sumOnline = 0;
        List<Map<String, Object>> availability = new ArrayList<>();
        for (Map<String, Object> cell : perDevice.values()) {
            long on = (Long) cell.remove("onlineMs");
            long off = (Long) cell.remove("offlineMs");
            sumOnline += on;
            cell.put("onlineMs", on);
            cell.put("offlineMs", off);
            cell.put("availability", round1(on * 100.0 / windowMs));
            availability.add(cell);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from.withNano(0).toString());
        out.put("to", to.withNano(0).toString());
        out.put("hours", h);
        out.put("current", current);
        out.put("byType", byTypeList);
        out.put("overallAvailability", perDevice.isEmpty() ? null : round1(sumOnline * 100.0 / (windowMs * perDevice.size())));
        out.put("availability", availability);
        out.put("statusChanges", logs.size());
        return out;
    }

    // ───────────────────────────── 硬件侧接入 ─────────────────────────────

    /**
     * 硬件上报一条采集值:
     * body = {deviceCode, pointCode(或 pointId), value(数值) | text(文本), quality?, at?(ISO 时间)}。
     * 副作用:写 bs_dc_sample、刷新设备在线状态与 last_debug_at(收到数据=调试通过)、
     *        数值越过采集点上下限则写一条 bs_dc_alarm(state=未处理)。
     */
    public Map<String, Object> ingest(Map<String, Object> body, String key) {
        Map<String, Object> device = requireGatewayKey(str(body.get("deviceCode")), key);
        int deviceId = num(device.get("id"));
        String pointCode = str(body.get("pointCode"));
        Integer pointId = intOrNull(body.get("pointId"));
        Map<String, Object> point;
        if (pointId != null) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, code, name, unit, low_limit, high_limit FROM bs_dc_point WHERE id = ? AND device_id = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    pointId, deviceId);
            if (rows.isEmpty()) throw new IllegalArgumentException("采集点不属于该设备：" + pointId);
            point = rows.get(0);
        } else if (!pointCode.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList("""
                    SELECT id, code, name, unit, low_limit, high_limit FROM bs_dc_point
                     WHERE device_id = ? AND code = ? AND ISNULL(asp_cancel,'N') <> 'Y'
                    """, deviceId, pointCode);
            if (rows.isEmpty()) throw new IllegalArgumentException("采集点不存在：" + pointCode);
            point = rows.get(0);
        } else {
            throw new IllegalArgumentException("缺少采集点(pointCode 或 pointId)");
        }
        BigDecimal valueNum = decOrNull(body.get("value"));
        String valueText = blank(body.get("text")) ? null : str(body.get("text"));
        if (valueNum == null && valueText == null) throw new IllegalArgumentException("缺少采集值(value 或 text)");
        LocalDateTime at = blank(body.get("at")) ? LocalDateTime.now() : LocalDateTime.parse(str(body.get("at")));
        String quality = blank(body.get("quality")) ? "G" : str(body.get("quality")).substring(0, 1).toUpperCase();

        jdbc.update("""
                INSERT INTO bs_dc_sample (device_id, point_id, value_num, value_text, quality, collect_at, asp_user1, asp_time1)
                VALUES (?,?,?,?,?,?, N'ingest', SYSDATETIME())
                """, deviceId, point.get("id"), valueNum, valueText, quality, java.sql.Timestamp.valueOf(at));

        touchOnline(deviceId, at, "采集上报");
        boolean over = isOver(point.get("low_limit"), point.get("high_limit"), valueNum);
        if (over) {
            String msg = String.format("%s(%s) 采集值 %s 超出限值 [%s, %s]",
                    point.get("name"), point.get("code"), valueNum == null ? valueText : valueNum.toPlainString(),
                    point.get("low_limit") == null ? "-" : point.get("low_limit"),
                    point.get("high_limit") == null ? "-" : point.get("high_limit"));
            jdbc.update("""
                    INSERT INTO bs_dc_alarm (device_id, point_id, level, message, value_text, occur_at, state, asp_user1, asp_time1)
                    VALUES (?,?,?,?,?,?,N'未处理', N'ingest', SYSDATETIME())
                    """, deviceId, point.get("id"), "预警", msg,
                    valueNum == null ? valueText : valueNum.toPlainString(), java.sql.Timestamp.valueOf(at));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceId", deviceId);
        out.put("pointId", point.get("id"));
        out.put("collectAt", at.toString());
        out.put("overLimit", over);
        return out;
    }

    /** 硬件心跳:body = {deviceCode};刷新在线状态(在线/离线切换会写 bs_dc_status_log)。 */
    public Map<String, Object> heartbeat(Map<String, Object> body, String key) {
        Map<String, Object> device = requireGatewayKey(str(body.get("deviceCode")), key);
        int deviceId = num(device.get("id"));
        LocalDateTime at = LocalDateTime.now();
        touchOnline(deviceId, at, "心跳");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceId", deviceId);
        out.put("status", "online");
        out.put("at", at.withNano(0).toString());
        return out;
    }

    /**
     * 硬件侧鉴权:设备必须已绑定网关,且请求头 X-DC-Key = 该网关 api_key(非空)。
     * 这些请求没有登录态(SecurityConfig 对这两条路径 permitAll),所以密钥是唯一凭据。
     */
    private Map<String, Object> requireGatewayKey(String deviceCode, String key) {
        if (deviceCode.isEmpty()) throw new IllegalArgumentException("缺少 deviceCode");
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT d.id, d.code, ISNULL(g.api_key, N'') AS api_key, ISNULL(g.enabled,'N') AS gw_enabled,
                       ISNULL(g.asp_cancel,'N') AS gw_cancel
                  FROM bs_dc_device d
                  LEFT JOIN bs_dc_gateway g ON g.id = d.gateway_id
                 WHERE d.code = ? AND ISNULL(d.asp_cancel,'N') <> 'Y'
                """, deviceCode);
        if (rows.isEmpty()) throw new IllegalArgumentException("设备不存在：" + deviceCode);
        Map<String, Object> r = rows.get(0);
        String expect = str(r.get("api_key"));
        if (expect.isEmpty()) throw new IllegalArgumentException("设备未绑定网关或网关未配置接入密钥：" + deviceCode);
        if (!"Y".equalsIgnoreCase(str(r.get("gw_enabled"))) || "Y".equalsIgnoreCase(str(r.get("gw_cancel")))) {
            throw new IllegalArgumentException("设备所绑网关已停用：" + deviceCode);
        }
        if (blank(key) || !expect.equals(str(key))) throw new IllegalArgumentException("接入密钥不正确");
        return r;
    }

    /** 刷新设备在线状态;状态变化写日志(在线率的历史依据)。 */
    private void touchOnline(int deviceId, LocalDateTime at, String reason) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL(status,'offline') AS status FROM bs_dc_device WHERE id = ?", deviceId);
        String prev = rows.isEmpty() ? "offline" : str(rows.get(0).get("status"));
        jdbc.update("""
                UPDATE bs_dc_device SET status = N'online', last_seen_at = ?, last_debug_at = ?,
                       asp_user2 = N'ingest', asp_time2 = SYSDATETIME()
                 WHERE id = ?
                """, java.sql.Timestamp.valueOf(at), java.sql.Timestamp.valueOf(at), deviceId);
        if (!"online".equalsIgnoreCase(prev)) logStatus(deviceId, "online", at, reason);
        // 网关随设备上报刷新(2026-10-18):原先只有设备在线、网关永远显示「离线 / 最近上报 -」,
        // 设备卡片与网关表自相矛盾。上报经过网关才到得了 MES,故同一时刻把网关也标在线。
        jdbc.update("""
                UPDATE bs_dc_gateway SET status = N'online', last_seen_at = ?,
                       asp_user2 = N'ingest', asp_time2 = SYSDATETIME()
                 WHERE id = (SELECT gateway_id FROM bs_dc_device WHERE id = ?) AND ISNULL(asp_cancel,'N') <> 'Y'
                """, java.sql.Timestamp.valueOf(at), deviceId);
    }

    private void logStatus(int deviceId, String status, LocalDateTime at, String reason) {
        jdbc.update("""
                INSERT INTO bs_dc_status_log (device_id, status, changed_at, reason, asp_user1, asp_time1)
                VALUES (?,?,?,?, N'ingest', SYSDATETIME())
                """, deviceId, status, java.sql.Timestamp.valueOf(at), reason);
    }

    // ───────────────────────────── 工具方法 ─────────────────────────────

    /** 有效状态:停用 ⇒ disabled;有心跳且在窗口内 ⇒ online;否则 offline。 */
    private String effectiveStatus(Map<String, Object> row) {
        if (!"Y".equalsIgnoreCase(str(row.get("enabled")))) return "disabled";
        return isOnline(row) ? "online" : "offline";
    }

    /** 在线判定:last_seen_at 距今 ≤ max(心跳 × 3, 180s)。 */
    private boolean isOnline(Map<String, Object> row) {
        LocalDateTime seen = toLocal(row.get("last_seen_at"));
        if (seen == null) return false;
        int hb = row.get("heartbeat_seconds") == null ? 60 : num(row.get("heartbeat_seconds"));
        long window = Math.max((long) hb * OFFLINE_MULTIPLIER, OFFLINE_MIN_SECONDS);
        return Duration.between(seen, LocalDateTime.now()).getSeconds() <= window;
    }

    private boolean isOver(Object low, Object high, Object value) {
        if (value == null) return false;
        BigDecimal v = decOrNull(value);
        if (v == null) return false;
        BigDecimal lo = decOrNull(low);
        BigDecimal hi = decOrNull(high);
        return (lo != null && v.compareTo(lo) < 0) || (hi != null && v.compareTo(hi) > 0);
    }

    private static LocalDateTime toLocal(Object o) {
        if (o == null) return null;
        if (o instanceof LocalDateTime ldt) return ldt;
        if (o instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        if (o instanceof java.time.OffsetDateTime odt) return odt.toLocalDateTime();
        if (o instanceof java.util.Date d) return java.sql.Timestamp.valueOf(new java.sql.Timestamp(d.getTime()).toLocalDateTime()).toLocalDateTime();
        return LocalDateTime.now();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /** 时间列按本地墙钟字符串下发(Timestamp 直传会被序列化成 UTC,界面早 8 小时)。 */
    private static String wallClock(Object o) {
        LocalDateTime t = toLocal(o);
        return t == null ? null : t.withNano(0).toString();
    }

    private static boolean blank(Object o) {
        return o == null || String.valueOf(o).trim().isEmpty();
    }

    private static String defaultIfBlank(Object o, String def) {
        return blank(o) ? def : String.valueOf(o).trim();
    }

    private static int num(Object o) {
        return o instanceof Number n ? n.intValue() : (blank(o) ? 0 : Integer.parseInt(String.valueOf(o).trim()));
    }

    private static Integer intOr(Object o, int def) {
        Integer v = intOrNull(o);
        return v == null ? def : v;
    }

    private static Integer intOrNull(Object o) {
        if (blank(o)) return null;
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal decOrNull(Object o) {
        if (blank(o)) return null;
        if (o instanceof BigDecimal b) return b;
        if (o instanceof Number n) return new BigDecimal(n.toString());
        try {
            return new BigDecimal(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
