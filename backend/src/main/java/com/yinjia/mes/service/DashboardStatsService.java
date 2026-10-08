package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 桌面(我的桌面)统计聚合:一次返回各模块图表数据。
 *
 * 分层口径(2026-09-28,SQL 全部收敛在 service —— 代码规范 A2,不再往 ShellController 堆 SQL):
 *  - 生产 = 参考库 plang(工单行):完工=rk_no 已填 / 在产=其余;车间=scx;趋势=pl_date(新增)/cp_date(完工);
 *    工序完成率 = scjl 报工(gxdm 工序 × wgzt 完工)——未报工工序不出条,空数据=空态。
 *  - 库存 = inh/outh 两物理表(入库/出库):单数=DISTINCT 单号,行数=明细行;现存量 TOP = kucun.yl 按物料;
 *    物料名取 mate(取不到回退物料编码)。
 *  - 销售 = bd_so_order(头)/bl_so_order(行):状态取头表「单据状态」列(展示口径);金额=行 SUM(金额);
 *    TOP 产品 = 行 GROUP BY 存货名称。
 *  - 质量 = qc_insp_detail(明细):合格=SUM(合格数量),不合格=SUM(不良数量);趋势=按日期 送检/合格双线。
 *  - 研发 = rd_plan(实施计划单表):阶段进度按 阶段N_计划内容/实际完成 列在 Java 侧推导
 *    (未开始/进行中/逾期/全部完成),趋势=asp_time1 近 30 天新增。
 *  数据量级为起步演示库(几十行),聚合直查无索引压力;趋势日期在 Java 补零成连续序列。
 */
@Service
public class DashboardStatsService {

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    public DashboardStatsService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    public Map<String, Object> stats() {
        Map<String, Object> out = new HashMap<>();
        out.put("kpis", kpis());
        out.put("archives", archives());
        out.put("docStats", docStats());
        out.put("todos", List.of());
        out.put("latest", List.of());
        out.put("progress", progress());
        out.put("production", production());
        out.put("stock", stock());
        out.put("sales", sales());
        out.put("quality", quality());
        out.put("rd", rd());
        return out;
    }

    // ---------- 概览 KPI / 档案 / 单据流量 ----------

    private Map<String, Object> kpis() {
        int draftTotal = 0;
        int auditTotal = 0;
        int moTotal = 0;
        for (Map<String, Object> row : docStats()) {
            Map<?, ?> st = (Map<?, ?>) row.get("status");
            int draft = toInt(st.get("草稿"));
            int audited = toInt(st.get("已审核"));
            draftTotal += draft;
            auditTotal += audited;
            if (String.valueOf(row.get("panelCode")).startsWith("MANU") || String.valueOf(row.get("panelCode")).startsWith("WO_")) {
                moTotal += draft + audited;
            }
        }
        Map<String, Object> kpis = new HashMap<>();
        kpis.put("moActive", draftTotal);
        kpis.put("moTotal", moTotal);
        kpis.put("approvePending", 0);
        return kpis;
    }

    private Map<String, Object> archives() {
        Map<String, Object> archives = new HashMap<>();
        archives.put("invItems", count("SELECT COUNT(DISTINCT m_no) FROM mate WHERE ISNULL(asp_cancel,'N')<>'Y'"));
        archives.put("deptCount", count("SELECT COUNT(*) FROM yj_dept"));
        archives.put("whCount", count("SELECT COUNT(*) FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'"));
        return archives;
    }

    private List<Map<String, Object>> docStats() {
        List<Map<String, Object>> docStats = new ArrayList<>();
        try {
            for (PanelRegistry.PanelDef def : registry.all()) {
                if (!def.isDoc()) continue;
                String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
                int docs = count("SELECT COUNT(DISTINCT " + def.groupCol() + ") FROM " + table
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y'");
                int audited = count("SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = '" + def.code().replace("'", "''")
                        + "' AND shr IS NOT NULL AND ISNULL(canceled,'N')<>'Y'");
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("panelName", def.name());
                row.put("panelCode", def.code());
                row.put("count", docs);
                Map<String, Object> st = new LinkedHashMap<>();
                st.put("草稿", docs - audited);
                st.put("已审核", audited);
                row.put("status", st);
                docStats.add(row);
            }
        } catch (Exception ignored) {
        }
        return docStats;
    }

    /** 进行中工单(概览工单队列):在产 plang 最近 3 行 */
    private List<Map<String, Object>> progress() {
        try {
            return jdbc.queryForList("SELECT TOP 3 pl_no AS [编号], mc AS [产品], scx AS [车间], pl_sl AS [数量]"
                    + " FROM plang WHERE (rk_no IS NULL OR rk_no = '') ORDER BY id DESC");
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- 生产 ----------

    private Map<String, Object> production() {
        Map<String, Object> prod = new HashMap<>();
        try {
            int done = count("SELECT COUNT(*) FROM plang WHERE rk_no IS NOT NULL AND rk_no <> ''");
            int all = count("SELECT COUNT(*) FROM plang");
            prod.put("statusDist", List.of(
                    Map.of("name", "已完工", "value", done),
                    Map.of("name", "生产中", "value", Math.max(0, all - done))));
            prod.put("workshopDist", nameValue("SELECT scx AS k, COUNT(*) AS v FROM plang"
                    + " WHERE ISNULL(scx,'') <> '' GROUP BY scx ORDER BY COUNT(*) DESC"));
            prod.put("trend7", dateTrend("plang", "pl_date", "cp_date"));
            prod.put("stageRates", stageRates());
            prod.put("bomTree", List.of());
        } catch (Exception e) {
            prod.put("statusDist", List.of());
            prod.put("workshopDist", List.of());
            prod.put("trend7", List.of());
            prod.put("stageRates", List.of());
            prod.put("bomTree", List.of());
        }
        return prod;
    }

    /**
     * 产能对比(2026-10-08 用户需求:日产能对比可以切周/月/年,按产线做竖向双柱对比):
     *  - 上限 = bs_prod_line.日产能 × 周期天数(PROD_LINE 面板可维护;周=7、月=当月自然日、年=年自然日);
     *  - 产出 = scjl 周期内报工 SUM(sl) 按 scxmc(产线名)分组,ISNULL(delmark,0)=0;
     *  - 周期口径 = **最近有报工的那个周期**:锚点日取今天(今天有报工)否则最近一个有报工日,
     *    再取该日所在的自然周(周一起)/自然月/自然年。与既有「日」的回看口径一致 ——
     *    否则切到周/月/年会一片空白(2026-10-08 实测正式库报工数据止于 2026-08-26);
     *  - 周期区间在 Java 侧用 java.time 推导(不写 DATEFIRST 依赖的 DATEPART(weekday)),
     *    月/年天数按自然日算(28~31 / 365~366),不做「×30」这类估算;
     *  - 产线清单 = **产线档案里启用(非 停用=是、非 asp_cancel=Y)的全部产线**,不看是否配了日产能;
     *    未配日产能的只画实际柱、上限留空(前端提示去档案维护)。
     *    档案加一行就多一组柱、停用/删除就少一组(用户 2026-10-08 口径:「产线要根据真实的产线里面的来,
     *    做到后续能新增产线,删除产线也能跟着变化」);报工表里的历史产线名(scjl 旧电镀线)不再补进清单。
     */
    public Map<String, Object> capacity(String period) {
        String p = (period == null) ? "day" : period.trim().toLowerCase();
        if (!List.of("day", "week", "month", "year").contains(p)) p = "day";
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", p);
        try {
            // 锚点日:今天有报工用今天,否则最近一个有报工的一天
            String anchorStr = jdbc.queryForObject(
                    "SELECT CONVERT(varchar(10), MAX(CASE WHEN CONVERT(date, sc_date) = CONVERT(date, GETDATE()) THEN sc_date END), 23)"
                            + " FROM scjl WHERE ISNULL(delmark,0)=0", String.class);
            if (anchorStr == null || anchorStr.isBlank()) {
                List<Map<String, Object>> last = jdbc.queryForList(
                        "SELECT TOP 1 CONVERT(varchar(10), sc_date, 23) AS d FROM scjl"
                                + " WHERE ISNULL(delmark,0)=0 AND sc_date IS NOT NULL ORDER BY sc_date DESC");
                if (!last.isEmpty()) anchorStr = String.valueOf(last.get(0).get("d"));
            }
            if (anchorStr == null || anchorStr.isBlank()) {
                out.put("rows", List.of());
                return out;
            }
            LocalDate anchor = LocalDate.parse(anchorStr);
            LocalDate from = switch (p) {
                case "week" -> anchor.minusDays(anchor.getDayOfWeek().getValue() - 1L); // 周一起
                case "month" -> anchor.withDayOfMonth(1);
                case "year" -> anchor.withDayOfYear(1);
                default -> anchor;
            };
            int days = (int) java.time.temporal.ChronoUnit.DAYS.between(from, switch (p) {
                case "week" -> from.plusWeeks(1);
                case "month" -> from.plusMonths(1);
                case "year" -> from.plusYears(1);
                default -> from.plusDays(1);
            });
            String fromStr = from.format(DateTimeFormatter.ISO_LOCAL_DATE);
            String toStr = from.plusDays(days - 1L).format(DateTimeFormatter.ISO_LOCAL_DATE);
            out.put("from", fromStr);
            out.put("to", toStr);
            out.put("days", days);
            out.put("anchor", anchorStr);

            Map<String, Double> actualByLine = new LinkedHashMap<>();
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT RTRIM(scxmc) AS line, SUM(ISNULL(sl,0)) AS q FROM scjl"
                            + " WHERE ISNULL(delmark,0)=0 AND sc_date >= ? AND sc_date < DATEADD(day, 1, ?)"
                            + " AND ISNULL(scxmc,'') <> '' GROUP BY RTRIM(scxmc)", fromStr, toStr)) {
                actualByLine.put(String.valueOf(r.get("line")), toD(r.get("q")));
            }
            Map<String, Double> limitByLine = new LinkedHashMap<>();
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT RTRIM(生产线) AS line, 日产能 FROM bs_prod_line"
                            + " WHERE ISNULL(停用,'N') <> '是' AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " AND ISNULL(生产线,'') <> '' ORDER BY 生产线")) {
                limitByLine.put(String.valueOf(r.get("line")), toD(r.get("日产能")) * days);
            }
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Map.Entry<String, Double> e : limitByLine.entrySet()) {
                double actual = actualByLine.getOrDefault(e.getKey(), 0.0);
                double limit = e.getValue();
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", e.getKey());
                m.put("actual", Math.round(actual));
                // 未配日产能(0/空)= 只画实际柱,上限留空 —— 与「停用」不是一回事:
                // 停用是**不上图**,未配是**上图但没有比较基准**(前端提示去产线档案维护)
                m.put("limit", limit > 0 ? Math.round(limit) : null);
                m.put("pct", limit > 0 ? (int) Math.round(actual * 100.0 / limit) : null);
                rows.add(m);
            }
            // 产线清单**只由产线档案决定**(2026-10-08 用户口径:「所有产线都要能有图表显示,
            // 根据生产线里面的产线的是否停用来决定柱状图是否显示,后续新加入的产线也能适配,
            // 删除的产线也能适配去掉」)——
            //   · 档案里**启用**(非 停用=是、非 asp_cancel=Y)的产线**全部上图**,含未配日产能的;
            //   · 报工表里的历史产线名(scjl 的旧电镀线:挂镀_自动线/亮锡E线/铜板线/雾锡A线)不掺进来;
            //   · 新增一行 = 多一组柱;置 停用=是 或删除 = 立即消失。
            out.put("rows", rows);
        } catch (Exception ex) {
            out.put("rows", List.of());
        }
        return out;
    }

    private static double toD(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (Exception e) {
            return 0;
        }
    }

    /** 五工序(混料/成型/切炭/组装/装箱)报工完成率:scjl.gxdm 分组,完工=wgzt 已填;未报工工序不出条 */
    private List<Map<String, Object>> stageRates() {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT gxdm AS k, COUNT(*) AS total, SUM(CASE WHEN wgzt IS NOT NULL AND wgzt <> '' THEN 1 ELSE 0 END) AS done"
                            + " FROM scjl WHERE ISNULL(gxdm,'') <> '' AND ISNULL(delmark,0) = 0 GROUP BY gxdm ORDER BY gxdm");
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                int total = toInt(r.get("total"));
                int done = toInt(r.get("done"));
                if (total <= 0) continue;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", String.valueOf(r.get("k")));
                m.put("value", Math.round(done * 100.0 / total));
                m.put("meta", done + "/" + total);
                out.add(m);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- 库存 ----------

    private Map<String, Object> stock() {
        Map<String, Object> stock = new HashMap<>();
        try {
            // 2026-09-30:inh/outh 已由遗留纺织表重建为 MES 库存流水表,旧列名(inh_no/in_date/outh_no/out_date)
            // 不存在了 —— 继续读旧列名会抛「列名无效」被下面 catch 吞掉,库存卡片因此静默退化为空。
            // 语义完全一致,只是列名中文化:单数=COUNT(DISTINCT 单据编号),行数=COUNT(*),趋势按 单据日期。
            int inDocs = count("SELECT COUNT(DISTINCT 单据编号) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'");
            int outDocs = count("SELECT COUNT(DISTINCT 单据编号) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'");
            int inLines = count("SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'");
            int outLines = count("SELECT COUNT(*) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'");
            stock.put("totalIn", inDocs);
            stock.put("totalOut", outDocs);
            stock.put("totalLines", inLines + outLines);
            List<Map<String, Object>> panels = new ArrayList<>();
            panels.add(row("panelName", "入库", "count", inDocs, "lines", inLines));
            panels.add(row("panelName", "出库", "count", outDocs, "lines", outLines));
            stock.put("panels", panels);
            // 近 7 天出入库:入库=added,出库=done(两条物理表按各自日期计数,Java 补零)
            Map<String, int[]> byDay = new LinkedHashMap<>();
            List<String> days = lastDays(7);
            for (String d : days) byDay.put(d, new int[2]);
            for (Map<String, Object> r : jdbc.queryForList("SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(*) AS v"
                    + " FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= DATEADD(day,-6,CONVERT(date,GETDATE())) GROUP BY CONVERT(varchar(10), 单据日期, 23)")) {
                int[] slot = byDay.get(String.valueOf(r.get("d")));
                if (slot != null) slot[0] = toInt(r.get("v"));
            }
            for (Map<String, Object> r : jdbc.queryForList("SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(*) AS v"
                    + " FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= DATEADD(day,-6,CONVERT(date,GETDATE())) GROUP BY CONVERT(varchar(10), 单据日期, 23)")) {
                int[] slot = byDay.get(String.valueOf(r.get("d")));
                if (slot != null) slot[1] = toInt(r.get("v"));
            }
            stock.put("trend7", toTrend(days, byDay));
            stock.put("topItems", nameValue("SELECT TOP 8 k.wzdm AS k, SUM(ISNULL(k.yl,0)) AS v FROM kucun k"
                    + " WHERE ISNULL(k.asp_cancel,'N')<>'Y' GROUP BY k.wzdm ORDER BY SUM(ISNULL(k.yl,0)) DESC"));
        } catch (Exception e) {
            stock.put("panels", List.of());
            stock.put("trend7", List.of());
            stock.put("topItems", List.of());
        }
        return stock;
    }

    // ---------- 销售 ----------

    private Map<String, Object> sales() {
        Map<String, Object> sales = new HashMap<>();
        try {
            sales.put("total", count("SELECT COUNT(*) FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'"));
            sales.put("amount", sum("SELECT ISNULL(SUM(金额),0) FROM bl_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'"));
            sales.put("byStatus", nameValue("SELECT 单据状态 AS k, COUNT(*) AS v FROM bd_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据状态,'')<>'' GROUP BY 单据状态 ORDER BY COUNT(*) DESC"));
            sales.put("byCustomer", nameValue("SELECT TOP 6 客户 AS k, COUNT(*) AS v FROM bd_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(客户,'')<>'' GROUP BY 客户 ORDER BY COUNT(*) DESC"));
            sales.put("trend7", soTrend());
            sales.put("topProducts", nameValue("SELECT TOP 8 存货名称 AS k, SUM(ISNULL(数量,0)) AS v FROM bl_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货名称,'')<>'' GROUP BY 存货名称 ORDER BY SUM(ISNULL(数量,0)) DESC"));
        } catch (Exception e) {
            sales.put("byStatus", List.of());
            sales.put("byCustomer", List.of());
            sales.put("trend7", List.of());
            sales.put("topProducts", List.of());
        }
        return sales;
    }

    /** 销售近 7 天双序列:added=单据日期(新增),done=yj_doc_status.shsj(审核)按日 */
    private List<Map<String, Object>> soTrend() {
        List<String> days = lastDays(7);
        Map<String, int[]> byDay = new LinkedHashMap<>();
        for (String d : days) byDay.put(d, new int[2]);
        fillTrend(byDay, "SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(*) AS v FROM bd_so_order"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                + " GROUP BY CONVERT(varchar(10), 单据日期, 23)", 0);
        fillTrend(byDay, "SELECT CONVERT(varchar(10), s.shsj, 23) AS d, COUNT(*) AS v FROM yj_doc_status s"
                + " JOIN bd_so_order h ON h.单据编号 = s.doc_no AND ISNULL(h.asp_cancel,'N')<>'Y'"
                + " WHERE s.panel_code = 'SO_ORDER' AND s.shsj IS NOT NULL AND s.shsj >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                + " GROUP BY CONVERT(varchar(10), s.shsj, 23)", 1);
        return toTrend(days, byDay);
    }

    // ---------- 质量 ----------

    private Map<String, Object> quality() {
        Map<String, Object> quality = new HashMap<>();
        try {
            int total = sum("SELECT ISNULL(SUM(ISNULL(数量,0)),0) FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'").intValue();
            int pass = sum("SELECT ISNULL(SUM(ISNULL(合格数量,0)),0) FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'").intValue();
            int bad = sum("SELECT ISNULL(SUM(ISNULL(不良数量,0)),0) FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'").intValue();
            quality.put("total", total);
            quality.put("pass", pass);
            quality.put("passRate", total > 0 ? Math.round(pass * 100.0 / total) : 0);
            List<Map<String, Object>> byResult = new ArrayList<>();
            byResult.add(Map.of("name", "合格", "value", pass));
            byResult.add(Map.of("name", "不合格", "value", bad));
            quality.put("byResult", byResult);
            // 近 7 天送检/合格(added=送检数量,done=合格数量,Java 补零)
            Map<String, int[]> byDay = new LinkedHashMap<>();
            List<String> days = lastDays(7);
            for (String d : days) byDay.put(d, new int[2]);
            for (Map<String, Object> r : jdbc.queryForList("SELECT CONVERT(varchar(10), 日期, 23) AS d"
                    + ", SUM(ISNULL(数量,0)) AS sent, SUM(ISNULL(合格数量,0)) AS ok FROM qc_insp_detail"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 日期 >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                    + " GROUP BY CONVERT(varchar(10), 日期, 23)")) {
                int[] slot = byDay.get(String.valueOf(r.get("d")));
                if (slot != null) { slot[0] = toInt(r.get("sent")); slot[1] = toInt(r.get("ok")); }
            }
            quality.put("trend7", toTrend(days, byDay));
            quality.put("defectItems", nameValue("SELECT TOP 8 物料名称 AS k, SUM(ISNULL(不良数量,0)) AS v FROM qc_insp_detail"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(不良数量,0) > 0 GROUP BY 物料名称 ORDER BY SUM(ISNULL(不良数量,0)) DESC"));
        } catch (Exception e) {
            quality.put("total", 0);
            quality.put("pass", 0);
            quality.put("passRate", 0);
            quality.put("byResult", List.of());
            quality.put("trend7", List.of());
            quality.put("defectItems", List.of());
        }
        return quality;
    }

    // ---------- 研发 ----------

    /** 研发模块:实施计划阶段进度分布 + 近 30 天新增趋势(面板单据量由前端从 docStats 过滤 rd_ 前缀) */
    private Map<String, Object> rd() {
        Map<String, Object> rd = new HashMap<>();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT * FROM rd_plan WHERE ISNULL(asp_cancel,'N')<>'Y'");
            int notStarted = 0, doing = 0, overdue = 0, finished = 0;
            LocalDate today = LocalDate.now();
            for (Map<String, Object> r : rows) {
                int planned = 0, done = 0, late = 0;
                for (int n = 1; n <= 10; n++) {
                    String plan = str(r.get("阶段" + n + "_计划内容"));
                    if (plan == null || plan.isBlank()) continue;
                    planned++;
                    String actual = str(r.get("阶段" + n + "_实际完成"));
                    if (actual != null && !actual.isBlank()) { done++; continue; }
                    LocalDate due = parseDate(str(r.get("阶段" + n + "_计划完成")));
                    if (due != null && due.isBefore(today)) late++;
                }
                if (planned == 0) continue;
                if (late > 0) overdue++;
                else if (done >= planned) finished++;
                else if (done > 0) doing++;
                else notStarted++;
            }
            List<Map<String, Object>> stageDist = new ArrayList<>();
            stageDist.add(Map.of("name", "未开始", "value", notStarted));
            stageDist.add(Map.of("name", "进行中", "value", doing));
            stageDist.add(Map.of("name", "逾期", "value", overdue));
            stageDist.add(Map.of("name", "全部完成", "value", finished));
            rd.put("stageDist", stageDist);
            // 近 30 天实施计划新增(asp_time1 创建时间)
            Map<String, int[]> byDay = new LinkedHashMap<>();
            List<String> days = lastDays(30);
            for (String d : days) byDay.put(d, new int[2]);
            for (Map<String, Object> r : jdbc.queryForList("SELECT CONVERT(varchar(10), asp_time1, 23) AS d, COUNT(*) AS v"
                    + " FROM rd_plan WHERE ISNULL(asp_cancel,'N')<>'Y' AND asp_time1 >= DATEADD(day,-29,CONVERT(date,GETDATE()))"
                    + " GROUP BY CONVERT(varchar(10), asp_time1, 23)")) {
                int[] slot = byDay.get(String.valueOf(r.get("d")));
                if (slot != null) slot[0] = toInt(r.get("v"));
            }
            rd.put("trend30", toTrend(days, byDay));
        } catch (Exception e) {
            rd.put("stageDist", List.of());
            rd.put("trend30", List.of());
        }
        return rd;
    }

    // ---------- 工具 ----------

    private int count(String sql) {
        try {
            Integer v = jdbc.queryForObject(sql, Integer.class);
            return v == null ? 0 : v;
        } catch (Exception e) {
            return 0;
        }
    }

    private Number sum(String sql) {
        try {
            Number v = jdbc.queryForObject(sql, Number.class);
            return v == null ? 0 : v;
        } catch (Exception e) {
            return 0;
        }
    }

    /** 通用 [{name,value}] 聚合(k 列为名,v 列为值,已按调用方排序) */
    private List<Map<String, Object>> nameValue(String sql) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(sql);
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                out.add(Map.of("name", String.valueOf(r.get("k")), "value", toInt(r.get("v"))));
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 单表近 7 天双序列趋势:added = addedCol 当日行数,done = doneCol 非空当日行数(可为 null) */
    private List<Map<String, Object>> dateTrend(String table, String addedCol, String doneCol) {
        List<String> days = lastDays(7);
        Map<String, int[]> byDay = new LinkedHashMap<>();
        for (String d : days) byDay.put(d, new int[2]);
        String cancel = table.startsWith("bd_") || table.startsWith("bl_") || table.startsWith("qc_") || table.startsWith("rd_")
                ? " WHERE ISNULL(asp_cancel,'N')<>'Y'" : "";
        fillTrend(byDay, "SELECT CONVERT(varchar(10), " + addedCol + ", 23) AS d, COUNT(*) AS v FROM " + table
                + cancel + (cancel.isEmpty() ? " WHERE " : " AND ") + addedCol + " >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                + " GROUP BY CONVERT(varchar(10), " + addedCol + ", 23)", 0);
        if (doneCol != null) {
            fillTrend(byDay, "SELECT CONVERT(varchar(10), " + doneCol + ", 23) AS d, COUNT(*) AS v FROM " + table
                    + cancel + (cancel.isEmpty() ? " WHERE " : " AND ") + doneCol + " IS NOT NULL AND " + doneCol + " >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                    + " GROUP BY CONVERT(varchar(10), " + doneCol + ", 23)", 1);
        }
        return toTrend(days, byDay);
    }

    private void fillTrend(Map<String, int[]> byDay, String sql, int slotIndex) {
        try {
            for (Map<String, Object> r : jdbc.queryForList(sql)) {
                int[] slot = byDay.get(String.valueOf(r.get("d")));
                if (slot != null) slot[slotIndex] = toInt(r.get("v"));
            }
        } catch (Exception ignored) {
        }
    }

    private static List<String> lastDays(int n) {
        List<String> days = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = n - 1; i >= 0; i--) days.add(today.minusDays(i).toString());
        return days;
    }

    private static List<Map<String, Object>> toTrend(List<String> days, Map<String, int[]> byDay) {
        DateTimeFormatter shortMonth = DateTimeFormatter.ofPattern("M/d");
        List<Map<String, Object>> out = new ArrayList<>();
        for (String d : days) {
            int[] v = byDay.getOrDefault(d, new int[2]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", LocalDate.parse(d).format(shortMonth));
            m.put("added", v[0]);
            m.put("done", v[1]);
            out.add(m);
        }
        return out;
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim().substring(0, 10));
        } catch (Exception e) {
            try {
                return new java.sql.Timestamp(Long.parseLong(s)).toLocalDateTime().toLocalDate();
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v).trim();
    }

    private static int toInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }
}
