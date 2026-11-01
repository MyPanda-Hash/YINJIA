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
 *  - 生产 = 参考库 plang(工单行):完工=rk_no 已填 / 在产=其余;车间=scx;
 *    趋势=pl_date(新增)/ **cp_date2(实际完工日:入库回写)** —— cp_date 是**计划完工/交期**,
 *    2026-10-18 之前趋势把交期当完工,图上「完工 221」而状态分布只有 3 张完工,用户看着自相矛盾;
 *    工序完成率 = scjl 报工(gxdm 工序 × wgzt 完工)——未报工工序不出条,空数据=空态。
 *  - 库存 = inh/outh 两物理表(入库/出库):单数=DISTINCT 单号,行数=明细行;
 *    现存量 TOP = v_stock_balance(库存状况表)按 存货编码+存货 跨仓库 SUM,全量下发由前端滚动展示;
 *  - 销售 = bd_so_order(头)/bl_so_order(行):状态取头表「单据状态」列(展示口径);金额=行 SUM(金额);
 *    TOP 产品 = 行 GROUP BY 存货名称。
 *  - 质量 = qc_insp_detail(明细):送检=SUM(送检数量),合格=SUM(合格数量),非合格=SUM(不合格数量);
 *    趋势=按**表头 qc_insp.单据日期**分组的送检/合格双线(2026-10-15 修正列名口径,详见 quality())。
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
        return stats(null, null);
    }

    /**
     * 看板统计(2026-10-16 起支持时间区间):所有模块的**单据/事件口径**都按 [from, to] 过滤,
     * 趋势按区间分桶(≤31 天按天、更长按周)。不传或传坏值时默认「近 30 天(含今天)」。
     * ⚠ 时点值不随区间变(库存现存量、档案数、单据累计量),前端在卡片上标注「截至 to」。
     */
    public Map<String, Object> stats(String from, String to) {
        Range r = Range.of(from, to);
        Map<String, Object> out = new HashMap<>();
        out.put("range", Map.of("from", r.from().toString(), "to", r.to().toString(), "days", r.days(), "bucket", r.weekly() ? "week" : "day"));
        out.put("kpis", kpis(r));
        out.put("archives", archives());
        out.put("docStats", docStats());
        out.put("todos", todos());
        out.put("latest", latestActivities(r));
        out.put("progress", progress(r));
        out.put("production", production(r));
        out.put("stock", stock(r));
        out.put("sales", sales(r));
        out.put("quality", quality(r));
        out.put("rd", rd(r));
        return out;
    }

    /**
     * 看板时间区间(闭区间,含首尾)。非法/缺省 ⇒ 近 30 天;上限 366 天(再长就按周分桶,查询量恒定)。
     */
    public record Range(LocalDate from, LocalDate to) {
        public static Range of(String f, String t) {
            LocalDate to = parseDate(t);
            LocalDate from = parseDate(f);
            if (to == null) to = LocalDate.now();
            if (from == null) from = to.minusDays(29);
            if (from.isAfter(to)) { LocalDate x = from; from = to; to = x; }
            if (java.time.temporal.ChronoUnit.DAYS.between(from, to) > 365) from = to.minusDays(365);
            return new Range(from, to);
        }

        int days() {
            return (int) java.time.temporal.ChronoUnit.DAYS.between(from, to) + 1;
        }

        /** SQL 上界(开区间):单据日期 < toExclusive 即「含 to 当天」 */
        public String toExclusive() {
            return to.plusDays(1).toString();
        }

        public String fromStr() {
            return from.toString();
        }

        public String toStr() {
            return to.toString();
        }

        /** >31 天改按周分桶(周一为桶首),避免长区间把图表打成一片糊 */
        public boolean weekly() {
            return days() > 31;
        }

        /** 趋势桶键(升序):日桶=yyyy-MM-dd;周桶=该周周一 yyyy-MM-dd */
        List<String> buckets() {
            List<String> out = new ArrayList<>();
            if (weekly()) {
                LocalDate d = from.minusDays(from.getDayOfWeek().getValue() - 1L);
                while (!d.isAfter(to)) { out.add(d.toString()); d = d.plusWeeks(1); }
            } else {
                for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) out.add(d.toString());
            }
            return out;
        }

        /** 某天落在哪个桶(与 buckets() 同口径) */
        String bucketOf(LocalDate d) {
            if (!weekly()) return d.toString();
            return d.minusDays(d.getDayOfWeek().getValue() - 1L).toString();
        }

        /** 桶标签:日=10/16;周=10/14 起 */
        String label(String key) {
            LocalDate d = LocalDate.parse(key);
            return weekly() ? d.format(DateTimeFormatter.ofPattern("M/d")) + " 起" : d.format(DateTimeFormatter.ofPattern("M/d"));
        }
    }

    // ---------- 概览 KPI / 档案 / 单据流量 ----------

    private Map<String, Object> kpis(Range r) {
        Map<String, Object> kpis = new HashMap<>();
        // ── 生产口径统一到 plang(2026-10-15 修)────────────────────────────────
        // 修前:moActive = Σ(所有面板的「草稿」) = 48;moTotal = Σ(MANU*/WO_* 面板的草稿+已审核) = 0
        //   (MANU_ORDER/WO_ORDER 这两个面板本来就没有单据行 ⇒ moTotal 恒 0)。
        //   后果:「生产任务负载」卡主值 48、脚注「总计 0 单」自相矛盾;
        //   闭环率 = 已完工 / moTotal = 0/0 ⇒ **恒零的死指标**;
        //   而卡上那句「25 单生产中」其实是对的 —— 它来自 prod.statusDist,查的是 plang。
        //   真实工单只有 plang 一处(25 张在产)⇒ 三数统一由 plang 派生,保证 在产+已完工=总数。
        try {
            // 2026-10-16 区间化:工单按 pl_date(下达日)落在 [from, to] 内统计
            int moTotal = count("SELECT COUNT(*) FROM plang WHERE pl_date >= ? AND pl_date < ?", r.fromStr(), r.toExclusive());
            int moDone = count("SELECT COUNT(*) FROM plang WHERE rk_no IS NOT NULL AND rk_no <> '' AND pl_date >= ? AND pl_date < ?", r.fromStr(), r.toExclusive());
            kpis.put("moTotal", moTotal);
            kpis.put("moDone", moDone);
            kpis.put("moActive", Math.max(0, moTotal - moDone));
        } catch (Exception e) {
            kpis.put("moTotal", 0);
            kpis.put("moDone", 0);
            kpis.put("moActive", 0);
        }
        // 全系统草稿/已审核:保留(将来做「待处理草稿」卡要用),但卡片不再拿它当生产数
        int draftTotal = 0;
        int auditTotal = 0;
        for (Map<String, Object> row : docStats()) {
            Map<?, ?> st = (Map<?, ?>) row.get("status");
            draftTotal += toInt(st.get("草稿"));
            auditTotal += toInt(st.get("已审核"));
        }
        kpis.put("draftTotal", draftTotal);
        kpis.put("auditTotal", auditTotal);
        // ── 待审批(2026-10-16 修:此前是 `put("approvePending", 0)` **硬编码 0** 的死指标)──
        // 概览「待审批」卡此前永远显示 0,而库里明明有 pending='Y' 的单据(实测 3 条),
        // 用户口径「看板数据不够真实」正是这一类:指标接上了数据才有意义。
        // ⚠ 口径 = **时点待办**,不按区间过滤(切到"上月"也要看得见今天要审的活);
        //    已作废的不算。与之配套的单据状态机真源 = yj_doc_status.pending。
        try {
            kpis.put("approvePending", count("SELECT COUNT(*) FROM yj_doc_status"
                    + " WHERE pending = 'Y' AND ISNULL(canceled,'N') <> 'Y'"));
        } catch (Exception e) {
            kpis.put("approvePending", 0);
        }
        return kpis;
    }

    /**
     * 实时业务事件流:最近 6 条单据审核活动(取 yj_doc_status 审核留痕)。
     *
     * ⚠ 2026-10-15 前这里写的是 `out.put("latest", List.of())` —— **硬编码空列表**,
     *   卡片标题「实时业务事件流 / 来自 SQL 业务单据的最新活动」却永远只显示空态,
     *   等于一个没接数据源的死卡片。现接上真实活动(540 条可用留痕)。
     * 时间统一转成字符串下发:前端 compactTime() 按"长度 ≥ 16 的字符串"切 MM-DD HH:mm,
     *   若下发 epoch 数字会原样显示成一串毫秒。
     */
    private List<Map<String, Object>> latestActivities(Range r) {
        try {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r0 : jdbc.queryForList(
                    "SELECT TOP 6 doc_no, panel_code, shr, shsj FROM yj_doc_status"
                            + " WHERE shsj IS NOT NULL AND ISNULL(canceled,'N')<>'Y' AND ISNULL(panel_code,'')<>''"
                            + " AND shsj >= ? AND shsj < ?"
                            + " ORDER BY shsj DESC", r.fromStr(), r.toExclusive())) {
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("编号", String.valueOf(r0.get("doc_no")));
                e.put("panel", String.valueOf(r0.get("panel_code")));
                e.put("状态", "已审核");
                e.put("时间", r0.get("shsj") == null ? null : String.valueOf(r0.get("shsj")));
                e.put("操作人", r0.get("shr") == null ? "" : String.valueOf(r0.get("shr")));
                out.add(e);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 流程待办(2026-10-18):此前 out.put("todos", List.of()) 恒空,前端「流程待办」卡永远 0。
     * 真实口径 = yj_doc_status 里 pending='Y' 且未作废的单据(与 kpis() 的 approvePending 同源),
     * 面板名由 PanelRegistry 反查(查不到就回显面板码)。
     */
    private List<Map<String, Object>> todos() {
        try {
            Map<String, String> panelNames = new HashMap<>();
            for (PanelRegistry.PanelDef def : registry.all()) panelNames.put(def.code(), def.name());
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r0 : jdbc.queryForList(
                    "SELECT TOP 50 doc_no, panel_code, pending_by, pending_at FROM yj_doc_status"
                            + " WHERE pending = 'Y' AND ISNULL(canceled,'N')<>'Y'"
                            + " ORDER BY CASE WHEN pending_at IS NULL THEN 1 ELSE 0 END, pending_at DESC")) {
                String code = r0.get("panel_code") == null ? "" : String.valueOf(r0.get("panel_code"));
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("panelCode", code);
                e.put("panelName", panelNames.getOrDefault(code, code));
                e.put("docNo", r0.get("doc_no") == null ? "" : String.valueOf(r0.get("doc_no")));
                e.put("state", "待审批");
                e.put("pendingBy", r0.get("pending_by") == null ? "" : String.valueOf(r0.get("pending_by")));
                e.put("pendingAt", r0.get("pending_at") == null ? null : String.valueOf(r0.get("pending_at")));
                out.add(e);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, Object> archives() {
        Map<String, Object> archives = new HashMap<>();
        // 2026-10-18 修正:此前取 mate(mate 是 BOM 表,实测只有 1 行)⇒ 档案卡「物料」永远显示 1。
        // 真实存货档案 = bs_inv(面板 INV),与用户在「存货」面板看到的行数同源。
        archives.put("invItems", count("SELECT COUNT(*) FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'"));
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
                String col = def.groupCol();
                // 表名/列名来自元数据,拼 SQL 前做白名单(中文列名照常放行);不合规就跳过这张面板
                if (table == null || col == null || table.isBlank() || col.isBlank()
                        || !table.matches("[\\p{L}\\p{N}_]+") || !col.matches("[\\p{L}\\p{N}_]+")) continue;
                // 单数去掉空单号:COUNT(DISTINCT '') 会把「一堆空单号」算成 1 张单(WO_REPORT 实测 7 行空号)
                // ⚠ 必须与面板列表(QueryService.queryDocs)同口径:那里除了 asp_cancel 还排掉
                //   yj_doc_status.canceled='Y' 的单据。2026-10-30 用户报「看板 19 张立项申请,
                //   打开面板却是 0 张」—— 根因就是这里只看 asp_cancel,而作废/删除只写状态表
                //   (rd_approval.asp_cancel 全是 'N',状态表却 19/19 canceled='Y') ⇒ 看板虚高。
                int docs = count("SELECT COUNT(DISTINCT [" + col + "]) FROM " + table
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(RTRIM([" + col + "]),'')<>''"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ?"
                        + " AND s.doc_no = CAST([" + col + "] AS nvarchar(100)) AND s.canceled = 'Y')",
                        def.code());
                // 已审核(2026-10-18 修正):必须只数**头表里还在的单据**。
                //   原先直接数 yj_doc_status 留痕行 —— 删掉的历史单(实测 PURCHASE_IN 19 张、
                //   QC_INSP_REC 12 张)仍被算作已审核 ⇒ 面板「草稿 = 单数 − 已审核」出负数
                //   (PURCHASE_IN 313 − 332 = −19),单据流量卡与流程看板上自相矛盾。
                int audited = count("SELECT COUNT(DISTINCT s.doc_no) FROM yj_doc_status s"
                        + " WHERE s.panel_code = ? AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y'"
                        + " AND EXISTS(SELECT 1 FROM " + table + " h WHERE h.[" + col + "]=s.doc_no"
                        + " AND ISNULL(h.asp_cancel,'N')<>'Y')", def.code());
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

    /** 进行中工单(概览工单队列):区间内下达且未完工的 plang 最近 3 行 */
    private List<Map<String, Object>> progress(Range r) {
        try {
            return jdbc.queryForList("SELECT TOP 3 pl_no AS [编号], mc AS [产品], scx AS [车间], pl_sl AS [数量]"
                    + " FROM plang WHERE (rk_no IS NULL OR rk_no = '') AND pl_date >= ? AND pl_date < ?"
                    + " ORDER BY id DESC", r.fromStr(), r.toExclusive());
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- 生产 ----------

    private Map<String, Object> production(Range r) {
        Map<String, Object> prod = new HashMap<>();
        try {
            int done = count("SELECT COUNT(*) FROM plang WHERE rk_no IS NOT NULL AND rk_no <> '' AND pl_date >= ? AND pl_date < ?", r.fromStr(), r.toExclusive());
            int all = count("SELECT COUNT(*) FROM plang WHERE pl_date >= ? AND pl_date < ?", r.fromStr(), r.toExclusive());
            prod.put("statusDist", List.of(
                    Map.of("name", "已完工", "value", done),
                    Map.of("name", "生产中", "value", Math.max(0, all - done))));
            prod.put("workshopDist", nameValue("SELECT scx AS k, COUNT(*) AS v FROM plang"
                    + " WHERE ISNULL(scx,'') <> '' AND pl_date >= ? AND pl_date < ? GROUP BY scx ORDER BY COUNT(*) DESC", r.fromStr(), r.toExclusive()));
            // 完工序列(2026-10-18 修正):用 **cp_date2(首次入库当日,实际完工)**。
            //   cp_date 是计划完工/交期(全表 429 行都有值),拿它当完工会让趋势算出 221 张完工,
            //   而状态分布(按 rk_no)只有 3 张 —— 同一张卡上两个「完工」互相打脸。
            prod.put("trend7", dateTrend(r, "plang", "pl_date", "cp_date2"));
            // 工单数据截止日(2026-10-15):近 7 天趋势全 0 时,卡片要能说明"不是图坏了,
            // 是工单数据本身就停在某天" —— 实测本机 plang 的日期都在 2026-08。
            List<Map<String, Object>> lastRow = jdbc.queryForList("SELECT CONVERT(varchar(10), MAX(pl_date), 23) AS d FROM plang");
            prod.put("lastDate", lastRow.isEmpty() ? null : lastRow.get(0).get("d"));
            prod.put("stageRates", stageRates(r));
        } catch (Exception e) {
            prod.put("statusDist", List.of());
            prod.put("workshopDist", List.of());
            prod.put("trend7", List.of());
            prod.put("stageRates", List.of());
            prod.put("lastDate", null);
        }
        return prod;
    }

    /**
     * 产线日产能清单(桌面「产能对比」→「设置上限」弹窗,2026-10-18)。
     *
     * <p>与 {@link #capacity} 的上限**同一张表同一口径**(bs_prod_line.日产能 + 启用过滤),
     * 所以弹窗改完立刻回读图表就是新值;反过来在「产线档案」面板改了日产能,图表下次取数也是新值
     * —— 双向同步靠的是「同一个数据源」,不另建副本、不做二次推送。
     */
    public List<Map<String, Object>> capacityLines() {
        try {
            return jdbc.queryForList(
                    "SELECT RTRIM(生产线) AS line, ISNULL(日产能,0) AS daily FROM bs_prod_line"
                            + " WHERE ISNULL(停用,'N') <> '是' AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " AND ISNULL(生产线,'') <> '' ORDER BY RTRIM(生产线)");
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 批量写回日产(2026-10-18 用户口径:「调整之后对应的会对面板进行一个修改,是双向的修改功能」)。
     * 只改启用产线,顺带留痕 asp_user2/asp_time2(与档案面板保存同列),返回实际更新行数。
     *
     * @param items [{line: 产线名, daily: 日产能}, …]
     * @param user  当前登录账号(写入 asp_user2)
     */
    public int saveDailyCapacity(List<Map<String, Object>> items, String user) {
        if (items == null || items.isEmpty()) return 0;
        int updated = 0;
        for (Map<String, Object> it : items) {
            String line = it.get("line") == null ? "" : String.valueOf(it.get("line")).trim();
            if (line.isEmpty()) continue;
            double daily;
            try {
                daily = Double.parseDouble(String.valueOf(it.get("daily")).trim());
            } catch (RuntimeException e) {
                throw new IllegalArgumentException("日产能不是数字:" + line);
            }
            if (daily < 0) throw new IllegalArgumentException("日产能不能为负数:" + line);
            updated += jdbc.update(
                    "UPDATE bs_prod_line SET 日产能=?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE RTRIM(生产线)=? AND ISNULL(停用,'N') <> '是' AND ISNULL(asp_cancel,'N') <> 'Y'",
                    daily, user, line);
        }
        return updated;
    }

    /**
     * 产能对比(2026-10-08 用户需求:日产能对比可以切周/月/年,按产线做竖向双柱对比):
     *
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
            // 实际产出 = **报工数据**(scjl 是报工单的录入载体与事实账,2026-09-27 单表化):
            //   行上的产线名 scxmc 由「报工审核」从排产台账 plang_pc.scx 镜像写入
            //   (见 WoReportService.complete():审核时 UPDATE scjl SET scx=?, scxmc=?... wgzt='Y'),
            //   而排产选线又取自产线档案(bs_prod_line.生产线)⇒ 与图上的产线清单**同源同名**。
            //   口径:只算**已审核**(wgzt='Y')的报工 —— 草稿报工还没过账,数字可改可撤,不应进产能对比。
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT RTRIM(scxmc) AS line, SUM(ISNULL(sl,0)) AS q FROM scjl"
                            + " WHERE ISNULL(delmark,0)=0 AND ISNULL(wgzt,'N')='Y'"
                            + " AND sc_date >= ? AND sc_date < DATEADD(day, 1, ?)"
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

    /** 五工序(混料/成型/切炭/组装/装箱)报工完成率:scjl.gxdm 分组,完工=wgzt 已填;未报工工序不出条(按区间) */
    private List<Map<String, Object>> stageRates(Range r) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT gxdm AS k, COUNT(*) AS total, SUM(CASE WHEN wgzt IS NOT NULL AND wgzt <> '' THEN 1 ELSE 0 END) AS done"
                            + " FROM scjl WHERE ISNULL(gxdm,'') <> '' AND ISNULL(delmark,0) = 0"
                            + " AND sc_date >= ? AND sc_date < ?"
                            + " GROUP BY gxdm ORDER BY gxdm", r.fromStr(), r.toExclusive());
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> rr : rows) {
                int total = toInt(rr.get("total"));
                int done = toInt(rr.get("done"));
                if (total <= 0) continue;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", String.valueOf(rr.get("k")));
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

    private Map<String, Object> stock(Range r) {
        Map<String, Object> stock = new HashMap<>();
        try {
            // 2026-10-16 区间化:单据量/明细行/趋势都按 inh/outh.单据日期 落在 [from,to) 内统计;
            // 「现存量 TOP」是**时点值**(截至 to),不随区间变 —— 卡片上标注 asOf。
            int inDocs = count("SELECT COUNT(DISTINCT 单据编号) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?", r.fromStr(), r.toExclusive());
            int outDocs = count("SELECT COUNT(DISTINCT 单据编号) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?", r.fromStr(), r.toExclusive());
            int inLines = count("SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?", r.fromStr(), r.toExclusive());
            int outLines = count("SELECT COUNT(*) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?", r.fromStr(), r.toExclusive());
            stock.put("totalIn", inDocs);
            stock.put("totalOut", outDocs);
            stock.put("totalLines", inLines + outLines);
            stock.put("asOf", r.toStr());
            List<Map<String, Object>> panels = new ArrayList<>();
            panels.add(row("panelName", "入库", "count", inDocs, "lines", inLines));
            panels.add(row("panelName", "出库", "count", outDocs, "lines", outLines));
            stock.put("panels", panels);
            // 区间内出入库趋势(替代原「近 7 天」硬窗口)
            // 2026-10-18 用户口径「改成按单据数」:曲线按**单据数**画(每日 DISTINCT 单据编号),
            // 与上面的「入库单量/出库单量」KPI 同口径;明细行数另有「各单据明细行数」一张卡。
            // 改前用 COUNT(*) 画的是明细行(883/1841),图例与 KPI(306/552)对不上。
            Map<String, int[]> byDay = new LinkedHashMap<>();
            List<String> days = r.buckets();
            for (String d : days) byDay.put(d, new int[2]);
            fillTrend(r, byDay, "SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(DISTINCT 单据编号) AS v"
                    + " FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?"
                    + " GROUP BY CONVERT(varchar(10), 单据日期, 23)", 0, r.fromStr(), r.toExclusive());
            fillTrend(r, byDay, "SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(DISTINCT 单据编号) AS v"
                    + " FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?"
                    + " GROUP BY CONVERT(varchar(10), 单据日期, 23)", 1, r.fromStr(), r.toExclusive());
            stock.put("trend7", toTrend(r, byDay));
            // 2026-10-10:「现存量 TOP 物料」改绑库存状况表(STOCK_BALANCE / v_stock_balance)。
            // 旧口径读遗留快照表 kucun(kucun-resync 过程写入,asp_time2 停在 2026-10-08),
            // 且按 wzdm 物料代码分组 —— 卡片显示的是代码、且数据不随出入库实时变。
            // v_stock_balance 是实时聚合视图(v_stock_movement + inv_cost_ledger),含 存货编码/存货,
            // 故按 存货编码+存货 分组(跨仓库合计,同一物料多仓拆行需 SUM),
            // 名称作标签、编码作 meta 进 title 提示;其 asp_cancel 恒为 'N',过滤无意义故不写。
            // 2026-10-10:不设 TOP —— 卡片改滚动查看(SBars 的 scroll prop),截断会让"看不全"。
            // v_stock_balance 为聚合视图,行数=物料数(演示库 31),全量下发无压力。
            stock.put("topItems", nameValue("SELECT b.存货 AS k, SUM(b.现存量) AS v, b.存货编码 AS m"
                    + " FROM v_stock_balance b GROUP BY b.存货编码, b.存货 ORDER BY SUM(b.现存量) DESC"));
        } catch (Exception e) {
            stock.put("panels", List.of());
            stock.put("trend7", List.of());
            stock.put("topItems", List.of());
        }
        return stock;
    }

    // ---------- 销售 ----------

    private Map<String, Object> sales(Range r) {
        Map<String, Object> sales = new HashMap<>();
        // 2026-10-16 区间化:头表按 单据日期 过滤;行表(bl_so_order)无日期列,用 EXISTS 关联头表。
        String lineDate = " AND EXISTS (SELECT 1 FROM bd_so_order h WHERE h.单据编号 = bl_so_order.单据编号"
                + " AND h.单据日期 >= ? AND h.单据日期 < ?)";
        Object[] a = new Object[]{r.fromStr(), r.toExclusive()};
        try {
            sales.put("total", count("SELECT COUNT(*) FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?", a));
            sales.put("amount", sum("SELECT ISNULL(SUM(金额),0) FROM bl_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'" + lineDate, a));
            sales.put("byStatus", nameValue("SELECT 单据状态 AS k, COUNT(*) AS v FROM bd_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据状态,'')<>'' AND 单据日期 >= ? AND 单据日期 < ? GROUP BY 单据状态 ORDER BY COUNT(*) DESC", a));
            sales.put("byCustomer", nameValue("SELECT TOP 6 客户 AS k, COUNT(*) AS v FROM bd_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(客户,'')<>'' AND 单据日期 >= ? AND 单据日期 < ? GROUP BY 客户 ORDER BY COUNT(*) DESC", a));
            sales.put("trend7", soTrend(r));
            sales.put("trend30", soTrend(r));
            sales.put("topProducts", nameValue("SELECT TOP 8 存货名称 AS k, SUM(ISNULL(数量,0)) AS v FROM bl_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货名称,'')<>''" + lineDate + " GROUP BY 存货名称 ORDER BY SUM(ISNULL(数量,0)) DESC", a));
            // ── 2026-10-15 补「金额维度」与「口径对得上」 ────────────────────────────
            // ⚠ 原设计只有 TOP6 且过滤掉客户为空的行 ⇒ 甜甜圈中心 98 而 KPI 写 335,用户以为丢单。
            //   新增的 customerShare* 把 TOP6 之外的聚合成「其它」、空客户单列「未填客户」,
            //   **各片合计恒等于全量**(订单数口径=total,金额口径=amount),与 KPI 永远对得上。
            sales.put("customerShare", customerShare(
                    "SELECT CASE WHEN ISNULL(RTRIM(h.客户),N'')=N'' THEN N'__BLANK__' ELSE RTRIM(h.客户) END AS k,"
                            + " COUNT(*) AS v FROM bd_so_order h WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                            + " AND h.单据日期 >= '" + r.fromStr() + "' AND h.单据日期 < '" + r.toExclusive() + "' GROUP BY"
                            + " CASE WHEN ISNULL(RTRIM(h.客户),N'')=N'' THEN N'__BLANK__' ELSE RTRIM(h.客户) END"));
            sales.put("customerShareAmount", customerShare(
                    "SELECT CASE WHEN ISNULL(RTRIM(h.客户),N'')=N'' THEN N'__BLANK__' ELSE RTRIM(h.客户) END AS k,"
                            + " SUM(ISNULL(l.金额,0)) AS v FROM bd_so_order h JOIN bl_so_order l ON l.单据编号 = h.单据编号"
                            + " WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                            + " AND h.单据日期 >= '" + r.fromStr() + "' AND h.单据日期 < '" + r.toExclusive() + "' GROUP BY"
                            + " CASE WHEN ISNULL(RTRIM(h.客户),N'')=N'' THEN N'__BLANK__' ELSE RTRIM(h.客户) END"));
            sales.put("topProductsAmount", nameValue("SELECT TOP 8 存货名称 AS k, SUM(ISNULL(金额,0)) AS v FROM bl_so_order"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货名称,'')<>''" + lineDate + " GROUP BY 存货名称 ORDER BY SUM(ISNULL(金额,0)) DESC", a));
        } catch (Exception e) {
            sales.put("byStatus", List.of());
            sales.put("byCustomer", List.of());
            sales.put("trend7", List.of());
            sales.put("trend30", List.of());
            sales.put("topProducts", List.of());
            sales.put("topProductsAmount", List.of());
            sales.put("customerShare", List.of());
            sales.put("customerShareAmount", List.of());
        }
        return sales;
    }

    /**
     * 客户分布(聚合版):TOP6 + 「未填客户」+ 「其它」 —— 各片合计**恒等于全量**。
     * 与 byCustomer 的区别:byCustomer 是纯 TOP6 且丢掉空客户的行,合计对不上 KPI。
     * 排序按值降序;「未填客户」已在 TOP6 内则不重复追加;其余不足 6 名的并成「其它」。
     */
    private List<Map<String, Object>> customerShare(String sql) {
        try {
            List<Map<String, Object>> named = new ArrayList<>();
            Map<String, Object> blank = null;
            for (Map<String, Object> r : jdbc.queryForList(sql)) {
                String k = String.valueOf(r.get("k"));
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name", "__BLANK__".equals(k) ? "未填客户" : k);
                item.put("value", toNum(r.get("v")));
                if ("__BLANK__".equals(k)) blank = item; else named.add(item);
            }
            named.sort((a, b) -> Double.compare(numOf(b), numOf(a)));
            List<Map<String, Object>> out = new ArrayList<>();
            double rest = 0;
            for (int i = 0; i < named.size(); i++) {
                if (i < 6) out.add(named.get(i)); else rest += numOf(named.get(i));
            }
            boolean blankInTop = out.stream().anyMatch((x) -> "未填客户".equals(x.get("name")));
            if (blank != null && !blankInTop && numOf(blank) > 0) out.add(blank);
            if (rest > 0) {
                Map<String, Object> other = new LinkedHashMap<>();
                other.put("name", "其它");
                other.put("value", toNum(rest));
                out.add(other);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private static double numOf(Map<String, Object> m) {
        Object v = m == null ? null : m.get("value");
        return v instanceof Number n ? n.doubleValue() : 0;
    }

    /**
     * 销售趋势(区间内),added=单据日期(新增),done=**同一批订单里状态为已审核的**。
     *
     * <p>2026-10-18 用户口径「统一」:原先 done 按 yj_doc_status.shsj(审核动作时间)分桶,
     * 区间内算出 141 件审核动作,而 KPI「已审核订单」= 124(区间内创建且已审核) —— 同一页两个
     * 「已审核」数不同。现统一到**单据日期**这一条时间轴:两条线都只数区间内创建的订单,
     * done 再叠加"已审核"条件 ⇒ 日/合计与 KPI 完全一致(当前数据 added=done=124)。
     * 审核动作时间维度不再用于看板(工单/单据详情页仍有审核留痕)。
     */
    private List<Map<String, Object>> soTrend(Range r) {
        List<String> days = r.buckets();
        Map<String, int[]> byDay = new LinkedHashMap<>();
        for (String d : days) byDay.put(d, new int[2]);
        fillTrend(r, byDay, "SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(*) AS v FROM bd_so_order"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= ? AND 单据日期 < ?"
                + " GROUP BY CONVERT(varchar(10), 单据日期, 23)", 0, r.fromStr(), r.toExclusive());
        fillTrend(r, byDay, "SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(*) AS v FROM bd_so_order"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据状态 = N'已审核' AND 单据日期 >= ? AND 单据日期 < ?"
                + " GROUP BY CONVERT(varchar(10), 单据日期, 23)", 1, r.fromStr(), r.toExclusive());
        return toTrend(r, byDay);
    }

    // ---------- 质量 ----------

    private Map<String, Object> quality(Range r) {
        Map<String, Object> quality = new HashMap<>();
        try {
            // ⚠ 列名口径(2026-10-15 修正):明细的数量列在面板上叫「送检数量」、不良列叫「不合格数量」——
            //   2026-09-20 改过名(PanelConfigService.java:1148 / ButtonService.java:830),本方法当时漏改,
            //   仍在 SUM(数量) / SUM(不良数量),而这两列**没有 yj_field**(面板无从录入)⇒ 看板恒 0。
            // 2026-10-16 区间化:按表头 qc_insp.单据日期 落在 [from,to) 内统计。
            String joined = " FROM qc_insp_detail d JOIN qc_insp h ON h.单据编号 = d.单据编号"
                    + " WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND h.单据日期 >= ? AND h.单据日期 < ?";
            Object[] a = new Object[]{r.fromStr(), r.toExclusive()};
            int total = sum("SELECT ISNULL(SUM(ISNULL(d.送检数量,0)),0)" + joined, a).intValue();
            int pass = sum("SELECT ISNULL(SUM(ISNULL(d.合格数量,0)),0)" + joined, a).intValue();
            int bad = sum("SELECT ISNULL(SUM(ISNULL(d.不合格数量,0)),0)" + joined, a).intValue();
            quality.put("total", total);
            quality.put("pass", pass);
            // 非合格数由后端下发:前端原用 total−pass,而 total 是另一列的口径,一旦两列不同源就会出负数
            quality.put("bad", bad);
            quality.put("passRate", total > 0 ? Math.round(pass * 100.0 / total) : 0);
            List<Map<String, Object>> byResult = new ArrayList<>();
            byResult.add(Map.of("name", "合格", "value", pass));
            byResult.add(Map.of("name", "不合格", "value", bad));
            quality.put("byResult", byResult);
            // 近 7 天送检/合格(added=送检数量,done=合格数量,Java 补零)
            // 日期口径(2026-10-15 用户拍板):按**表头 qc_insp.单据日期**分组。
            //   明细的「日期」列是 nvarchar(40) 且 hidden=1(面板看不见、靠链路带),既取不到值,
            //   拿字符串跟日期比还会隐式转换报错 ⇒ 整段掉进 catch 静默全 0。
            Map<String, int[]> byDay = new LinkedHashMap<>();
            List<String> days = r.buckets();
            for (String d : days) byDay.put(d, new int[2]);
            fillSentOk(r, byDay, "SELECT CONVERT(varchar(10), h.单据日期, 23) AS d"
                    + ", SUM(ISNULL(d.送检数量,0)) AS sent, SUM(ISNULL(d.合格数量,0)) AS ok"
                    + " FROM qc_insp_detail d JOIN qc_insp h ON h.单据编号 = d.单据编号"
                    + " WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND h.单据日期 >= ? AND h.单据日期 < ?"
                    + " GROUP BY CONVERT(varchar(10), h.单据日期, 23)", r.fromStr(), r.toExclusive());
            quality.put("trend7", toTrend(r, byDay));
            quality.put("defectItems", nameValue("SELECT TOP 8 d.物料名称 AS k, SUM(ISNULL(d.不合格数量,0)) AS v FROM qc_insp_detail d"
                    + " JOIN qc_insp h ON h.单据编号 = d.单据编号"
                    + " WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.不合格数量,0) > 0"
                    + " AND h.单据日期 >= ? AND h.单据日期 < ? GROUP BY d.物料名称 ORDER BY SUM(ISNULL(d.不合格数量,0)) DESC",
                    r.fromStr(), r.toExclusive()));
        } catch (Exception e) {
            quality.put("total", 0);
            quality.put("pass", 0);
            quality.put("bad", 0);
            quality.put("passRate", 0);
            quality.put("byResult", List.of());
            quality.put("trend7", List.of());
            quality.put("defectItems", List.of());
        }
        return quality;
    }

    // ---------- 研发 ----------

    /** 研发模块:实施计划阶段进度分布 + 区间内新增趋势(面板单据量由前端从 docStats 过滤 rd_ 前缀) */
    private Map<String, Object> rd(Range r) {
        Map<String, Object> rd = new HashMap<>();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT * FROM rd_plan WHERE ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND asp_time1 >= ? AND asp_time1 < ?", r.fromStr(), r.toExclusive());
            int notStarted = 0, doing = 0, overdue = 0, finished = 0;
            LocalDate today = LocalDate.now();
            for (Map<String, Object> rr : rows) {
                int planned = 0, done = 0, late = 0;
                for (int n = 1; n <= 10; n++) {
                    String plan = str(rr.get("阶段" + n + "_计划内容"));
                    if (plan == null || plan.isBlank()) continue;
                    planned++;
                    String actual = str(rr.get("阶段" + n + "_实际完成"));
                    if (actual != null && !actual.isBlank()) { done++; continue; }
                    LocalDate due = parseDate(str(rr.get("阶段" + n + "_计划完成")));
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
            // 区间内实施计划新增(asp_time1 创建时间)
            Map<String, int[]> byDay = new LinkedHashMap<>();
            List<String> days = r.buckets();
            for (String d : days) byDay.put(d, new int[2]);
            fillTrend(r, byDay, "SELECT CONVERT(varchar(10), asp_time1, 23) AS d, COUNT(*) AS v"
                    + " FROM rd_plan WHERE ISNULL(asp_cancel,'N')<>'Y' AND asp_time1 >= ? AND asp_time1 < ?"
                    + " GROUP BY CONVERT(varchar(10), asp_time1, 23)", 0, r.fromStr(), r.toExclusive());
            rd.put("trend30", toTrend(r, byDay));
        } catch (Exception e) {
            rd.put("stageDist", List.of());
            rd.put("trend30", List.of());
        }
        return rd;
    }

    // ---------- 工具 ----------

    private int count(String sql, Object... args) {
        try {
            Integer v = jdbc.queryForObject(sql, Integer.class, args);
            return v == null ? 0 : v;
        } catch (Exception e) {
            return 0;
        }
    }

    private Number sum(String sql, Object... args) {
        try {
            Number v = jdbc.queryForObject(sql, Number.class, args);
            return v == null ? 0 : v;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * 通用 [{name,value}] 聚合(k 列为名,v 列为值,已按调用方排序)。
     * 可选 m 列作为 meta(SBars 行 title 提示用,如物料编码);缺列不影响其它调用方。
     */
    private List<Map<String, Object>> nameValue(String sql, Object... args) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name", String.valueOf(r.get("k")));
                item.put("value", toNum(r.get("v")));
                if (r.containsKey("m") && r.get("m") != null) item.put("meta", String.valueOf(r.get("m")).trim());
                out.add(item);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 单表区间双序列趋势:added = addedCol 落在区间内的行数,done = doneCol 非空且落在区间内的行数 */
    private List<Map<String, Object>> dateTrend(Range r, String table, String addedCol, String doneCol) {
        List<String> days = r.buckets();
        Map<String, int[]> byDay = new LinkedHashMap<>();
        for (String d : days) byDay.put(d, new int[2]);
        String cancel = table.startsWith("bd_") || table.startsWith("bl_") || table.startsWith("qc_") || table.startsWith("rd_")
                ? " WHERE ISNULL(asp_cancel,'N')<>'Y'" : "";
        fillTrend(r, byDay, "SELECT CONVERT(varchar(10), " + addedCol + ", 23) AS d, COUNT(*) AS v FROM " + table
                + cancel + (cancel.isEmpty() ? " WHERE " : " AND ") + addedCol + " >= ? AND " + addedCol + " < ?"
                + " GROUP BY CONVERT(varchar(10), " + addedCol + ", 23)", 0, r.fromStr(), r.toExclusive());
        if (doneCol != null) {
            fillTrend(r, byDay, "SELECT CONVERT(varchar(10), " + doneCol + ", 23) AS d, COUNT(*) AS v FROM " + table
                    + cancel + (cancel.isEmpty() ? " WHERE " : " AND ") + doneCol + " IS NOT NULL AND " + doneCol + " >= ? AND " + doneCol + " < ?"
                    + " GROUP BY CONVERT(varchar(10), " + doneCol + ", 23)", 1, r.fromStr(), r.toExclusive());
        }
        return toTrend(r, byDay);
    }

    /** 逐日结果按区间桶汇总(v 列);日桶=当天,周桶=该周周一 */
    private void fillTrend(Range r, Map<String, int[]> byDay, String sql, int slotIndex, Object... args) {
        try {
            for (Map<String, Object> row : jdbc.queryForList(sql, args)) {
                String d = String.valueOf(row.get("d"));
                int[] slot = byDay.get(r.bucketOf(LocalDate.parse(d)));
                if (slot != null) slot[slotIndex] += toInt(row.get("v"));
            }
        } catch (Exception ignored) {
        }
    }

    /** 逐日结果按区间桶汇总(sent/ok 两列,检验趋势用) */
    private void fillSentOk(Range r, Map<String, int[]> byDay, String sql, Object... args) {
        try {
            for (Map<String, Object> row : jdbc.queryForList(sql, args)) {
                int[] slot = byDay.get(r.bucketOf(LocalDate.parse(String.valueOf(row.get("d")))));
                if (slot != null) { slot[0] += toInt(row.get("sent")); slot[1] += toInt(row.get("ok")); }
            }
        } catch (Exception ignored) {
        }
    }

    /** 桶键 → 图表点(date=桶标签,added/done=双序列值) */
    private static List<Map<String, Object>> toTrend(Range r, Map<String, int[]> byDay) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String d : r.buckets()) {
            int[] v = byDay.getOrDefault(d, new int[2]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", r.label(d));
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

    /**
     * 数值取整:整数值原样返回 int(保持既有调用方 JSON 不变),
     * 小数保留 2 位(现存量/数量类字段是 decimal,用 toInt 会截断)。
     */
    private static Object toNum(Object v) {
        double d;
        if (v instanceof Number n) d = n.doubleValue();
        else {
            try {
                d = Double.parseDouble(String.valueOf(v).trim());
            } catch (Exception e) {
                return 0;
            }
        }
        if (Double.isNaN(d) || Double.isInfinite(d)) return 0;
        if (d == Math.rint(d) && d >= Integer.MIN_VALUE && d <= Integer.MAX_VALUE) return (int) d;
        return Math.round(d * 100) / 100.0;
    }

    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }
}
