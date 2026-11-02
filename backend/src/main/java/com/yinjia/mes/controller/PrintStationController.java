package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * 自动打印站点 + 打印任务队列(2026-10-30)。
 *
 * <h3>用户口径(原话)</h3>
 * 「关于打印还有单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数并且设置成打开,
 *  然后在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」。
 * 二次确认:「采用2的方式(写本地打印代理),但是不是所有登录这个系统的电脑都打印,
 *  需要做个设置(来配置需要用到打印的电脑,实现连接的电脑自动打印)」。
 *
 * <h3>架构:手机只管"发",这台电脑只管"取"</h3>
 * <pre>
 *   手机(生产领料单据)               服务端(本类)              打印站点电脑(PrintStation.vue + 本地代理)
 *   POST /enqueue  ──── 任务 ────▶  [内存队列]  ◀──── 轮询 /pending ────  取出 → 交本地代理静默出纸
 *                                      ▲                                      │
 *                                      └──────── /ack(已打印)◀────────────────┘
 * </pre>
 *
 * <h3>为什么队列在内存里,不进数据库</h3>
 * <ul>
 *   <li>打印任务是**秒级时效**的东西(领完料立刻出工单二维码),堆积下来反而错乱;
 *       服务端重启丢掉的几条,现场重打一次即可(单据上就有「打印」按钮);</li>
 *   <li>打印任务里含产品名/工单号,落库会与「打印留痕」这件正经事混在一起
 *       (留痕已经在 {@code wo_pick_doc.打印次数} 里,真正需要追溯的是那个);</li>
 *   <li>队列只保留最近 {@link #MAX_TASKS} 条,超了挤掉最旧的 —— 内存不会无限涨。</li>
 * </ul>
 *
 * <h3>为什么"哪台电脑在打印"不进库</h3>
 * 打印机名/站点名是**每台电脑各自的**(一个账号可能登录多台电脑),存库里就变成"一台盖住所有"。
 * 故本机配置在浏览器 localStorage(PrintStation.vue),库里只留 3 个全局参数:
 * {@code print.auto_enabled / print.station_name / print.last_heartbeat}。
 */
@RestController
@RequestMapping("/api/px/print")
public class PrintStationController {

    private static final Logger log = LoggerFactory.getLogger(PrintStationController.class);
    private static final String PANEL_SELF = PagePanelRegistry.PRINT_STATION;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 队列上限:只保留最近这么多条,超了挤掉最旧的(内存安全) */
    private static final int MAX_TASKS = 200;
    /** 心跳多久算"在线"(秒)。打印站点页每 15 秒刷新一次,留 3 个周期容错 */
    private static final long ONLINE_SECONDS = 90;

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;

    /** 打印任务队列:id 自增;一台站点取了就从队列移走(不重复出纸) */
    private static final ConcurrentLinkedQueue<PrintTask> QUEUE = new ConcurrentLinkedQueue<>();
    /** 已出纸记录(只用于概览显示"刚打印了什么"),同样有上限 */
    private static final Deque<PrintTask> DONE = new ArrayDeque<>();
    private static final java.util.concurrent.atomic.AtomicLong SEQ = new java.util.concurrent.atomic.AtomicLong(1);

    /** 一条打印任务(不可变;取走即出队) */
    private record PrintTask(long id, String 标题, String 二维码内容, String 工单号, int 工单行号,
                             String 产品名称, String 规格型号, String 来源, String 发起人, String 时间,
                             // 二维码 PNG 的 dataURL(base64)。前端用 qrcode 库生成后随任务送上来,
                             // 打印电脑直接贴进标签/PDF —— 代理是纯 PowerShell,自己画 QR 不现实。
                             String 二维码图) {
        Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("标题", 标题);
            m.put("二维码内容", 二维码内容);
            m.put("二维码图", 二维码图);
            m.put("工单号", 工单号);
            m.put("工单行号", 工单行号);
            m.put("产品名称", 产品名称);
            m.put("规格型号", 规格型号);
            m.put("来源", 来源);
            m.put("发起人", 发起人);
            m.put("时间", 时间);
            return m;
        }
    }

    public PrintStationController(JdbcTemplate jdbc, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.perm = perm;
    }

    // ══════════════════════════ 手机端:发任务 ══════════════════════════

    /**
     * 手机端点「打印」→ 把任务放进队列,由在线的打印站点电脑取走静默出纸。
     *
     * <p>用户口径「在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」。
     * 没有在线站点时**不报错**,返回 {@code online:false} —— 前端据此降级为手机自带打印层打印,
     * 现场至少还能打出来,不会因为"打印电脑没开"就卡住生产。
     *
     * @param body {标题, 二维码内容(或 工单号+工单行号), 产品名称, 规格型号, 来源}
     */
    @PostMapping("/enqueue")
    public ApiResult<Map<String, Object>> enqueue(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        boolean online = isStationOnline();
        Map<String, Object> m = new LinkedHashMap<>();

        // 没开自动打印 / 没有在线站点 ⇒ 只回状态,不入队(否则任务会在队列里躺到天荒地老)
        if (!autoEnabled() || !online) {
            m.put("online", false);
            m.put("queued", false);
            m.put("reason", !autoEnabled() ? "auto-disabled" : "no-station");
            m.put("message", !autoEnabled()
                    ? "自动打印没打开:请在打印电脑上打开「自动打印」页面并开启开关"
                    : "没有在线的打印电脑:请确认那台电脑上「自动打印」页面开着");
            return ApiResult.ok(m);
        }

        String woNo = str(body.get("工单号"));
        int line = toInt(body.get("工单行号"));
        String qr = str(body.get("二维码内容"));
        if (qr.isEmpty() && !woNo.isEmpty()) {
            // 与 print-formats.woQrText 同口径:公司代码@工单号@(1000+行号);公司代码全库为 '0'
            qr = "0@" + woNo + "@" + (1000 + Math.max(1, line));
        }
        if (qr.isEmpty()) throw new IllegalArgumentException("打印内容为空:请提供二维码内容或工单号");

        // 🔴 2026-11-01 后端兜底出图。
        //
        // 正常路径是**前端**用 qrcode 库渲好 dataURL 随任务送上来(与工单打印同一份算法)。
        // 但现场一定会有"客户端是旧版"的情况 —— 旧 APK、浏览器缓存了旧 chunk —— 那时
        // `二维码图` 为空,打出来就是一张没有码的标签(用户实测报障:PDF 里没二维码)。
        // ⇒ 这里用 ZXing(pom 里已有,报表 QRCode 在用)自己补一张,**任何客户端都能出图**。
        // 码的内容与前端完全一致(同一个 qr 字符串),所以不存在"两个码不一样"的问题。
        String qrImg = str(body.get("二维码图"));
        if (qrImg.isEmpty()) qrImg = qrDataUrl(qr);

        PrintTask t = new PrintTask(SEQ.getAndIncrement(), str1(body.get("标题"), "生产领料单"),
                qr, woNo, line, str(body.get("产品名称")), str(body.get("规格型号")),
                str1(body.get("来源"), "mobile"), currentUserName(), LocalDateTime.now().format(TS),
                qrImg);
        QUEUE.add(t);
        // 上限保护:超了挤掉最旧的(内存安全;现场重打一次即可)
        while (QUEUE.size() > MAX_TASKS) QUEUE.poll();

        m.put("online", true);
        m.put("queued", true);
        m.put("taskId", t.id());
        m.put("station", stationName());
        m.put("message", "已发送到打印电脑「" + stationNameOrDefault() + "」");
        return ApiResult.ok(m);
    }

    // ══════════════════════════ 打印站点电脑:取任务 / 回报 ══════════════════════════

    /**
     * 打印站点页轮询:取一条待打印任务(**取走即出队**,不会两台电脑打同一张)。
     *
     * <p>同时刷新 {@code print.last_heartbeat} —— 手机端就是靠它判断"有没有在线的打印电脑"。
     *
     * @return {task:{...}} 或 {task:null}(没任务)
     */
    @GetMapping("/pending")
    public ApiResult<Map<String, Object>> pending(@RequestParam(required = false) String station) {
        perm.requirePanelView(PANEL_SELF);
        touchHeartbeat(station);

        PrintTask t = QUEUE.poll();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("task", t == null ? null : t.json());
        out.put("queueSize", QUEUE.size());
        out.put("autoEnabled", autoEnabled());
        return ApiResult.ok(out);
    }

    /**
     * 打印站点页回报"这张已出纸"(或失败)。
     *
     * @param body {taskId, ok:true/false, error?:文案, printer?:打印机名}
     */
    @PostMapping("/ack")
    public ApiResult<Void> ack(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        long id = toLong(body.get("taskId"));
        boolean ok = !Boolean.FALSE.equals(body.get("ok"));
        String printer = str(body.get("printer"));
        if (!ok) {
            log.warn("打印站点出纸失败 task={} printer={} error={}", id, printer, str(body.get("error")));
        }
        // 最近出纸记录(概览显示用),同样有上限
        synchronized (DONE) {
            DONE.addFirst(new PrintTask(id, str(body.get("标题")), "", str(body.get("工单号")),
                    toInt(body.get("工单行号")), "", "", ok ? "已出纸" : "失败",
                    str(body.get("发起人")), LocalDateTime.now().format(TS), ""));
            while (DONE.size() > 20) DONE.removeLast();
        }
        return ApiResult.ok(null);
    }

    /** 站点概览:开关状态 / 站点名 / 是否在线 / 队列长度 / 最近出纸 */
    @GetMapping("/station")
    public ApiResult<Map<String, Object>> station() {
        perm.requirePanelView(PANEL_SELF);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("autoEnabled", autoEnabled());
        out.put("stationName", stationName());
        out.put("online", isStationOnline());
        out.put("lastHeartbeat", getSetting("print.last_heartbeat"));
        out.put("queueSize", QUEUE.size());
        List<Map<String, Object>> recent;
        synchronized (DONE) { recent = DONE.stream().map(PrintTask::json).toList(); }
        out.put("recent", recent);
        return ApiResult.ok(out);
    }

    /**
     * 开关自动打印 / 改站点名(电脑上那一页的「打开」开关)。
     *
     * <p>这条改动的是**全局**开关:打开后手机端才允许把任务发给打印电脑。
     * 用户口径「只要这个面版配置参数并且设置成打开」—— 这个"打开"就是这里。
     *
     * @param body {autoEnabled?:bool, stationName?:string}
     */
    @PostMapping("/station")
    public ApiResult<Map<String, Object>> saveStation(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        if (body.containsKey("autoEnabled")) {
            boolean on = !Boolean.FALSE.equals(body.get("autoEnabled"));
            setSetting("print.auto_enabled", on ? "Y" : "N");
        }
        if (body.containsKey("stationName")) {
            setSetting("print.station_name", str(body.get("stationName")));
        }
        if (body.containsKey("printer")) {
            // 打印机名只做留痕展示(真正的本机打印机在浏览器 localStorage);不覆盖本机设置
            log.info("打印站点配置打印机:{} by {}", str(body.get("printer")), currentUserName());
        }
        return station();
    }

    /**
     * 站点页的心跳(页面每 15 秒调一次)。单独一个轻量接口,便于本地代理也用它探活。
     */
    @PostMapping("/heartbeat")
    public ApiResult<Map<String, Object>> heartbeat(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        touchHeartbeat(body == null ? null : str(body.get("station")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("autoEnabled", autoEnabled());
        out.put("queueSize", QUEUE.size());
        return ApiResult.ok(out);
    }

    // ══════════════════════════ 内部 ══════════════════════════

    /** 全局自动打印开关(Y/N;表里没有这个键时按 N —— 不替用户擅自打开) */
    private boolean autoEnabled() {
        return "Y".equalsIgnoreCase(getSetting("print.auto_enabled"));
    }

    private String stationName() {
        return getSetting("print.station_name");
    }

    private String stationNameOrDefault() {
        String s = stationName();
        return s.isEmpty() ? "自动打印" : s;
    }

    /**
     * 有没有在线的打印电脑:心跳在 {@link #ONLINE_SECONDS} 内。
     *
     * <p>心跳存 nvarchar(ISO 格式):{@code yj_app_setting.setting_value} 是 nvarchar,
     * 存字符串最省事,也方便运维直接看。
     */
    private boolean isStationOnline() {
        String hb = getSetting("print.last_heartbeat");
        if (hb.isEmpty()) return false;
        try {
            LocalDateTime t = LocalDateTime.parse(hb.trim().replace(' ', 'T'));
            return java.time.Duration.between(t, LocalDateTime.now()).getSeconds() <= ONLINE_SECONDS;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private void touchHeartbeat(String station) {
        setSetting("print.last_heartbeat", LocalDateTime.now().format(TS));
        if (station != null && !station.isBlank() && stationName().isEmpty()) {
            setSetting("print.station_name", station.trim());
        }
    }

    /** 读系统参数;表/键不存在时返回空串(不抛 —— 参数缺失不该让整页 500) */
    private String getSetting(String key) {
        try {
            List<String> v = jdbc.queryForList(
                    "SELECT setting_value FROM yj_app_setting WHERE setting_key = ?", String.class, key);
            return v.isEmpty() || v.get(0) == null ? "" : v.get(0).trim();
        } catch (RuntimeException e) {
            return "";
        }
    }

    /**
     * 写系统参数(没有就插一行,带 remark 说明这行是干什么的)。
     *
     * <p>⚠ 只碰 asp_user1 / asp_time1 / asp_time2:两账套 {@code yj_app_setting} 结构不完全同源,
     * 测试库没有 asp_user2 列(实测,口径与 {@code DbBackupService} / {@code BatchService} 一致)。
     */
    private void setSetting(String key, String value) {
        try {
            int n = jdbc.update("UPDATE yj_app_setting SET setting_value = ?, asp_user1 = COALESCE(?, asp_user1),"
                    + " asp_time2 = SYSDATETIME() WHERE setting_key = ?", value, currentUserName(), key);
            if (n == 0) {
                jdbc.update("INSERT INTO yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)"
                                + " VALUES (?,?,?,?,SYSDATETIME())",
                        key, value, remarkOf(key), currentUserName());
            }
        } catch (RuntimeException e) {
            // 参数写不进去不该让"手机点打印"整体失败 —— 记日志,队列照常工作
            log.warn("写系统参数 {} 失败(不影响本次打印)", key, e);
        }
    }

    private static String remarkOf(String key) {
        return switch (key) {
            case "print.auto_enabled" -> "自动打印总开关(Y=允许手机端把打印任务发给「自动打印」站点电脑)";
            case "print.station_name" -> "打印机站点的显示名(手机端选机时看到的名字)";
            case "print.last_heartbeat" -> "打印站点最后一次心跳时间(手机端据此判断有没有在线的打印电脑)";
            default -> key;
        };
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /**
     * 把二维码内容渲成 PNG 的 dataURL(后端兜底,2026-11-01)。
     *
     * <p>用 pom 里已有的 ZXing(报表 QRCode 组件也用它),不引新依赖;
     * 不用 `MatrixToImageWriter`(那在 zxing-javase 包里,本项目没引),
     * 直接拿 BitMatrix 逐像素画到 BufferedImage —— 几十行代码,零额外依赖。
     *
     * <p>纠错级别 M、留白 1 模块,与前端 `qrcode` 库那次的参数一致,
     * 保证两端出图在视觉上一致(内容本来就是同一个字符串)。
     *
     * @param content 二维码内容
     * @return `data:image/png;base64,...`;失败返回空串(代理会退回纯文字标签,不影响出纸)
     */
    private static String qrDataUrl(String content) {
        if (content == null || content.isBlank()) return "";
        try {
            Map<com.google.zxing.EncodeHintType, Object> hints = new java.util.EnumMap<>(
                    com.google.zxing.EncodeHintType.class);
            hints.put(com.google.zxing.EncodeHintType.MARGIN, 1);
            hints.put(com.google.zxing.EncodeHintType.CHARACTER_SET, "UTF-8");
            com.google.zxing.common.BitMatrix matrix = new com.google.zxing.qrcode.QRCodeWriter()
                    .encode(content, com.google.zxing.BarcodeFormat.QR_CODE, 260, 260, hints);
            int w = matrix.getWidth();
            int h = matrix.getHeight();
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(
                    w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    img.setRGB(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
                }
            }
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "png", bos);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(bos.toByteArray());
        } catch (Exception e) {
            // 出图失败不该阻断打印:代理收到空图会只打文字
            log.warn("后端生成二维码失败,本次标签不带码:{}", e.toString());
            return "";
        }
    }

    private static String str1(Object o, String dft) {
        String s = str(o);
        return s.isEmpty() ? dft : s;
    }

    private static int toInt(Object o) {
        if (o == null) return 0;
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private static long toLong(Object o) {
        if (o == null) return 0;
        try { return (long) Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
