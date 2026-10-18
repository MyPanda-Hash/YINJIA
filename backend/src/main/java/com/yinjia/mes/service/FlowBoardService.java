package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 流程管控看板的服务端(2026-10-16,用户口径:「我的桌面缺失对生产过程和库存的一个流程管理视图」)。
 *
 * <p>只出**节点口径数据**,不出图形:链路怎么排、节点放哪、什么颜色,全部由前端
 * {@code frontend/src/views/dashboard/flowSpec.js} 的声明式规格决定(契约数据驱动)。
 * 本类只负责把每个节点"现在有几张单、卡在哪一步"数准,且**不另造口径**:
 * <ul>
 *   <li>单据类节点:按 {@link PanelRegistry} 的面板定义取表名,文档数 = {@code COUNT(DISTINCT groupCol)},
 *       状态分布取 {@code yj_doc_status}(与 {@link DashboardStatsService#docStats} 同款);</li>
 *   <li>页面级节点(没有 yj_panel 行的 4 个页面):**直接复用既有服务** ——
 *       订单结转 {@link OrderConvertService#stats}、快速排产 {@link ScheduleBoardService#stats},
 *       避免"看板自己写一套待结转 SQL"这种双口径;</li>
 *   <li>生产工单:参考库 {@code plang} 单轨(未排产 = 产线空且未结案 / 已排产 / 已完工),
 *       与 {@link ScheduleBoardService} 的池口径同源;</li>
 *   <li>出库预警:{@code kucun.yl < kucun.[预警数量]} —— 即 {@link StockWarnService} 的出库审批拦截口径
 *       (用户在需求里明确:「出库有预警设置,低于预警无法审核」)。</li>
 * </ul>
 *
 * <p>每个节点单独 try/catch:某个视图/列缺失只让该节点为 {@code null}(前端显示「—」),
 * 不会把整块看板打成 500。
 */
@Service
public class FlowBoardService {

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;
    private final OrderConvertService orderConvert;
    private final ScheduleBoardService scheduleBoard;

    public FlowBoardService(JdbcTemplate jdbc, PanelRegistry registry,
                            OrderConvertService orderConvert, ScheduleBoardService scheduleBoard) {
        this.jdbc = jdbc;
        this.registry = registry;
        this.orderConvert = orderConvert;
        this.scheduleBoard = scheduleBoard;
    }

    /** 参与流程管控的单据/查询面板(键 = 前端 flowSpec.js 的 nodeKey,值 = 面板编码) */
    private static final List<String> PANEL_NODES = List.of(
            // 生产链
            "SO_ORDER", "MATERIAL_OUT", "LINE_LOAD", "WO_REPORT", "WO_REPORT_LIST", "WO_COMPLETION_LIST",
            "QC_FIRST_INSP", "QC_PROC_INSP", "QC_ASM_INSP", "QC_BHC", "FINISH_IN",
            // 库存链
            "PU_ORDER", "QC_RECV", "QC_INSP", "QC_INSP_REC", "QC_CATALOG", "PURCHASE_IN", "QC_RETURN", "QC_TC_IN",
            // 库存报表(只读查询表)
            "STOCK_BALANCE", "STOCK_LEDGER", "STOCK_SUMMARY", "STOCK_STATUS", "STOCK_DETAIL");

    /** 检验族:其明细表带「合格数量/不合格数量」,流程看板要拿它做合格/不合格分流 */
    private static final Map<String, String> QC_DETAIL = Map.of(
            "QC_INSP", "qc_insp_detail",
            "QC_PROC_INSP", "qc_proc_insp_detail",
            "QC_ASM_INSP", "qc_asm_insp_detail",
            "QC_FIRST_INSP", "qc_first_insp_detail");

    public Map<String, Object> flow() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("at", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));

        Map<String, Object> nodes = new LinkedHashMap<>();
        for (String code : PANEL_NODES) nodes.put(code, panelNode(code));
        out.put("nodes", nodes);

        Map<String, Object> special = new LinkedHashMap<>();
        special.put("workorder", workOrder());
        special.put("convert", convert());
        special.put("schedule", schedule());
        special.put("warn", warn());
        out.put("special", special);

        out.put("blocks", blocks(nodes, special));
        return out;
    }

    // ───────────────────────── 单据类节点 ─────────────────────────

    /** 一个面板节点:文档数 + 状态分布(+ 检验族的合格/不合格数量、只读报表的行数) */
    private Map<String, Object> panelNode(String code) {
        try {
            PanelRegistry.PanelDef def = registry.panel(code);
            if (def == null) return null;
            String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("name", def.name());
            if (def.isDoc()) {
                String col = def.groupCol();
                if (table == null || col == null || table.isBlank() || col.isBlank()
                        || !table.matches("[\\p{L}\\p{N}_]+") || !col.matches("[\\p{L}\\p{N}_]+")) return null;
                n.put("docs", count("SELECT COUNT(DISTINCT [" + col + "]) FROM " + table
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(RTRIM([" + col + "]),'')<>''"));
                // 已审核/待审核(2026-10-18 修正):只数**头表里还在的单据**,并按下单号去重。
                //   原先直接数 yj_doc_status 留痕 —— 已删除的历史单(PURCHASE_IN 19 张、
                //   QC_INSP_REC 12 张)仍算已审核 ⇒ 节点出现「单数 313 / 已审核 332 / 草稿 0」这种
                //   三个数对不上的自相矛盾,与桌面「单据流量」卡同一 bug。
                Map<String, Object> st = jdbc.queryForMap(
                        "SELECT COUNT(DISTINCT CASE WHEN s.shr IS NOT NULL THEN s.doc_no END) AS audited,"
                                + " COUNT(DISTINCT CASE WHEN s.pending = 'Y' THEN s.doc_no END) AS pending"
                                + " FROM yj_doc_status s WHERE s.panel_code = ? AND ISNULL(s.canceled,'N')<>'Y'"
                                + " AND EXISTS(SELECT 1 FROM " + table + " h WHERE h.[" + col + "]=s.doc_no"
                                + " AND ISNULL(h.asp_cancel,'N')<>'Y')", code);
                n.put("audited", toInt(st.get("audited")));
                n.put("pending", toInt(st.get("pending")));
                n.put("draft", Math.max(0, toInt(n.get("docs")) - toInt(st.get("audited"))));
                // ⚠ 单据面板默认不数明细行:解析规格(前端 flowSpec)里只有 WO_REPORT 用到它
                //   (卡片上的「报工行」)—— 原先每张单据面板都白跑一次 COUNT(*),现在只保留这一张。
                if ("WO_REPORT".equals(code)) {
                    n.put("rows", count("SELECT COUNT(*) FROM " + def.lineTable() + " WHERE ISNULL(asp_cancel,'N')<>'Y'"));
                }
            } else {
                // flat 直读视图(库存报表/完工明细/报工记录):只有行数,没有单据状态
                n.put("docs", null);
                n.put("rows", count("SELECT COUNT(*) FROM " + table));
                n.put("readonly", true);
            }
            String det = QC_DETAIL.get(code);
            if (det != null) {
                n.put("okQty", sum("SELECT SUM(ISNULL([合格数量],0)) FROM " + det + " WHERE ISNULL(asp_cancel,'N')<>'Y'"));
                n.put("ngQty", sum("SELECT SUM(ISNULL([不合格数量],0)) FROM " + det + " WHERE ISNULL(asp_cancel,'N')<>'Y'"));
            }
            return n;
        } catch (Exception e) {
            return null;   // 单节点失败不拖垮整块看板(前端显示「—」)
        }
    }

    // ───────────────────────── 页面级节点 ─────────────────────────

    /**
     * 生产工单(plang 单轨):总行数 / 未排产 / 已排产在制 / 已完工 / **已结案**(2026-10-18 补)。
     *
     * <p>四个桶互斥且合计 = 总行数:未排产(产线空·未结案·未完工) + 已排产(有产线·未完工)
     * + 已完工(完工状态=生产完工/已完工) + 已结案(ja=T/Y)。改前少了「已结案」一栏,
     * 429 = 393+9+4 差 23/24 行,看起来像漏算;同时把「完工但没排产线」的历史行从待排产里剔掉
     * (原先那 1 行既算未排产又算已完工)。
     */
    private Map<String, Object> workOrder() {
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            String base = " FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'";
            String done = "ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工')";
            String closed = "ISNULL(p.ja,'N') IN ('T','Y')";
            m.put("rows", count("SELECT COUNT(*)" + base));
            m.put("unassigned", count("SELECT COUNT(*)" + base + " AND ISNULL(p.scx,N'')=N''"
                    + " AND NOT (" + closed + ") AND NOT (" + done + ")"));
            m.put("assigned", count("SELECT COUNT(*)" + base + " AND ISNULL(p.scx,N'')<>N''"
                    + " AND NOT (" + done + ")"));
            m.put("done", count("SELECT COUNT(*)" + base + " AND " + done));
            m.put("closed", count("SELECT COUNT(*)" + base + " AND " + closed));
            m.put("qty", sum("SELECT SUM(ISNULL(p.pl_sl,0))" + base));
            m.put("doneQty", sum("SELECT SUM(ISNULL(p.rk_sl,0))" + base));
            return m;
        } catch (Exception e) {
            return null;
        }
    }

    /** 订单结转:复用既有服务(待结转行 = 已审核订单行 − 各通道占用 > 0) */
    @SuppressWarnings("unchecked")
    private Map<String, Object> convert() {
        try {
            Map<String, Object> s = orderConvert.stats(null, null, null);
            Map<String, Object> undone = (Map<String, Object>) s.get("未结转");
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("pendingRows", undone == null ? 0 : undone.get("总订单笔数"));
            m.put("styles", undone == null ? 0 : undone.get("总款数"));
            m.put("qty", undone == null ? 0 : undone.get("总下单数量"));
            m.put("latest", s.get("最新下单日期"));
            return m;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 快速排产:待排产笔数走 {@link ScheduleBoardService#poolCount}(只数数,不拉池内 405 行),
     * 今日排产/总未完成量复用 {@link ScheduleBoardService#stats} —— 与排产页同一口径。
     *
     * <p>2026-10-16 性能专项:先前直接调 stats,而 stats 内部 `pending()` 会把整池行连同两个
     * LEFT JOIN 拉回来只为了 `.size()`;本板每次刷新都白付一次(实测该池 969 ms → 建索引后 20 ms,
     * 但笔数查询只要 2 ms)。
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> schedule() {
        try {
            Map<String, Object> s = scheduleBoard.stats(null);
            Map<String, Object> today = (Map<String, Object>) s.get("今日排产");
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("pool", scheduleBoard.poolCount(null));
            m.put("todayCnt", today == null ? 0 : today.get("张数"));
            m.put("todayQty", today == null ? 0 : today.get("数量"));
            m.put("wipQty", s.get("总未完成量"));
            Object lines = s.get("产线");
            m.put("lines", lines instanceof List ? ((List<?>) lines).size() : 0);
            return m;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 出库预警 / 负库存:统一到库存页面同一张视图 **v_stock_balance**(2026-10-18 用户口径
     * 「统一到同一视图 v_stock_balance」)。
     *
     * <p>改前读遗留批次表 kucun(现存量 315 行负) 而库存页读 v_stock_balance(780 行负),
     * 同一块看板两个「负库存」数对不上。现两者同源;预警数量由视图从 kucun 按 仓库+存货 聚合
     * (MAX,实测同组合阈值唯一,见 migrate-stock-balance-warn-20261018.sql)。
     */
    private Map<String, Object> warn() {
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("below", count("SELECT COUNT(*) FROM v_stock_balance"
                    + " WHERE ISNULL(预警数量,0) > 0 AND ISNULL(现存量,0) < 预警数量"));
            m.put("thresholded", count("SELECT COUNT(*) FROM v_stock_balance WHERE ISNULL(预警数量,0) > 0"));
            m.put("negative", count("SELECT COUNT(*) FROM v_stock_balance WHERE ISNULL(现存量,0) < 0"));
            return m;
        } catch (Exception e) {
            return null;
        }
    }

    // ───────────────────────── 卡点汇总 ─────────────────────────

    /**
     * 「当前卡点」:流程里真正需要人推一把的地方 —— 每条都带面板编码,前端点一下直达该面板。
     * 只在 value &gt; 0 时进列表(没卡点就不显示),并按 value 降序排。
     */
    private List<Map<String, Object>> blocks(Map<String, Object> nodes, Map<String, Object> special) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, Object> conv = mapOf(special.get("convert"));
        Map<String, Object> sch = mapOf(special.get("schedule"));
        Map<String, Object> wo = mapOf(special.get("workorder"));
        Map<String, Object> wn = mapOf(special.get("warn"));
        add(out, "convertPending", "订单待结转", conv.get("pendingRows"), "ORDER_CONVERT",
                "已审核订单行还有剩余未转工单/采购", "warn");
        add(out, "schedulePending", "待排产工单", sch.get("pool"), "SCHEDULE_BOARD",
                "工单已下达但还没排进产线", "warn");
        add(out, "woUnassigned", "工单未排产(行)", wo.get("unassigned"), "WORK_ORDER_LIST",
                "工单行产线为空:排产前的堆积量", "warn");
        add(out, "reportPending", "报工待审核", v(nodes, "WO_REPORT", "pending"), "WO_REPORT",
                "报工单提交后等审核:不过审就不进下一道工序", "block");
        int inspPending = n(v(nodes, "QC_FIRST_INSP", "pending")) + n(v(nodes, "QC_PROC_INSP", "pending"))
                + n(v(nodes, "QC_ASM_INSP", "pending")) + n(v(nodes, "QC_INSP", "pending"));
        add(out, "inspPending", "检验待审核", inspPending, "QC_ASM_INSP",
                "首件/制程/组装/来料检验待审核:不过审不入库、不放行", "block");
        add(out, "finishDraft", "产成品入库待审核", v(nodes, "FINISH_IN", "draft"), "FINISH_IN",
                "组装成品检验合格后自动生成的入库草稿,等仓库审核记账", "warn");
        add(out, "purchaseDraft", "采购入库待审核", v(nodes, "PURCHASE_IN", "draft"), "PURCHASE_IN",
                "来料检验合格数量生成/暂收直接生成的入库单", "warn");
        add(out, "tcPending", "特采待审批", v(nodes, "QC_TC_IN", "pending"), "QC_TC_IN",
                "不合格转特采:二级审批通过才放行进采购入库", "block");
        add(out, "warnBelow", "库存低于预警", wn.get("below"), "STOCK_DETAIL",
                "结余低于该批次预警数量:出库审核会被拦下", "block");
        out.sort((a, b) -> n(b.get("value")) - n(a.get("value")));
        return out;
    }

    private static void add(List<Map<String, Object>> out, String key, String name, Object value,
                            String panelCode, String hint, String level) {
        if (n(value) <= 0) return;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("name", name);
        m.put("value", n(value));
        m.put("panelCode", panelCode);
        m.put("hint", hint);
        m.put("level", level);
        out.add(m);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapOf(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : Map.of();
    }

    private static Object v(Map<String, Object> nodes, String code, String field) {
        Map<String, Object> m = mapOf(nodes.get(code));
        return m.get(field);
    }

    private static int n(Object o) {
        if (o instanceof Number num) return num.intValue();
        try {
            return o == null ? 0 : (int) Double.parseDouble(String.valueOf(o));
        } catch (Exception e) {
            return 0;
        }
    }

    /** 同 n(),名字更贴读取语义(SUM 出来的 audited/pending 可能是 null) */
    private static int toInt(Object o) {
        return n(o);
    }

    private int count(String sql, Object... args) {
        Integer v = jdbc.queryForObject(sql, Integer.class, args);
        return v == null ? 0 : v;
    }

    private Double sum(String sql, Object... args) {
        try {
            Double v = jdbc.queryForObject(sql, Double.class, args);
            return v == null ? 0d : v;
        } catch (Exception e) {
            return null;
        }
    }
}
