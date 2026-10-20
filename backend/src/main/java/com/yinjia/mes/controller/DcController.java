package com.yinjia.mes.controller;

import com.yinjia.mes.service.DcPlatformService;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 数采平台(bs_dc_* 七张表)—— 用户 2026-10-18「把数采平台管理模块加进系统,方便后续硬件接入」。
 *
 * <p>三个功能各一组接口:
 * <ol>
 *   <li><b>设备配置管理</b> {@code GET /config} + 网关/设备/调试的写接口;</li>
 *   <li><b>数据监控</b> {@code GET /monitor} + {@code POST /alarm/handle};</li>
 *   <li><b>状态统计</b> {@code GET /stats}。</li>
 * </ol>
 *
 * <p><b>权限</b>:五连配置与网关维护属于"改系统参数",一律 {@link PanelPermissionService#requireAdmin()}
 * (管理员恒过)。前端三页本身对所有登录用户可见(只读看数据),DcConfig.vue 额外按
 * {@code user.isAdmin} 隐藏写按钮(两层:前端只减少误点,真正的闸门在这里) ——
 * 越权由这里拦,{@code GlobalExceptionHandler} 归一成 HTTP 200 + body code 403。
 * 报警处理只要求登录态(车间任何人都能认领报警)。
 *
 * <p><b>硬件侧</b>:{@code POST /ingest} 与 {@code POST /heartbeat} 在 SecurityConfig 里 permitAll
 * (网关/电子秤没有登录账号),鉴权靠请求头 {@code X-DC-Key} = 设备所绑网关的 api_key,
 * 校验在 {@code DcService.requireGatewayKey},非空才放行。
 *
 * <p><b>数据真实性</b>:没有硬件上报就是"离线 / 无数据 / 未配置",接口不编造任何演示数字
 * (沿用用户 2026-10-18 对看板的口径)。接通硬件前可用
 * {@code tools/archive/_dc-ingest/} 下的模拟上报脚本自测。
 */
@RestController
@RequestMapping("/api/dc")
public class DcController {

    private final DcPlatformService dcPlatform;
    private final PanelPermissionService perm;
    /** 文本上报口复用它的单点写入(采样/在线/越限报警同一条链路,不另写一份) */
    private final com.yinjia.mes.service.DcService dc;
    /**
     * 文本口节流(2026-10-19 用户口径「1 秒抓一次,空重量不抓」):
     * deviceCode → 上次写入的时间戳(ms)。秤开连续发送后会 5~10Hz 地发,不节流会把流水刷爆。
     */
    private static final java.util.concurrent.ConcurrentHashMap<String, Long> LAST_TEXT_WRITE =
            new java.util.concurrent.ConcurrentHashMap<>();
    /** 最小写入间隔(ms)—— 1 秒一条 */
    private static final long TEXT_MIN_INTERVAL_MS = 1000L;
    /** 空重量阈值(kg):≤ 这个值视为空秤,不记流水(留 5g 容差,避免零点漂移也算"有重量") */
    private static final double TEXT_MIN_WEIGHT_KG = 0.005;

    public DcController(DcPlatformService dcPlatform, PanelPermissionService perm,
                        com.yinjia.mes.service.DcService dc) {
        this.dcPlatform = dcPlatform;
        this.perm = perm;
        this.dc = dc;
    }

    // ───────────────────────────── ① 设备配置管理 ─────────────────────────────

    /**
     * 设备配置管理页:五连检查(KPI + 设备表 + 网关表)。只读,登录即可。
     * 返回 {kpis{deviceTotal,gatewayBound,fullyReady}, gateways[], devices[]}。
     */
    @GetMapping("/config")
    public Map<String, Object> config() {
        // 2026-10-20 权限化:三页此前**没有面板码**(菜单无 panelCode ⇒ filterMenuTree 放行),
        //   权限矩阵里也勾不到。现挂页面级虚拟面板码(定义见 PagePanelRegistry),读侧按 view 词拦;
        //   写操作仍是 requireAdmin(管理员恒过) —— 两层各管一件事。
        perm.requirePanelView("DC_CONFIG");
        return ok(dcPlatform.config());
    }

    /** 新增/修改网关。apiKey 不传 = 保持原密钥(前端不回显密钥),传空串 = 清除。 */
    @PostMapping("/gateway/save")
    public Map<String, Object> saveGateway(@RequestBody(required = false) Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.saveGateway(body == null ? Map.of() : body, currentUser()));
    }

    /** 删除网关:挂在其上的设备自动解绑(gateway_id = NULL),返回被解绑的数量。 */
    @PostMapping("/gateway/delete")
    public Map<String, Object> deleteGateway(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.deleteGateway(idOf(body, "网关"), currentUser()));
    }

    /**
     * 新增/修改设备。body 用前端字段名:
     * {id?, code, name, type(设备类型), model, serialNo, gatewayId, ip, port, protocol,
     *  workshop, projectCode, scadaDrawn(布尔), heartbeatSeconds, enabled, remark}。
     * 前端写 {@code type} / 布尔 {@code scadaDrawn},服务层吃 {@code deviceType} / 'Y'|'N',
     * 转换在 {@link DcPlatformService#saveDevice}。
     */
    @PostMapping("/device/save")
    public Map<String, Object> saveDevice(@RequestBody(required = false) Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.saveDevice(body == null ? Map.of() : body, currentUser()));
    }

    /** 删除设备(软删,采样/报警历史保留)。 */
    @PostMapping("/device/delete")
    public Map<String, Object> deleteDevice(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.deleteDevice(idOf(body, "设备"), currentUser()));
    }

    /** 人工标记「数据调试通过」——没有硬件时先登记这一项,接了硬件后由 ingest 自动写。 */
    @PostMapping("/device/debug")
    public Map<String, Object> debugDevice(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.markDebug(idOf(body, "设备"), currentUser()));
    }

    /**
     * 采集点列表(GET /api/dc/points?deviceId=)。采集点是硬件上报的前置:
     * ingest 报文里的 pointCode 必须在这里登记过,否则报「采集点不存在」。
     */
    @GetMapping("/points")
    public Map<String, Object> points(@RequestParam(required = false) Integer deviceId) {
        perm.requirePanelView("DC_CONFIG");
        return ok(dcPlatform.points(deviceId));
    }

    /** 新增/修改采集点。body {id?, deviceId, code, name, dataType, unit, addr, freqSeconds, lowLimit, highLimit, sortNo, remark}。 */
    @PostMapping("/point/save")
    public Map<String, Object> savePoint(@RequestBody(required = false) Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.savePoint(body == null ? Map.of() : body, currentUser()));
    }

    /** 删除采集点(软删,历史采样保留)。 */
    @PostMapping("/point/delete")
    public Map<String, Object> deletePoint(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.deletePoint(idOf(body, "采集点"), currentUser()));
    }

    /** 数采规则列表(GET /api/dc/rules?deviceId=)。 */
    @GetMapping("/rules")
    public Map<String, Object> rules(@RequestParam(required = false) Integer deviceId) {
        perm.requirePanelView("DC_CONFIG");
        return ok(dcPlatform.rules(deviceId));
    }

    /** 新增/修改数采规则。body {id?, deviceId, name, ruleType, expression, params, enabled(布尔), remark}。 */
    @PostMapping("/rule/save")
    public Map<String, Object> saveRule(@RequestBody(required = false) Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.saveRule(body == null ? Map.of() : body, currentUser()));
    }

    /** 删除规则(软删)。 */
    @PostMapping("/rule/delete")
    public Map<String, Object> deleteRule(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        return ok(dcPlatform.deleteRule(idOf(body, "规则"), currentUser()));
    }

    // ───────────────────────────── ② 数据监控 ─────────────────────────────

    /**
     * 数据监控页:实时采集值 + 报警。deviceId 省略 ⇒ 取第一台启用的设备。
     * 返回 {deviceId, devices[], points[], alarms[], alarmOpen, serverTime};
     * 没有采样时 points 为真值空(status 不会是 normal),不造数。
     */
    @GetMapping("/monitor")
    public Map<String, Object> monitor(@RequestParam(required = false) Integer deviceId) {
        perm.requirePanelView("DC_MONITOR");
        return ok(dcPlatform.monitor(deviceId));
    }

    /** 处理报警(任何人可认领):body {id, note}。 */
    @PostMapping("/alarm/handle")
    public Map<String, Object> handleAlarm(@RequestBody Map<String, Object> body) {
        return ok(dcPlatform.handleAlarm(idOf(body, "报警"), str(body.get("note")), currentUser()));
    }

    // ───────────────────────────── ③ 状态统计 ─────────────────────────────

    /**
     * 状态统计页:在线/离线数量、按设备在线率、在线趋势、报警分布。
     * from/to 为 yyyy-MM-dd(省略 ⇒ 近 30 天)。可用率来自 bs_dc_status_log,
     * 没有状态日志时 overallAvailability 为 null(前端显示「暂无历史」)。
     */
    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam(required = false) String from,
                                     @RequestParam(required = false) String to) {
        perm.requirePanelView("DC_STATS");
        return ok(dcPlatform.stats(from, to));
    }

    // ───────────────────────────── 硬件侧接入(免登录,凭 X-DC-Key) ─────────────────────────────

    /**
     * 硬件批量上报:{gatewayCode?, deviceCode, values:[{pointCode, value}]}。
     * 鉴权:请求头 X-DC-Key 必须等于该设备所绑网关的 api_key。
     */
    @PostMapping("/ingest")
    public Map<String, Object> ingest(@RequestBody(required = false) Map<String, Object> body,
                                      @RequestHeader(value = "X-DC-Key", required = false) String key) {
        return ok(dcPlatform.ingestBatch(body == null ? Map.of() : body, key));
    }

    /**
     * **文本上报口**(2026-10-19):给「W111 无线透传模块」这类只能把串口原始串发出来的硬件用 ——
     * 它拼不出 MES 要求的 JSON({deviceCode, values[]}),但能发 GET/POST 的 url + 自定义头。
     *
     * <p>支持的取数位置(任填一种即可,按顺序):
     * <ol>
     *   <li>查询串 {@code data} / {@code v} / {@code value};</li>
     *   <li>POST 正文(模块 HTPC 模式下一般为串口帧原文);</li>
     *   <li>整个请求行(模块 GET 模式可能把串口数据拼在 URL 后面)。</li>
     * </ol>
     * 设备号取 {@code device} / {@code deviceCode} 查询参数,或请求头 {@code X-DC-Device}(默认 DZ-001);
     * 鉴权与 JSON 口一致:{@code X-DC-Key} 必须等于该设备所绑网关的 api_key。
     *
     * <p>重量解析口径与现场实测一致:先按「净重6位紧跟皮重6位 + kg」(如 {@code +000.39000.00kg}),
     * 再退回「第一个带小数的数」(兼容 ST,GS / wn+00.52kg 等机型)。
     */
    @org.springframework.web.bind.annotation.RequestMapping(value = "/ingest/text",
            method = { org.springframework.web.bind.annotation.RequestMethod.GET,
                       org.springframework.web.bind.annotation.RequestMethod.POST })
    public Map<String, Object> ingestText(@RequestParam(required = false) String device,
                                          @RequestParam(required = false) String deviceCode,
                                          @RequestParam(required = false) String data,
                                          @RequestParam(required = false) String v,
                                          @RequestParam(required = false) String value,
                                          @RequestParam(required = false) String point,
                                          @RequestParam(required = false) String pointCode,
                                          jakarta.servlet.http.HttpServletRequest request) {
        String dev = str(device);
        if (dev.isEmpty()) dev = str(deviceCode);
        if (dev.isEmpty()) dev = str(request.getHeader("X-DC-Device"));
        if (dev.isEmpty()) dev = "DZ-001";
        String raw = !str(data).isEmpty() ? str(data) : !str(v).isEmpty() ? str(v) : str(value);
        if (raw.isEmpty()) {
            try {
                raw = new String(request.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            } catch (java.io.IOException ignored) { /* 读不到正文就退回请求行 */ }
        }
        if (raw.isBlank()) raw = request.getQueryString() == null ? "" : request.getQueryString();
        if (raw.isBlank()) raw = request.getRequestURI();
        Double kg = parseWeightText(raw);
        if (kg == null) throw new IllegalArgumentException("报文里没解析出重量：" + raw);
        String pt = !str(pointCode).isEmpty() ? str(pointCode) : (!str(point).isEmpty() ? str(point) : "W01");
        // 闸①:空重量不记(用户口径「空重量不抓」)
        //   ⚠ 但仍刷新一次在线心跳:秤开着连续发送、台面一直空着时,若连心跳都不刷,
        //     设备会被判「离线」(3 分钟阈值),看着像是断线,其实是"空秤不记流水"。
        if (Math.abs(kg) <= TEXT_MIN_WEIGHT_KG) {
            try { dc.heartbeat(new java.util.HashMap<>(java.util.Map.of("deviceCode", dev)),
                    request.getHeader("X-DC-Key")); } catch (RuntimeException ignored) { }
            java.util.Map<String, Object> skip = new java.util.LinkedHashMap<>();
            skip.put("deviceCode", dev);
            skip.put("weight", kg);
            skip.put("raw", raw.length() > 120 ? raw.substring(0, 120) : raw);
            skip.put("skipped", "空重量(≤" + TEXT_MIN_WEIGHT_KG + "kg)不记流水");
            return ok(skip);
        }
        // 闸②:同一设备 1 秒最多一条(用户口径「1 秒抓一次」;秤连续发送时其余帧丢弃)
        long nowMs = System.currentTimeMillis();
        Long prev = LAST_TEXT_WRITE.get(dev);
        if (prev != null && nowMs - prev < TEXT_MIN_INTERVAL_MS) {
            java.util.Map<String, Object> skip = new java.util.LinkedHashMap<>();
            skip.put("deviceCode", dev);
            skip.put("weight", kg);
            skip.put("raw", raw.length() > 120 ? raw.substring(0, 120) : raw);
            skip.put("skipped", "距上次写入不足 " + TEXT_MIN_INTERVAL_MS + "ms,丢弃该帧");
            return ok(skip);
        }
        LAST_TEXT_WRITE.put(dev, nowMs);
        java.util.Map<String, Object> one = new java.util.LinkedHashMap<>();
        one.put("deviceCode", dev);
        one.put("pointCode", pt);
        one.put("value", kg);
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("deviceCode", dev);
        out.put("weight", kg);
        out.put("raw", raw.length() > 120 ? raw.substring(0, 120) : raw);
        out.put("result", dc.ingest(one, request.getHeader("X-DC-Key")));
        return ok(out);
    }

    /**
     * 串口帧里的重量:先按「符号+净重(1~2位小数) + 皮重(可选) + kg」精确匹配(现场 +000.39000.00kg),
     * 否则退回通用规则(第一个带小数点的数,或末尾整数)。
     */
    private static Double parseWeightText(String raw) {
        String s = raw == null ? "" : raw.replace('\r', ' ').replace('\n', ' ').trim();
        // ① 现场格式:+000.39000.00kg(净重紧跟皮重,中间无分隔符)
        java.util.regex.Matcher exact = java.util.regex.Pattern
                .compile("([+-]?\\d{1,4}\\.\\d{1,2})(?:[+-]?\\d{1,4}\\.\\d{1,2})?\\s*(?:kg|KG|g|G)?")
                .matcher(s);
        if (exact.find()) {
            try { return Double.parseDouble(exact.group(1)); } catch (NumberFormatException ignored) { }
        }
        // ② 通用:第一个带小数点的数(ST,GS,+ 0.520kg / wn+00.520kg)
        java.util.regex.Matcher any = java.util.regex.Pattern.compile("(-?\\d{1,4}\\.\\d{1,3})").matcher(s);
        if (any.find()) {
            try { return Double.parseDouble(any.group(1)); } catch (NumberFormatException ignored) { }
        }
        // ③ 兜底:末尾整数(如 "+12kg")
        java.util.regex.Matcher whole = java.util.regex.Pattern.compile("(-?\\d{1,4})\\s*(?:kg|KG|g|G)?\\s*$").matcher(s);
        if (whole.find()) {
            try { return Double.parseDouble(whole.group(1)); } catch (NumberFormatException ignored) { }
        }
        return null;
    }

    /** 硬件心跳:{deviceCode};刷新在线状态(在线/离线切换会写 bs_dc_status_log)。 */
    @PostMapping("/heartbeat")
    public Map<String, Object> heartbeat(@RequestBody(required = false) Map<String, Object> body,
                                         @RequestHeader(value = "X-DC-Key", required = false) String key) {
        return ok(dcPlatform.heartbeat(body == null ? Map.of() : body, key));
    }

    // ───────────────────────────── 工具方法 ─────────────────────────────

    private static Map<String, Object> ok(Object data) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", 200);
        out.put("message", "success");
        out.put("data", data);
        return out;
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }

    /** 取 body 里的 id,缺失即报中文错(带上被操作对象名,前端直接弹 message)。 */
    private static int idOf(Map<String, Object> body, String label) {
        Object v = body == null ? null : body.get("id");
        if (v == null || String.valueOf(v).isBlank()) throw new IllegalArgumentException("缺少" + label + "编号 id");
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(label + "编号格式不正确：" + v);
        }
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
