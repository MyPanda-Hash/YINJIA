package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PrintCacheService;
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

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 自动打印站点 + 打印任务队列(2026-10-30 建,2026-11-04 改「按电脑 + 按打印类型」分发)。
 *
 * <h3>用户口径(原话)</h3>
 * 建面板时:「关于打印还有单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数
 *  并且设置成打开,然后在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」。
 * 二次确认:「采用2的方式(写本地打印代理),但是不是所有登录这个系统的电脑都打印,
 *  需要做个设置(来配置需要用到打印的电脑,实现连接的电脑自动打印)」。
 *
 * <p>2026-11-04 报障(触发本次改造)原话:
 * <blockquote>
 * 「现在的自动打印有问题……我是想要设置的电脑开启自动打印,没有设置的电脑就不开启,
 *  但是在服务器上开启是固定的。能不能在自动打印的面版加个参数来限定电脑。
 *  还有我想加个勾选打印类型的。现在自动打印只有生产领料单。但如果后面也有多个电脑
 *  每个电脑又不同打印要求,需要面版能够勾选打印的需求报表。」
 * </blockquote>
 *
 * <h3>改造前为什么"不设的电脑也会打"</h3>
 * 旧实现只有一个**全局**开关 {@code print.auto_enabled} + 一条**共享**队列:
 * 任何一台电脑只要在轮询(打印代理或浏览器页面),就 {@code poll()} 取走队列里的任务 ——
 * 「谁先轮到谁打印」,于是没配置过的电脑也会抢着出纸;而且一台电脑只认"全打"或"全不打",
 * 无法表达"这台只打领料单、那台只打报工单"。
 *
 * <h3>现在的分发口径(两条规则,别混)</h3>
 * <ol>
 *   <li><b>按电脑</b>:每台打印电脑是一个**站点**,以<b>站点名称</b>为键 ——
 *       就是打印代理 {@code -Station} 的那个名字(代理每 4 秒 {@code /pending?station=<站点名>}
 *       拉任务),也是「自动打印」页面上配置的那个名字。站点在库里有一行配置
 *       ({@code print.station.<站点名>.enabled/.types}),**只有开关打开**的站点才会被排进任务的
 *       {@code targets};没设置过的站点默认**关闭** —— 正是用户要的「没有设置的电脑就不开启」。</li>
 *   <li><b>按类型</b>:任务带 {@code 类型}(见 {@link #PRINT_TYPES});站点在配置里勾选自己要打的报表。
 *       同一类型多台电脑都勾了 ⇒ **都会打**(每台各自出一张);一台都没勾/都不在线 ⇒
 *       手机端收到 {@code queued:false} 并降级为本机打印。</li>
 * </ol>
 *
 * <p>服务端**没有总闸**:用户口径「在服务器上开启是固定的」—— 判断"能不能打"的依据只有
 * 站点配置 + 在线心跳,不再有"全局开关忘了开"这种故障。(历史参数 {@code print.auto_enabled}
 * 不再参与分发,只保留在库里不删,免得回滚时找不到行。)
 *
 * <h3>为什么键是"站点名称"而不是随机 id</h3>
 * 真正出纸的是本机打印代理({@code tools/printing/print-agent.ps1})—— 它 2026-11-03 起
 * **自己**登录服务器拉任务,网页不必开着。它的身份就只有命令行里那个 {@code -Station} 名字,
 * 拿不到浏览器 localStorage 里的随机 id。⇒ 站点必须以这个名字为键,面板配置才可能作用到代理。
 * 代价:同一实例的两台电脑不能用同一个站点名(面板上会提示)。
 *
 * <h3>配置存哪</h3>
 * 站点配置写在 {@code yj_app_setting}({@code print.station.<名字>.enabled} / {@code .types}),
 * 因为**代理在跑、页面可能没开**:只存内存的话,服务端一重启配置就没了 ——
 * 现场表现是"昨天还好好的,今天不打了",很难查。内存里另有一份缓存(每 15 秒被心跳刷新)。
 *
 * <h3>架构:手机只管"发",目标电脑各自"取"</h3>
 * <pre>
 *   手机(生产领料单据)               服务端(本类)                     打印站点电脑 A / B
 *   POST /enqueue {类型} ─── 任务 ──▶ [队列 + targets]  ◀── /pending ──  A 开了且勾该类型 ⇒ 取到
 *                                        │                             B 没开/没勾    ⇒ 取不到
 *                                        └── /ack(已打印)◀──────────── A 回报
 * </pre>
 */
@RestController
@RequestMapping("/api/px/print")
public class PrintStationController {

    private static final Logger log = LoggerFactory.getLogger(PrintStationController.class);
    private static final String PANEL_SELF = PagePanelRegistry.PRINT_STATION;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 心跳多久算"在线"(秒)。打印代理每 4 秒拉一次、面板页每 15 秒一次,留够容错
     */
    private static final long ONLINE_SECONDS = 90;
    /**
     * 打印缓存:代理掉线期间的单子留在库里,回来按顺序补打(2026-11-16 用户口径)。
     *
     * <p>改造前:入队目标只算**在线**站点 + 队列在内存里(TTL 5 分钟)——
     * 代理一掉线,这段时间手机点的打印**当场就丢**,服务端一重启更是整队清空。
     * 现在:目标按**配置**(开关开 + 勾了该类型)算,任务落 `yj_print_task`(见 PrintCacheService),
     * 代理回来第一次 {@code /pending} 就一条条领走。
     *
     * <p>{@code print.cache_enabled}=N 可整体关掉(回到旧口径:只发在线站点);
     * {@code print.cache_hours} 是保留小时数 —— **用户口径 2026-11-16「补打印保留 3 天」**,
     * 故默认 72 小时;过期标 EXPIRED 不再派单,但仍留在列表里给人看。
     */
    private static final String CFG_CACHE_ENABLED = "print.cache_enabled";
    private static final String CFG_CACHE_HOURS = "print.cache_hours";
    /** 默认保留 72 小时 = 3 天(用户口径「补打印保留3天」) */
    private static final int CACHE_HOURS_DEFAULT = 72;
    /** 已出纸记录保留条数(概览显示"刚打印了什么") */
    private static final int MAX_DONE = 20;
    /** 站点配置在系统参数表里的键前缀/后缀 */
    private static final String CFG_PREFIX = "print.station.";
    private static final String CFG_ENABLED = ".enabled";
    private static final String CFG_TYPES = ".types";
    /** 纸张:2026-11-05 用户口径「能不能设定打印的纸张大小(如 A4 或 A5),但是表格实际占用大小不变」 */
    private static final String CFG_PAPER = ".paper";
    /** 支持的纸张(只收标准纸型:自定义纸型会被 PDF 驱动丢掉,见 print-agent.ps1 的踩坑注释) */
    private static final Set<String> PAPERS = Set.of("A5", "A4");
    private static final String PAPER_DEFAULT = "A5";

    /**
     * 打印类型注册表(唯一真源)。
     *
     * <p>新增一种可自动打印的报表 = ①这里加一行(code → 中文名),②产出方在
     * {@code POST /enqueue} 的 {@code 类型} 里带上这个 code,③若纸面版式不同,
     * 再给 {@code tools/printing/print-agent.ps1} 加一段绘制分支。
     * 面板的勾选框由 {@code GET /station} 下发,前端不硬编码类型清单。
     *
     * <p>⚠ 只登记**已经能打出来的**类型:没接通的报表不进这里 ——
     * 面板上出现一个勾了却没反应的选项,比没有这个选项更糟。
     */
    private static final Map<String, String> PRINT_TYPES = new LinkedHashMap<>();
    static {
        PRINT_TYPES.put("PICK_SLIP", "生产领料单");
        // 2026-11-16 用户口径:「其他领料,其他退料和生产退料。都要可以打印报表。(这3个都是在提交的时候打印的,
        //   可以补打印)……打印格式和生产领料一样,只是名称不同」。
        // 三种新报表**共用代理那套领料单版式**(纸上只是标题不同),故这里只登记类型,不改绘制分支:
        //   类型是**派单键**(哪台电脑勾了哪种报表就打哪种),标题随任务的 `标题` 字段下发。
        PRINT_TYPES.put("OTHER_PICK_SLIP", "其他领料单");
        PRINT_TYPES.put("OTHER_RET_SLIP", "其他退料单");
        PRINT_TYPES.put("MAT_RET_SLIP", "生产退料单");
        // 2026-11-18:手机扫码 →「扫码混料」整单保存后自动打印的**混料单**。
        // 版式仍复用代理那套「领料单纸表」(210×148 中一刀横打),只是表头/签名换成混料的:
        //   表头 = 工单号/物料名称/规格/单位/计划用量/实际用量/备注(随任务 `表头` 下发);
        //   签名 = 配料人/复核人/工艺员/班长(随任务 `签名` 下发)。
        // ⚠ 这样加类型**不改绘制分支**:代理读 `表头`/`签名`,取不到就回落到领料单的默认字。
        PRINT_TYPES.put("MIX_SLIP", "混料单");
    }
    /**
     * **纸上不打二维码**的打印类型(2026-11-16 用户口径:「二维码也不用打了」)。
     *
     * <p>为什么按类型而不是一刀切:生产领料单(PICK_SLIP)的二维码是**工单码**,
     * 现场拿它继续扫码领料/报工,不能去掉;而这三张「扫码单」的码只用来做单据身份,
     * 用户已经明确改走「查询补打印」,纸上留个扫了没用的码不如留白。
     *
     * <p>落在这里的效果:入队时**不校验二维码内容**(否则这三类会被"打印内容为空"挡下),
     * 并把二维码内容/二维码图都清空 —— 代理端拿到空图就不贴码(print-agent.ps1 的 $QrImage 判空)。
     */
    private static final Set<String> NO_QR_TYPES = Set.of(
            "OTHER_PICK_SLIP", "OTHER_RET_SLIP", "MAT_RET_SLIP", "MIX_SLIP");

    /** 手机端没带 {@code 类型} 时的默认值(旧调用方兼容;现役只有领料单会入队) */
    private static final String DEFAULT_TYPE = "PICK_SLIP";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    /** 打印任务缓存(落库;代理掉线也不丢,回来补打) */
    private final PrintCacheService cache;

    /**
     * 在线站点表:key = 站点名称(打印代理的 {@code -Station} / 面板里配的名字)。
     *
     * <p>配置(开关/类型)是**库里**那份决定的,这里只是缓存 + 心跳时间;
     * 站点第一次出现时从库里读,库里没有 ⇒ 默认**关闭**(用户口径:没设置的不开)。
     */
    private static final Map<String, Station> STATIONS = new ConcurrentHashMap<>();

    /** 打印任务缓存(落库,见 {@link PrintCacheService})。原内存队列 QUEUE 已下线 —— 那份东西一重启就没了 */
    /** 已出纸记录(只用于面板"最近出纸",最多 {@link #MAX_DONE} 条,内存即可) */
    private static final Deque<PrintTask> DONE = new ArrayDeque<>();

    /**
     * 一台打印电脑的在线视图。
     *
     * @param name    站点名称(唯一键:代理的 -Station,安装时默认取计算机名)
     * @param enabled 自动打印开关(来自库里的站点配置;关着 ⇒ 在线也不派单)
     * @param types   勾选的打印类型 code 集合
     * @param paper   纸张(A5=中一刀 210×148.5 横 / A4=297×210 横;**只换纸不缩放**)
     * @param seen    最后一次心跳(epoch millis);0 = 只在面板上登记过、代理还没连上来
     * @param source  谁在轮询:agent=本机打印代理 / page=自动打印页面(排查用)
     * @param ip      轮询方的来源 IP(帮现场认出"这是哪一台电脑";带 X-Forwarded-For 时取第一个)
     */
    private record Station(String name, boolean enabled, Set<String> types, String paper, long seen, String source, String ip) {
        Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name);
            m.put("enabled", enabled);
            m.put("types", new ArrayList<>(types));
            m.put("paper", paper == null || paper.isBlank() ? PAPER_DEFAULT : paper);
            m.put("online", true);
            m.put("source", source);
            m.put("ip", ip == null ? "" : ip);
            // seen == 0 = 从没连过(面板上预登记的名字):显示空串,别显示 1970 年误导人
            m.put("lastSeen", seen <= 0 ? "" : LocalDateTime
                    .ofInstant(Instant.ofEpochMilli(seen), ZoneId.systemDefault()).format(TS));
            return m;
        }
    }

    /** 一条打印任务(不可变载荷 + 可变的"已投递站点"集合) */
    private record PrintTask(long id, String 类型, String 标题, String 二维码内容, String 工单号, int 工单行号,
                             String 产品名称, String 规格型号, String 来源, String 发起人, String 时间,
                             String 二维码图,
                             String 领料单号, String 领料部门, String 打印日期,
                             java.util.List<java.util.Map<String, Object>> 明细,
                             /**
                              * 纸面可变文案(2026-11-18,扫码混料引入):
                              * {@code 表头} = 七个列头、{@code 部门标签} = 抬头里那三个字、{@code 签名} = 底部四条签名。
                              * 空 ⇒ 代理回落到「生产领料单」的默认文案,故老任务/老客户端不受影响。
                              */
                             java.util.List<String> 表头, String 部门标签, java.util.List<String> 签名,
                             /** 这条任务该给哪些站点(入队那一刻算好:在线 + 开关开 + 订阅了该类型) */
                             Set<String> targets,
                             /** 已经投递给哪些站点(每个站点只投一次;全部投完就出队) */
                             Set<String> delivered,
                             /** 入队时刻(过期丢弃) */
                             long createdAt) {
        Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("类型", 类型);
            m.put("标题", 标题);
            m.put("二维码内容", 二维码内容);
            m.put("二维码图", 二维码图);
            m.put("领料单号", 领料单号);
            m.put("领料部门", 领料部门);
            m.put("打印日期", 打印日期);
            m.put("明细", 明细 == null ? java.util.List.of() : 明细);
            // 2026-11-18:纸面可变文案(空则由代理回落默认)
            if (表头 != null && !表头.isEmpty()) m.put("表头", 表头);
            if (部门标签 != null && !部门标签.isBlank()) m.put("部门标签", 部门标签);
            if (签名 != null && !签名.isEmpty()) m.put("签名", 签名);
            m.put("工单号", 工单号);
            m.put("工单行号", 工单行号);
            m.put("产品名称", 产品名称);
            m.put("规格型号", 规格型号);
            m.put("来源", 来源);
            m.put("发起人", 发起人);
            m.put("时间", 时间);
            m.put("目标站点", new ArrayList<>(targets));
            return m;
        }
    }

    public PrintStationController(JdbcTemplate jdbc, PanelPermissionService perm, PrintCacheService cache) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.cache = cache;
    }

    // ══════════════════════════ 手机端:发任务 ══════════════════════════

    /**
     * 手机端点「打印」→ 按**类型 + 站点配置**算出目标电脑,把任务放进队列。
     *
     * <p>用户口径「在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」。
     * 没有任何目标电脑时**不报错**,返回 {@code online:false} 并给出**具体原因** ——
     * 前端据此降级为手机自带打印层打印,现场至少还能打出来,不会因为"打印电脑没开"就卡住生产。
     *
     * @param body {类型?, 标题, 二维码内容(或 工单号+工单行号), 产品名称, 规格型号, 来源,
     *             领料单号?, 领料部门?, 打印日期?, 明细?}
     */
    @PostMapping("/enqueue")
    public ApiResult<Map<String, Object>> enqueue(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        sweep();

        String type = typeOf(body.get("类型"));
        boolean cacheOn = cacheEnabled();
        // 🔴 2026-11-16「打印缓存」口径:目标站点按**配置**算(开关开 + 勾了该类型),**不看在线**。
        //   掉线那台电脑正是要把单子攒着、等它回来补打的那台;按老的"只算在线"口径,
        //   代理一掉线这段时间手机点的打印当场就丢了(用户报障的原话就是"掉了后……补回来")。
        //   缓存开关关掉(print.cache_enabled=N)时回到旧口径:只发给在线站点,掉线就退回手机自己打。
        List<Station> subscribed = configuredStations().stream()
                .filter((s) -> s.types().contains(type)).toList();
        List<Station> targets = subscribed.stream()
                .filter((s) -> s.enabled() && (cacheOn || isOnline(s))).toList();

        Map<String, Object> m = new LinkedHashMap<>();
        if (targets.isEmpty()) {
            m.put("online", false);
            m.put("queued", false);
            // 原因分两种,现场按提示就能自己修(不让人猜"为什么没打")
            m.put("reason", subscribed.isEmpty() ? "no-subscriber" : "station-off");
            m.put("message", subscribed.isEmpty()
                    ? typeLabel(type) + "没有可用的打印电脑:请在打印电脑上打开「自动打印」页,"
                            + "把该电脑的开关打开并勾上「" + typeLabel(type) + "」"
                    : "打印电脑「" + names(subscribed) + "」的自动打印开关是关着的:请在「自动打印」页上打开");
            m.put("类型", type);
            return ApiResult.ok(m);
        }

        String woNo = str(body.get("工单号"));
        int line = toInt(body.get("工单行号"));
        String qr = str(body.get("二维码内容"));
        String qrImg = str(body.get("二维码图"));
        if (NO_QR_TYPES.contains(type)) {
            // 这几类纸上不打码(用户 2026-11-16 口径):不校验、不留内容、不兜底出图
            qr = "";
            qrImg = "";
        } else {
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
            if (qrImg.isEmpty()) qrImg = qrDataUrl(qr);
        }

        Set<String> targetNames = new LinkedHashSet<>();
        for (Station s : targets) targetNames.add(s.name());

        // 载荷就是代理 /print 收到的那份(键全中文),整条 JSON 落库 —— 以后加打印字段不用改表。
        // ⚠ 纸张不放这里:它按站点配置,派单那一刻由 pending() 塞进去。
        String title = str1(body.get("标题"), typeLabel(type));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("类型", type);
        payload.put("标题", title);
        payload.put("二维码内容", qr);
        payload.put("二维码图", qrImg);
        payload.put("领料单号", str(body.get("领料单号")));
        payload.put("领料部门", str(body.get("领料部门")));
        payload.put("打印日期", str(body.get("打印日期")));
        payload.put("明细", body.get("明细") instanceof java.util.List<?> dl ? dl : java.util.List.of());
        List<String> hdr = strList(body.get("表头"));
        if (!hdr.isEmpty()) payload.put("表头", hdr);
        String deptLabel = str(body.get("部门标签"));
        if (!deptLabel.isEmpty()) payload.put("部门标签", deptLabel);
        List<String> signs = strList(body.get("签名"));
        if (!signs.isEmpty()) payload.put("签名", signs);
        // 2026-11-18 第二轮:整张纸的抬头数据(混料单 →《成型配料记录》横板 A4 那套专用纸表)。
        // 键值对原样透传,代理按固定版式取;没有这张表的老单据不带这个键,代理仍走领料单版式。
        if (body.get("纸面") instanceof java.util.Map<?, ?> sheet && !sheet.isEmpty()) {
            payload.put("纸面", sheet);
        }
        payload.put("工单号", woNo);
        payload.put("工单行号", line);
        payload.put("产品名称", str(body.get("产品名称")));
        payload.put("规格型号", str(body.get("规格型号")));
        payload.put("来源", str1(body.get("来源"), "mobile"));
        payload.put("发起人", currentUserName());
        payload.put("时间", LocalDateTime.now().format(TS));

        // 单号:面板列表要一眼认出是哪张单(领料单号优先,没有就用工单号)
        String slipNo = str(body.get("领料单号"));
        long taskId = cache.enqueue(type, title, slipNo.isEmpty() ? woNo : slipNo, woNo,
                payload, targetNames, currentUserName(), cacheHours());

        List<Station> offTargets = targets.stream().filter((s) -> !isOnline(s)).toList();
        m.put("online", offTargets.size() < targets.size());
        m.put("queued", taskId > 0);
        m.put("taskId", taskId);
        m.put("类型", type);
        m.put("station", names(targets));
        m.put("targets", targetNames);
        // 给手机端一句人话:全在线 = 已发送;有掉线的 = 已缓存,连上就补打
        if (offTargets.isEmpty()) {
            m.put("message", "已发送到打印电脑「" + names(targets) + "」");
        } else if (offTargets.size() == targets.size()) {
            m.put("message", "打印电脑「" + names(targets) + "」当前离线:单子已进打印缓存,"
                    + "那台电脑一连上就自动补打");
        } else {
            m.put("message", "已发送到「" + names(targets.stream().filter(PrintStationController::isOnline).toList())
                    + "」;「" + names(offTargets) + "」离线,已缓存等它回来补打");
        }
        m.put("cached", offTargets.size());
        return ApiResult.ok(m);
    }

    // ══════════════════════════ 打印电脑:取任务 / 回报 ══════════════════════════

    /**
     * 打印电脑轮询:刷新本站点心跳 → 取**派给本站点**的一条任务。
     *
     * <p>🔴 2026-11-04 起**不再"谁先轮询谁取走"**:任务入队时就算好了 targets,
     * 没勾该类型 / 站点开关关着 / 不在这条任务的目标里 ⇒ 一台都拿不到。
     * 同一站点开两个标签页也只会打一次({@code delivered} 去重)。
     *
     * <p>调用方有两类,都用 {@code ?station=<站点名>} 自报家门:
     * ① 本机打印代理({@code print-agent.ps1},每 4 秒,{@code source=agent});
     * ② 「自动打印」页面(每 15 秒,{@code source=page},给没装代理的机器兜底)。
     *
     * @param station 站点名称(必填;与代理 {@code -Station} 一致)
     * @param source  agent / page(仅排查用,不影响派单)
     */
    @GetMapping("/pending")
    public ApiResult<Map<String, Object>> pending(@RequestParam(required = false) String station,
                                                  @RequestParam(required = false) String source,
                                                  jakarta.servlet.http.HttpServletRequest req) {
        perm.requirePanelView(PANEL_SELF);
        sweep();

        Station me = heartbeat(station, source, clientIp(req));
        // 从**库里的缓存**取一条还没投给本站点的任务(代理掉线期间攒下的也在这里)
        Map<String, Object> taskJson = (me == null || !me.enabled()) ? null : cache.takeFor(me.name());

        Map<String, Object> out = new LinkedHashMap<>();
        // 纸张(2026-11-05)是**按站点**的配置,不是任务属性(同一张单可能派给多台电脑、纸不一样),
        // 所以在派单这一刻把本站点的纸张塞进任务里,代理照它选纸型 —— 只换纸不缩放。
        if (taskJson != null) taskJson.put("纸张", me.paper());
        out.put("task", taskJson);
        out.put("queueSize", cache.countPending());
        // 服务端总闸:固定开(用户口径「在服务器上开启是固定的」)—— 兼容旧前端字段
        out.put("autoEnabled", true);
        out.put("station", me == null ? "" : me.name());
        out.put("stationEnabled", me != null && me.enabled());
        out.put("stationOnline", me != null);
        out.put("stations", stationList());
        out.put("types", typeList());
        return ApiResult.ok(out);
    }

    /**
     * 打印电脑回报"这张已出纸"(或失败)。
     *
     * @param body {taskId, ok:true/false, error?:文案, printer?:打印机名, 标题?, 类型?, 工单号?, 工单行号?, 发起人?}
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
        // 库里那条缓存任务落回执(成功=DONE / 失败=FAILED + 原因,失败的行面板上能看见)
        cache.ack(id, ok, str(body.get("error")));
        synchronized (DONE) {
            DONE.addFirst(new PrintTask(id, typeOf(body.get("类型")), str(body.get("标题")), "",
                    str(body.get("工单号")), toInt(body.get("工单行号")), "", "",
                    ok ? "已出纸" : "失败", str(body.get("发起人")), LocalDateTime.now().format(TS), "",
                    "", "", "", java.util.List.of(),
                    // 2026-11-18:PrintTask 多了「纸面可变文案」三项(表头/部门标签/签名),回执不再出纸,
                    //   一律给空 —— 出纸记录只用于「自动打印」页显示最近打了什么。
                    java.util.List.of(), "", java.util.List.of(),
                    Set.of(), Set.of(), System.currentTimeMillis()));
            while (DONE.size() > MAX_DONE) DONE.removeLast();
        }
        return ApiResult.ok(null);
    }

    /**
     * 站点概览(「自动打印」页首屏/刷新):总闸 / 站点清单(含各自开关与类型) / 类型清单 / 队列 / 最近出纸。
     *
     * @param station 可选:传了就顺手登记一次心跳(页面自报"我是哪台电脑")
     */
    @GetMapping("/station")
    public ApiResult<Map<String, Object>> station(@RequestParam(required = false) String station,
                                                  jakarta.servlet.http.HttpServletRequest req) {
        perm.requirePanelView(PANEL_SELF);
        sweep();
        Station me = heartbeat(station, "page", clientIp(req));
        return ApiResult.ok(stateOf(me));
    }

    /**
     * 保存**某一个站点**的配置(开关 + 勾选的打印类型)。
     *
     * <p>🔴 2026-11-04:**这条不再是"全局开关"**。旧实现这里写的是
     * {@code print.auto_enabled}(一台电脑点一下,所有电脑都开/关),正是用户报障的根因:
     * 「我是想要设置的电脑开启自动打印,没有设置的电脑就不开启」。
     * 现在按站点名写配置,别的电脑一点不受影响。
     *
     * @param body {stationName(必填), enabled?, types?:[code...], paper?:'A5'|'A4'}
     */
    @PostMapping("/station")
    public ApiResult<Map<String, Object>> saveStation(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        String name = str(body.get("stationName"));
        if (name.isEmpty()) {
            throw new IllegalArgumentException("缺少站点名称:请先填「站点名称」(与打印代理的 -Station 一致)再保存");
        }
        List<String> raw = body.get("types") instanceof java.util.List<?> l
                ? l.stream().map(String::valueOf).toList() : List.of();
        Set<String> types = parseTypes(String.join(",", raw));
        boolean enabled = !Boolean.FALSE.equals(body.get("enabled"));
        // 纸张(2026-11-05):没带这个字段 = 保留原值(改开关/类型不该把纸张冲回默认)
        Station cur = STATIONS.get(name);
        String paper = body.get("paper") == null
                ? paperOf(cur == null ? getSetting(CFG_PREFIX + name + CFG_PAPER) : cur.paper())
                : paperOf(str(body.get("paper")));
        saveConfig(name, enabled, types, paper);
        log.info("打印站点配置更新:{} 开关={} 类型={} 纸张={} by {}", name, enabled, types, paper, currentUserName());
        // 只返回该站点最新状态(顺带刷新清单),不去碰心跳 —— 在 A 电脑配 B 电脑不该让 B 显示"在线"
        Station s = STATIONS.get(name);
        return ApiResult.ok(stateOf(s));
    }

    /**
     * 站点页的心跳(页面每 15 秒调一次;打印代理用自己的 /pending 承担心跳)。
     *
     * @param body {station?}
     */
    @PostMapping("/heartbeat")
    public ApiResult<Map<String, Object>> heartbeatApi(@RequestBody(required = false) Map<String, Object> body,
                                                       jakarta.servlet.http.HttpServletRequest req) {
        perm.requirePanelView(PANEL_SELF);
        Station me = heartbeat(body == null ? null : str(body.get("station")), "page", clientIp(req));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("autoEnabled", true);
        out.put("queueSize", cache.countPending());
        out.put("station", me == null ? "" : me.name());
        out.put("stations", stationList());
        return ApiResult.ok(out);
    }

    /**
     * 来电 IP(帮现场认出"这是哪一台电脑")。
     *
     * <p>优先 {@code X-Forwarded-For}(有反向代理时 {@code getRemoteAddr} 只会是代理地址);
     * 取第一个地址,非 IPv4/IPv6 的串一律丢掉。取不到就返回空串,不编造。
     */
    private static String clientIp(jakarta.servlet.http.HttpServletRequest req) {
        if (req == null) return "";
        String xff = req.getHeader("X-Forwarded-For");
        String ip = "";
        if (xff != null && !xff.isBlank()) {
            ip = xff.split(",")[0].trim();
        } else {
            ip = str(req.getRemoteAddr());
        }
        if ("0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip)) ip = "127.0.0.1";
        if (ip.startsWith("127.")) ip = "127.0.0.1";
        return ip.length() > 60 ? "" : ip;
    }

    // ══════════════════════════ 内部:心跳 / 配置 / 派单 / 过期 ══════════════════════════

    /**
     * 刷新一个站点的心跳(第一次出现时从库里读配置;库里没有 ⇒ 默认关闭)。
     *
     * @return 站点视图;名字为空时返回 null(不注册"无名站点")
     */
    private Station heartbeat(String name, String source, String ip) {
        String n = str(name);
        if (n.isEmpty()) return null;
        Station old = STATIONS.get(n);
        if (old == null) {
            boolean[] en = {false};
            String[] pp = {PAPER_DEFAULT};
            Set<String> types = loadConfig(n, en, pp);
            old = new Station(n, en[0], types, pp[0], 0L, "", "");
        }
        Station s = new Station(n, old.enabled(), old.types(), old.paper(),
                System.currentTimeMillis(), str1(source, old.source().isEmpty() ? "agent" : old.source()),
                str(ip).isEmpty() ? old.ip() : str(ip));
        STATIONS.put(n, s);
        // 运维展示用(不参与派单):最近心跳时间 + 最近出现的站点名
        setSetting("print.last_heartbeat", LocalDateTime.now().format(TS));
        if (getSetting("print.station_name").isEmpty()) setSetting("print.station_name", n);
        return s;
    }

    /** 读站点配置:内存缓存优先,其次系统参数;都没有 ⇒ enabled=false(没设置的不开) */
    private Set<String> loadConfig(String name, boolean[] enabledOut, String[] paperOut) {
        String en = getSetting(CFG_PREFIX + name + CFG_ENABLED);
        String tp = getSetting(CFG_PREFIX + name + CFG_TYPES);
        String pv = getSetting(CFG_PREFIX + name + CFG_PAPER);
        enabledOut[0] = "Y".equalsIgnoreCase(en);
        if (paperOut != null && paperOut.length > 0) paperOut[0] = paperOf(pv);
        return parseTypes(tp);
    }

    /** 写站点配置(内存 + 系统参数,重载/重启后仍在) */
    private void saveConfig(String name, boolean enabled, Set<String> types, String paper) {
        setSetting(CFG_PREFIX + name + CFG_ENABLED, enabled ? "Y" : "N");
        setSetting(CFG_PREFIX + name + CFG_TYPES, String.join(",", types));
        setSetting(CFG_PREFIX + name + CFG_PAPER, paperOf(paper));
        Station old = STATIONS.get(name);
        STATIONS.put(name, new Station(name, enabled, types, paperOf(paper),
                old == null ? 0L : old.seen(), old == null ? "" : old.source(), old == null ? "" : old.ip()));
    }

    /** 纸张归一:只认 A5 / A4,其余一律按默认 A5(旧数据没有这个键 ⇒ A5,行为不变) */
    private static String paperOf(String raw) {
        String v = str(raw).toUpperCase(Locale.ROOT);
        return PAPERS.contains(v) ? v : PAPER_DEFAULT;
    }

    /**
     * 删掉一台**不在线**的打印电脑(2026-11-06 用户口径:「自动打印界面,要可以删除离线的电脑」)。
     *
     * <p>为什么允许删:站点清单 = 内存里的 ∪ 库里有配置的;某台电脑换机/改名/代理装错站点名之后,
     * 那一行会**永久挂在面板上显示"离线"**,现场以为还有一台在等它出纸。
     *
     * <p>护栏:
     * <ul>
     *   <li>**在线的不让删** —— 代理每 4 秒一次心跳,90 秒内有心跳就算在线;
     *       想删在线的那台,先停它的代理(否则下一次心跳又把它写回来,等于白删);</li>
     *   <li>顺手把它内存里的记录 {@code STATIONS.remove},队列里指向它的任务就地摘掉(免得 5 分钟后再冒出来);</li>
     *   <li>只删本站点的三个参数行(enabled/types/paper),不动 {@code print.*} 其它键。</li>
     * </ul>
     *
     * @param body {stationName}
     */
    @PostMapping("/station/delete")
    public ApiResult<Map<String, Object>> deleteStation(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        String name = str(body.get("stationName"));
        if (name.isEmpty()) throw new IllegalArgumentException("缺少站点名称");
        Station s = STATIONS.get(name);
        if (s != null && isOnline(s)) {
            throw new IllegalStateException("「" + name + "」现在在线(90 秒内有心跳),不能删:"
                    + "请先在那台电脑上停掉打印代理,等它变成离线再删");
        }
        STATIONS.remove(name);
        // 缓存里还有派给它的任务:把它的名字从目标里摘掉(否则这条任务会一直等一个不存在的站点);
        // 摘完没别的目标了就整行删掉 —— 交给 PrintCacheService.clear(站点点名版) 统一处理。
        cache.clear(name);
        int n = deleteConfig(name);
        log.info("打印站点已删除:{}(清了 {} 行配置) by {}", name, n, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stationName", name);
        out.put("删除的配置行数", n);
        out.put("stations", stationList());
        return ApiResult.ok(out);
    }

    // ══════════════ 打印缓存(离线补打) · 2026-11-16 用户口径 ══════════════
    //   「能在自动打印里面做个打印缓存吗，就是在打印代理掉了后，重新连接这个打印缓存，
    //     会将这期间打印的补回来。」
    //   补打本身**不需要人点**:代理一连上就自己按入队顺序领走;
    //   这里三个按钮是给现场兜底的(重发一张、删掉作废单、清空积压)。

    /**
     * 打印缓存开关({@code print.cache_enabled})。
     *
     * @param body {enabled:true/false} —— 关掉只是"以后不再缓存",已经缓存的不会丢
     */
    @PostMapping("/cache/config")
    public ApiResult<Map<String, Object>> saveCacheConfig(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        boolean enabled = !Boolean.FALSE.equals(body.get("enabled"));
        setSetting(CFG_CACHE_ENABLED, enabled ? "Y" : "N");
        log.info("打印缓存开关:{} by {}", enabled ? "开" : "关", currentUserName());
        return ApiResult.ok(stateOf(null));
    }

    /**
     * 补打一条缓存任务:清掉"已送达"标记 ⇒ 代理下次轮询(≤4 秒)再打一次。
     *
     * @param body {id}
     */
    @PostMapping("/cache/retry")
    public ApiResult<Map<String, Object>> retryCache(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        long id = toLong(body.get("id"));
        if (id <= 0) throw new IllegalArgumentException("缺少任务 id");
        int n = cache.retry(id, cacheHours());
        log.info("打印缓存补打 id={} 影响 {} 行 by {}", id, n, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("影响行数", n);
        out.put("cache", stateOf(null).get("cache"));
        return ApiResult.ok(out);
    }

    /**
     * 删掉一条缓存任务(作废单/打错单:不再补打)。
     *
     * @param body {id}
     */
    @PostMapping("/cache/delete")
    public ApiResult<Map<String, Object>> deleteCache(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        long id = toLong(body.get("id"));
        if (id <= 0) throw new IllegalArgumentException("缺少任务 id");
        int n = cache.delete(id);
        log.info("打印缓存删除 id={} 影响 {} 行 by {}", id, n, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("影响行数", n);
        out.put("cache", stateOf(null).get("cache"));
        return ApiResult.ok(out);
    }

    /**
     * 清空待补打的缓存。{@code stationName} 为空 = 全部清掉;
     * 给了站点名 = 只把这条任务对那台电脑摘掉(别的电脑仍会打)。
     *
     * @param body {stationName?}
     */
    @PostMapping("/cache/clear")
    public ApiResult<Map<String, Object>> clearCache(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "配置打印机", "config");
        String station = body == null ? "" : str(body.get("stationName"));
        int n = cache.clear(station);
        log.info("打印缓存清空(站点={})影响 {} 行 by {}", station.isEmpty() ? "全部" : station, n, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("影响行数", n);
        out.put("cache", stateOf(null).get("cache"));
        return ApiResult.ok(out);
    }

    /** 删站点参数行;返回删掉的行数 */    private int deleteConfig(String name) {
        int n = 0;
        for (String suffix : new String[]{CFG_ENABLED, CFG_TYPES, CFG_PAPER}) {
            try {
                n += jdbc.update("DELETE FROM yj_app_setting WHERE setting_key = ?", CFG_PREFIX + name + suffix);
            } catch (RuntimeException e) {
                log.warn("删站点参数 {}{} 失败", name, suffix, e);
            }
        }
        return n;
    }

    /**
     * 清掉过期任务(库里的,交给 {@link PrintCacheService#sweep()}) + 清掉太久没心跳的站点(内存)。
     *
     * <p>2026-11-16:任务不再放内存 —— 原来这里"5 分钟没取就丢"的规则
     * 正是"代理掉了这段时间的单子补不回来"的原因,现在过期的口径是
     * {@code print.cache_hours}(默认 3 天 = 72 小时,过期标 EXPIRED 但仍留在库里给人看)。
     */
    private void sweep() {
        long now = System.currentTimeMillis();
        cache.sweep();
        // 站点条目保留 30 分钟:面板要把"刚才还在、现在离线"的电脑也列出来
        long keep = 30 * 60 * 1000L;
        STATIONS.entrySet().removeIf((e) -> now - e.getValue().seen() > keep);
    }

    /** 在线站点(带心跳时间窗口)**只用于提示文案**;派单目标改按配置算,见 {@link #configuredStations()} */
    private List<Station> onlineStations() {
        long now = System.currentTimeMillis();
        long win = ONLINE_SECONDS * 1000L;
        List<Station> out = new ArrayList<>();
        for (Station s : STATIONS.values()) {
            if (now - s.seen() <= win) out.add(s);
        }
        out.sort((a, b) -> a.name().compareTo(b.name()));
        return out;
    }

    /**
     * 配置过的站点(内存里跑过的 ∪ 库里有配置的),**不看在线**。
     *
     * <p>2026-11-16 打印缓存的关键:目标站点按这份算 —— 掉线的那台也在里面,
     * 单子才会攒进缓存、等它回来补打。与 {@link #stationList()} 同一口径,
     * 只是这里返回 {@link Station} 对象(带开关/类型/纸张)。
     */
    private List<Station> configuredStations() {
        Map<String, Station> all = new LinkedHashMap<>(STATIONS);
        for (String name : configuredNames()) {
            if (all.containsKey(name)) continue;
            boolean[] en = {false};
            String[] pp = {PAPER_DEFAULT};
            Set<String> types = loadConfig(name, en, pp);
            all.put(name, new Station(name, en[0], types, pp[0], 0L, "", ""));
        }
        List<Station> out = new ArrayList<>(all.values());
        out.sort((a, b) -> a.name().compareTo(b.name()));
        return out;
    }

    /** 打印缓存开关(默认开;print.cache_enabled=N 才关 —— 关掉就恢复"只发在线站点"的老口径) */
    private boolean cacheEnabled() {
        return !"N".equalsIgnoreCase(getSetting(CFG_CACHE_ENABLED));
    }

    /** 缓存保留小时数(默认 24;写坏了就按默认,不让一条脏参数把打印搞停) */
    private int cacheHours() {
        try {
            int v = Integer.parseInt(getSetting(CFG_CACHE_HOURS).trim());
            return v >= 1 && v <= 720 ? v : CACHE_HOURS_DEFAULT;
        } catch (RuntimeException e) {
            return CACHE_HOURS_DEFAULT;
        }
    }

    /**
     * 站点清单(给面板显示"哪台电脑开没开、各自订什么")。
     *
     * <p>🔴 2026-11-05:清单 = **内存里在跑的** ∪ **库里有配置的**。
     * 只取内存的话,「面板上新增一台电脑」(它还没连过来、seen=0)会立刻被
     * {@link #sweep()} 当"太久没心跳"清掉,登记完就消失 —— 用户会以为没加成功。
     * 补上库里的配置行,新登记的电脑就能以"离线/从没连过"的形态一直留在清单里,
     * 等它的代理连上来再变在线(服务端重启后也一样)。
     */
    private List<Map<String, Object>> stationList() {
        long now = System.currentTimeMillis();
        long win = ONLINE_SECONDS * 1000L;
        Map<String, Station> all = new LinkedHashMap<>(STATIONS);
        // 库里有配置、但内存里没有(从没连过 / 服务端重启后):补一行"离线占位"
        for (String name : configuredNames()) {
            if (all.containsKey(name)) continue;
            boolean[] en = {false};
            String[] pp = {PAPER_DEFAULT};
            Set<String> types = loadConfig(name, en, pp);
            all.put(name, new Station(name, en[0], types, pp[0], 0L, "", ""));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        List<Station> list = new ArrayList<>(all.values());
        list.sort((a, b) -> a.name().compareTo(b.name()));
        for (Station s : list) {
            Map<String, Object> m = s.json();
            m.put("online", now - s.seen() <= win);
            out.add(m);
        }
        return out;
    }

    /** 库里登记过的站点名(print.station.&lt;名字&gt;.enabled 的键名里取名字);读不到就当空表 */
    private List<String> configuredNames() {
        List<String> names = new ArrayList<>();
        try {
            List<String> keys = jdbc.queryForList(
                    "SELECT setting_key FROM yj_app_setting WHERE setting_key LIKE ?",
                    String.class, CFG_PREFIX + "%.enabled");
            for (String k : keys) {
                if (k == null) continue;
                String rest = k.substring(CFG_PREFIX.length());
                int dot = rest.lastIndexOf('.');
                if (dot > 0) names.add(rest.substring(0, dot));
            }
        } catch (RuntimeException e) {
            // 读不到不影响在跑的站点显示
        }
        return names;
    }

    private List<Map<String, Object>> typeList() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, String> e : PRINT_TYPES.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", e.getKey());
            m.put("label", e.getValue());
            out.add(m);
        }
        return out;
    }

    /** 站点页要的整块状态(我 / 所有站点 / 队列 / 最近出纸) */
    private Map<String, Object> stateOf(Station me) {
        Map<String, Object> out = new LinkedHashMap<>();
        // 服务端总闸:固定开(用户口径「在服务器上开启是固定的」);保留字段给旧前端
        out.put("autoEnabled", true);
        out.put("serverGate", "Y");
        out.put("stationName", me == null ? "" : me.name());
        out.put("stationEnabled", me != null && me.enabled());
        out.put("stationTypes", me == null ? List.of() : new ArrayList<>(me.types()));
        out.put("stationPaper", me == null ? PAPER_DEFAULT : paperOf(me.paper()));
        out.put("stationOnline", me != null && isOnline(me));
        out.put("stations", stationList());
        out.put("types", typeList());
        out.put("queueSize", cache.countPending());
        // 打印缓存(离线补打,2026-11-16):开关 + 待补打清单,面板直接显示/补打/删除
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("enabled", cacheEnabled());
        c.put("hours", cacheHours());
        c.put("count", cache.countPending());
        c.put("items", cache.list());
        out.put("cache", c);
        out.put("lastHeartbeat", getSetting("print.last_heartbeat"));
        List<Map<String, Object>> recent;
        synchronized (DONE) { recent = DONE.stream().map(PrintTask::json).toList(); }
        out.put("recent", recent);
        return out;
    }

    private static boolean isOnline(Station s) {
        return System.currentTimeMillis() - s.seen() <= ONLINE_SECONDS * 1000L;
    }

    private static String names(List<Station> list) {
        List<String> ns = new ArrayList<>();
        for (Station s : list) ns.add(s.name());
        return String.join("、", ns);
    }

    /** 类型 code 归一:不在注册表里的一律按默认类型(旧客户端没带类型) */
    private static String typeOf(Object raw) {
        String t = str(raw).toUpperCase(Locale.ROOT);
        return PRINT_TYPES.containsKey(t) ? t : DEFAULT_TYPE;
    }

    private static String typeLabel(String code) {
        return PRINT_TYPES.getOrDefault(code, code);
    }

    private static Set<String> parseTypes(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null) return out;
        for (String p : csv.split(",")) {
            String t = p.trim().toUpperCase(Locale.ROOT);
            if (PRINT_TYPES.containsKey(t)) out.add(t);
        }
        return out;
    }

    // ══════════════════════════ 内部:系统参数 ══════════════════════════

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

    /**
     * 参数的 remark:一眼看出这行是"哪个站点"的配置(运维直接开表就能读)。
     * 站点配置的键形如 {@code print.station.<站点名>.enabled}。
     */
    private static String remarkOf(String key) {
        if (key.startsWith(CFG_PREFIX)) {
            String rest = key.substring(CFG_PREFIX.length());
            int dot = rest.lastIndexOf('.');
            String name = dot > 0 ? rest.substring(0, dot) : rest;
            String field = dot > 0 ? rest.substring(dot) : "";
            return CFG_TYPES.equals(field)
                    ? "打印站点「" + name + "」勾选的打印类型(逗号分隔的 code;PICK_SLIP=生产领料单)"
                    : (CFG_PAPER.equals(field)
                        ? "打印站点「" + name + "」的纸张(A5=中一刀 210×148.5 横 / A4=297×210 横;只换纸不缩放)"
                        : "打印站点「" + name + "」的自动打印开关(Y=这台电脑出纸,N=不出)");
        }
        return switch (key) {
            case "print.auto_enabled" -> "【已停用】旧全局自动打印开关:2026-11-04 起改为按站点的开关,本键不再参与分发";
            case "print.station_name" -> "最近一次心跳的打印站点名(仅运维展示)";
            case "print.last_heartbeat" -> "打印站点最后一次心跳时间(仅运维展示)";
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

    /**
     * 取字符串数组(2026-11-18,纸面可变文案 `表头` / `签名`)。
     *
     * <p>前端可能传 List&lt;String&gt;、也可能传 JSON 数组对象;空/非数组一律给空列表,
     * 由代理回落到领料单的默认文案 —— 不让"少传一个字段"变成打不出来。
     */
    private static java.util.List<String> strList(Object o) {
        if (!(o instanceof java.util.List<?> l)) return java.util.List.of();
        java.util.List<String> out = new java.util.ArrayList<>();
        for (Object x : l) {
            String s = str(x);
            if (!s.isEmpty()) out.add(s);
        }
        return out;
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
