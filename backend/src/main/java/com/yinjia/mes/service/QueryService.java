package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 查询服务:把 HSDZ_MES 真实表数据映射为 light-mes 行契约。
 * 行契约:{..表头字段(中文标签), 编号, 单据状态, 审核人, 审核时间, detail:{items:[...]}}
 * - doc 模式:按 yj_panel.group_col 分组,一张单一行,明细挂在 detail.items
 *   * 单表式(inh/outh/Porder/mate):头字段取首行(旧行表本身携带头信息)
 *   * 头行式(order_bt+order_bs):头查头表,行查行表
 * - archive 模式:整份档案合成一张"单单据",记录行在 detail.items
 */
@Service
public class QueryService {

    private final PanelRegistry registry;
    private final JdbcTemplate jdbc;
    private final TranslationService translations;

    public QueryService(PanelRegistry registry, JdbcTemplate jdbc, TranslationService translations) {
        this.registry = registry;
        this.jdbc = jdbc;
        this.translations = translations;
    }

    public Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                 Map<String, Object> condition, int pageNo, int pageSize) {
        return queryFormDataList(panelCode, keyword, condition, pageNo, pageSize, null);
    }

    /**
     * @param advFilters 查询弹窗「高级筛选」条件行 [{field=字段标签, op, value}];仅平表模式(报表)生效,
     *                   逐条 AND 并入 WHERE —— 全表过滤,分页 totalSize 与导出口径一致。
     *                   单据/档案模式忽略该参数(它们本来就在 Java 侧按行过滤)。
     */
    public Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                 Map<String, Object> condition, int pageNo, int pageSize,
                                                 List<Map<String, Object>> advFilters) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        Map<String, String> l2c = def.labelToCol();
        if ("flat".equals(def.mode())) return queryFlat(def, keyword, condition, l2c, pageNo, pageSize, advFilters);
        return def.isDoc() ? queryDocs(def, keyword, condition, l2c, pageNo, pageSize)
                : queryArchive(def, keyword, condition, l2c, pageNo, pageSize);
    }

    // ============ 平表模式(报表/库存状况,一行一记录直接返回) ============

    private Map<String, Object> queryFlat(PanelRegistry.PanelDef def, String keyword,
                                          Map<String, Object> condition, Map<String, String> l2c,
                                          int pageNo, int pageSize, List<Map<String, Object>> advFilters) {
        boolean ledger = "STOCK_LEDGER".equals(def.code()); // 台账:正序 + 首期初行/末期末行(T+ 三段式)
        String hint = recompileOnRead(def.lineTable()) ? " OPTION (RECOMPILE)" : "";
        String cols = selectCols(def, def.fields());
        StringBuilder where = new StringBuilder("WHERE ISNULL(t.asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        appendDirectFilters(def, def.lineTable(), where, args, keyword, condition, l2c, "t");
        appendAdvFilters(advFilters, where, args, l2c, "t");

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.lineTable() + " t " + where + hint, Integer.class, args.toArray());

        String sql = "SELECT t.id AS __id, " + cols + " FROM " + def.lineTable() + " t " + where
                + " ORDER BY t.id " + (ledger ? "ASC" : "DESC") + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY" + hint;
        args.add((pageNo - 1) * pageSize);
        args.add(pageSize);
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = rowToLabels(def, r, true);
            if (ledger) { // 明细行不重复显示期初列(期初只在首行汇总呈现,T+ 同款)
                m.put("期初数量", null); m.put("期初平均单价", null); m.put("期初金额", null);
            }
            list.add(m);
        }

        // 台账三段式:首行=期初结存(仅期初组有值),末行=期末结存(仅期末组有值)。
        // 期初=查询段起点前的累计;期末=期初+段内净额。依赖弹窗必填的 仓库/存货/日期段。
        int totalOut = total == null ? 0 : total;
        if (ledger && condition != null) {
            String wh = strOf(condition.get("仓库"));
            String item = strOf(condition.get("存货"));
            String ds = strOf(condition.get("开始日期"));
            String de = strOf(condition.get("结束日期"));
            if (!wh.isBlank() && !item.isBlank() && !ds.isBlank() && !de.isBlank()) {
                // 期初 = 段起点前累计(视图中限 单据日期<=de 的行,取 <ds 部分;用视图暴露的收入/发出列)
                Map<String, Object> opening = jdbc.queryForMap(
                        "SELECT ISNULL(SUM(CASE WHEN 单据日期 < ? THEN 收入数量 - 发出数量 ELSE 0 END),0) AS q,"
                                + " ISNULL(SUM(CASE WHEN 单据日期 < ? THEN 收入金额 - 发出金额 ELSE 0 END),0) AS a"
                                + " FROM v_stock_ledger WHERE RTRIM(仓库)=? AND RTRIM(存货)=? AND 单据日期 <= ?" + hint,
                        ds, ds, wh, item, de);
                double oq = numD(opening.get("q")), oa = numD(opening.get("a"));
                Map<String, Object> netm = jdbc.queryForMap(
                        "SELECT ISNULL(SUM(收入数量 - 发出数量),0) AS q, ISNULL(SUM(收入金额 - 发出金额),0) AS a"
                                + " FROM v_stock_ledger WHERE RTRIM(仓库)=? AND RTRIM(存货)=? AND 单据日期 >= ? AND 单据日期 <= ?" + hint,
                        wh, item, ds, de);
                double cq = oq + numD(netm.get("q")), ca = oa + numD(netm.get("a"));
                totalOut += 2;
                int lastPage = (int) Math.ceil(totalOut / (double) pageSize);
                if (pageNo == 1) list.add(0, ledgerRow("期初结存", oq, oa, null, null));
                if (pageNo == lastPage) list.add(ledgerRow("期末结存", null, null, cq, ca));
            }
        }

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", totalOut);
        out.put("list", list);
        return out;
    }

    /**
     * 取数是否要带 OPTION (RECOMPILE) —— 库存报表 4 张「报表式平表」专属(2026-09-22)。
     *
     * <p>为什么必须加:这 4 张表的取数参与表全是**无索引堆表**(已由
     * tools/migrate-stock-report-perf.sql 补索引与统计信息),兼容级别 100 下基数估算
     * 极易退化;坏计划一旦进计划缓存就**永不重优化**。实测同一条 SQL、同一份数据:
     * 缓存计划 65,021 ms vs OPTION (RECOMPILE) 42 ms,差 600 倍 —— 前端 axios 15 s 超时
     * 就是这么来的。视图**不能带 hint**,故只能在取数 SQL 上补。
     *
     * <p>代价可忽略:这几张报表最大 247 行,单次编译约 ms 级;调用方对 4 张表之外的
     * 面板不产生任何影响(单据/档案模式走 queryDocs/queryArchive,与此无关)。
     */
    private static boolean recompileOnRead(String lineTable) {
        switch (lineTable == null ? "" : lineTable) {
            case "v_stock_balance":  // STOCK_BALANCE 库存状况表
            case "v_stock_ledger":   // STOCK_LEDGER  库存台账
            case "v_stock_summary":  // STOCK_SUMMARY 收发存汇总表
            case "kucun":            // STOCK_STATUS  库存状况
                return true;
            default:
                return false;
        }
    }

    /** 台账合成行:期初行只填期初组,期末行只填期末组;单价=金额/数量(数量0→0) */
    private Map<String, Object> ledgerRow(String type, Double oq, Double oa, Double cq, Double ca) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据类型", type);
        if (oq != null) {
            m.put("期初数量", oq);
            m.put("期初平均单价", oq != 0 && oa != null ? oa / oq : 0);
            m.put("期初金额", oa);
        }
        if (cq != null) {
            m.put("期末数量", cq);
            m.put("期末平均单价", cq != 0 && ca != null ? ca / cq : 0);
            m.put("期末金额", ca);
        }
        return m;
    }

    private double numD(Object v) { return v == null ? 0 : ((Number) v).doubleValue(); }
    private String strOf(Object v) { return v == null ? "" : String.valueOf(v).trim(); }

    // ============ 档案模式(单单据) ============
    // 档案保存语义 = 全量明细 upsert(缺席行=已删除),因此查询必须返回全量行,
    // 否则截断会造成"未加载的行被误删"。上限内全量返回;超出上限时 ButtonService.saveArchive
    // 的同值护栏会拒绝保存(2026-09-16:商品 bs_inv 已 3850 行,旧上限 2000 已被击穿)。

    /** 档案全量加载/保存护栏共用上限(行) */
    public static final int ARCH_LOAD_CAP = 50_000;

    private Map<String, Object> queryArchive(PanelRegistry.PanelDef def, String keyword,
                                             Map<String, Object> condition, Map<String, String> l2c,
                                             int pageNo, int pageSize) {
        String cols = selectCols(def, def.fields());
        StringBuilder where = new StringBuilder("WHERE ISNULL(t.asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        appendDirectFilters(def, def.lineTable(), where, args, keyword, condition, l2c, "t");

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.lineTable() + " t " + where, Integer.class, args.toArray());

        // 全量返回(上限 ARCH_LOAD_CAP):保存语义为"缺席行=已删除",必须保证明细完整
        String sql = "SELECT t.id AS __id, " + cols + " FROM " + def.lineTable() + " t " + where
                + " ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT " + ARCH_LOAD_CAP + " ROWS ONLY";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) items.add(rowToLabels(def, r, true));

        // 单单据契约:一张虚拟单承载整份档案,记录在 detail.<tabKey>(light-mes §八)
        Map<String, Object> doc = new LinkedHashMap<>();
        // 档案虚拟单据的"编号"=面板名:按请求 locale 下发译名(显示层,数据层仍中文面板名)
        String localeKey = TranslationService.localeKey(org.springframework.context.i18n.LocaleContextHolder.getLocale());
        String docName = "zh".equals(localeKey) ? def.name()
                : translations.scope(localeKey, "panel").getOrDefault(def.name(), def.name());
        doc.put("编号", docName);
        doc.put("状态", "启用");
        doc.put("单据状态", "启用");
        doc.put("detail", Map.of(def.tabKey(), items));

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", total == null ? 0 : total);
        out.put("list", List.of(doc));
        return out;
    }

    // ============ 单据模式 ============

    private Map<String, Object> queryDocs(PanelRegistry.PanelDef def, String keyword,
                                          Map<String, Object> condition, Map<String, String> l2c,
                                          int pageNo, int pageSize) {
        boolean split = def.hasHeadTable();
        String docTable = split ? def.headTable() : def.lineTable();
        String g = def.groupCol();
        List<PanelRegistry.FieldDef> docCols = split ? def.fieldsAt("header") : def.fields();

        StringBuilder where = new StringBuilder("WHERE ISNULL(t.asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        // 文件面板「查询单据」自定义条件:_docNo=编号模糊(单据编号/文档编号),_archFrom/_archTo=首次归档时间区间(含端点)
        Object qDocNo = condition == null ? null : condition.get("_docNo");
        Object qFrom = condition == null ? null : condition.get("_archFrom");
        Object qTo = condition == null ? null : condition.get("_archTo");
        Map<String, Object> fieldCond = condition;
        if (qDocNo != null || qFrom != null || qTo != null) {
            fieldCond = new HashMap<>(condition);
            fieldCond.remove("_docNo");
            fieldCond.remove("_archFrom");
            fieldCond.remove("_archTo");
        }
        appendDocFilters(def, where, args, keyword, fieldCond, l2c, split, docCols, docTable, g);
        String noKw = qDocNo == null ? "" : String.valueOf(qDocNo).trim();
        if (!noKw.isEmpty()) {
            where.append(" AND (t.[").append(g).append("] LIKE ?");
            args.add("%" + noKw + "%");
            boolean hasDocNoCol = split && docCols.stream().anyMatch(f -> "文档编号".equals(f.label()));
            if (hasDocNoCol) {
                where.append(" OR t.[文档编号] LIKE ?");
                args.add("%" + noKw + "%");
            }
            where.append(")");
        }
        String archFrom = qFrom == null ? "" : String.valueOf(qFrom).trim();
        String archTo = qTo == null ? "" : String.valueOf(qTo).trim();
        if (!archFrom.isEmpty() || !archTo.isEmpty()) {
            where.append(" AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = t.[")
                    .append(g).append("] AND s.archived_at IS NOT NULL");
            args.add(def.code());
            if (!archFrom.isEmpty()) {
                where.append(" AND s.archived_at >= ?");
                args.add(archFrom);
            }
            if (!archTo.isEmpty()) {
                where.append(" AND s.archived_at < DATEADD(day, 1, ?)");
                args.add(archTo);
            }
            where.append(")");
        }

        // CAST 统一为 nvarchar:date 类型的组列(如 bd_manu_order.合同号)与 doc_no 比较时不会隐式转换失败
        where.append(" AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = CAST(t.[")
                .append(g).append("] AS nvarchar(100)) AND s.canceled = 'Y')");
        args.add(def.code());

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT t.[" + g + "]) FROM " + docTable + " t " + where,
                Integer.class, args.toArray());

        // 默认排序:创建时间(asp_time1)倒序 = 最新单据在第一页 / 左栏「单据选择」顶部(2026-09-20 起全面板统一)。
        // 旧写法按组列(单据编号)字符串降序,只在单号零填充时才等价于"最新在上":一旦混入外部系统单号
        // (金蝶星辰同步的 SO_ORDER/PU_ORDER,如 ZXL25041701 与 ZXL-20260914-02)或历史前缀单
        // (如 TCGRK-* 与 PI-* 混排,'T' > 'P')就会把老单顶到第一页、新单挤到第二页。
        // GROUP BY 后 ORDER BY 只能引用分组列或聚合:
        //   MAX(asp_time1) DESC → 取组内最新时间(=该单创建时间);asp_time1 全空的单据排最后;
        //   单据编号 DESC 兜底 → 同一秒并列时排序稳定,保证 OFFSET/FETCH 分页不重不漏。
        String orderBy = "MAX(t.asp_time1) DESC, t.[" + g + "] DESC";
        String pageSql = "SELECT t.[" + g + "] AS __no FROM " + docTable + " t " + where
                + " GROUP BY t.[" + g + "]"
                + " ORDER BY " + orderBy
                + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add((pageNo - 1) * pageSize);
        pageArgs.add(pageSize);
        List<String> docNos = jdbc.query(pageSql, (rs, i) -> rs.getString(1), pageArgs.toArray());

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", total == null ? 0 : total);
        out.put("list", docNos.isEmpty() ? List.of() : loadDocs(def, docNos));
        return out;
    }

    /** 取一批单号的完整单据(头+明细),保持入参顺序 */
    public List<Map<String, Object>> loadDocs(PanelRegistry.PanelDef def, List<String> docNos) {
        if (docNos.isEmpty()) return List.of();
        boolean split = def.hasHeadTable();
        String g = def.groupCol();
        String in = String.join(",", docNos.stream().map(n -> "?").toList());

        // 明细行(行表):单表式选全部字段列,头行式选明细列
        List<PanelRegistry.FieldDef> lineCols = split ? def.fieldsAt("detail") : def.fields();
        String lineSql = "SELECT t.id AS __id, t.[" + g + "] AS __no, " + selectCols(def, lineCols)
                + " FROM " + def.lineTable() + " t WHERE t.[" + g + "] IN (" + in + ")"
                + " AND ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.[" + g + "], t.id";
        List<Map<String, Object>> lineRows = jdbc.queryForList(lineSql, docNos.toArray());

        Map<String, List<Map<String, Object>>> byDoc = new LinkedHashMap<>();
        for (String no : docNos) byDoc.put(no, new ArrayList<>());
        for (Map<String, Object> r : lineRows) {
            byDoc.computeIfAbsent(String.valueOf(r.get("__no")), k -> new ArrayList<>())
                    .add(rowToLabels(def, r, true));
        }

        // 头表(头行式)
        Map<String, Map<String, Object>> headRows = new HashMap<>();
        if (split) {
            String headSql = "SELECT t.id AS __id, t.[" + g + "] AS __no, " + selectCols(def, def.fieldsAt("header"))
                    + " FROM " + def.headTable() + " t WHERE t.[" + g + "] IN (" + in + ")";
            for (Map<String, Object> r : jdbc.queryForList(headSql, docNos.toArray())) {
                headRows.put(String.valueOf(r.get("__no")), r);
            }
        }

        Map<String, Map<String, Object>> status = loadStatus(def.code(), docNos);

        List<Map<String, Object>> docs = new ArrayList<>();
        for (String no : byDoc.keySet()) {
            List<Map<String, Object>> items = byDoc.get(no);
            Map<String, Object> doc = new LinkedHashMap<>();
            Map<String, Object> headRow = headRows.get(no);
            if (headRow != null) {
                doc.putAll(rowToLabels(def, headRow, false));
            } else if (!items.isEmpty()) {
                Map<String, Object> first = items.get(0);
                for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
                    if (first.containsKey(f.label())) doc.putIfAbsent(f.label(), first.get(f.label()));
                }
            }
            doc.put("编号", no);
            Map<String, Object> st = status.get(no);
            String statusText = docStatus(st);
            doc.put("单据状态", statusText);
            doc.put("saved", st != null ? st.get("saved") : null);
            doc.put("detail", Map.of("items", items));
            if (st != null && st.get("shr") != null) {
                doc.put("审核人", st.get("shr"));
                doc.put("审核时间", st.get("shsj"));
                doc.put("审批状态", "已通过");
            } else if ("审批中".equals(statusText)) {
                doc.put("审批状态", "审批中");
                doc.put("提交人", st.get("pending_by"));
                Object pat = st.get("pending_at");
                doc.put("提交时间", pat == null ? "" : pat);
            }
            docs.add(doc);
        }
        return docs;
    }

    /** 取一张单据(getFormDescriptor 用) */
    public Map<String, Object> loadOneDoc(PanelRegistry.PanelDef def, String docNo) {
        List<Map<String, Object>> docs = loadDocs(def, List.of(docNo));
        if (docs.isEmpty()) throw new IllegalArgumentException("表单数据不存在：" + docNo);
        return docs.get(0);
    }

    private Map<String, Map<String, Object>> loadStatus(String panelCode, List<String> docNos) {
        String in = String.join(",", docNos.stream().map(n -> "?").toList());
        List<Object> args = new ArrayList<>(List.of(panelCode));
        args.addAll(docNos);
        Map<String, Map<String, Object>> out = new HashMap<>();
        jdbc.query("SELECT doc_no, shr, shsj, canceled, stopped, pending, pending_by, pending_at, archived, deleting, modify_state, saved, approve_node, l2_approver, effective, erp_close_state FROM yj_doc_status"
                + " WHERE panel_code = ? AND doc_no IN (" + in + ")", rs -> {
            Map<String, Object> m = new HashMap<>();
            m.put("shr", rs.getString("shr"));
            m.put("shsj", rs.getTimestamp("shsj"));
            m.put("canceled", rs.getString("canceled"));
            m.put("stopped", rs.getString("stopped"));
            m.put("erp_close_state", rs.getString("erp_close_state"));
            m.put("pending", rs.getString("pending"));
            m.put("pending_by", rs.getString("pending_by"));
            m.put("pending_at", rs.getTimestamp("pending_at"));
            m.put("archived", rs.getString("archived"));
            m.put("deleting", rs.getString("deleting"));
            m.put("modify_state", rs.getString("modify_state"));
                m.put("saved", rs.getString("saved"));
            m.put("approve_node", rs.getObject("approve_node"));
            m.put("l2_approver", rs.getString("l2_approver"));
            m.put("effective", rs.getString("effective"));
            out.put(rs.getString("doc_no"), m);
        }, args.toArray());
        // 产品变更申请单:会签中判据 = 还有 PENDING 签名(yj_form_approval,照 RD_PLAN 终止状态的补法)
        if ("RD_CHANGE".equals(panelCode)) {
            jdbc.query("SELECT DISTINCT form_no FROM yj_form_approval WHERE panel_code = 'RD_CHANGE' AND action = 'SIGNOFF'"
                    + " AND result = 'PENDING' AND form_no IN (" + in + ")", rs -> {
                Map<String, Object> m = out.get(rs.getString("form_no"));
                if (m != null) m.put("signoff_pending", "Y");
            }, docNos.toArray());
        }
        // 项目实施计划:补终止审批状态(yj_plan_term,一单一行;RTRIM 防 char(2) 尾空格)
        if ("RD_PLAN".equals(panelCode)) {
            jdbc.query("SELECT doc_no, RTRIM(state) AS term_state FROM yj_plan_term WHERE panel_code='RD_PLAN' AND doc_no IN (" + in + ")",
                    rs -> {
                        Map<String, Object> m = out.get(rs.getString("doc_no"));
                        if (m != null) m.put("term_state", rs.getString("term_state"));
                    }, docNos.toArray());
        }
        return out;
    }

    /** 状态推导:已作废 > 已中止 > 删除申请中 > 已终止/终止审批中(项目实施计划) > 修改申请中 > 待二级审批/审批中 > 修改中 > 已生效 > 已归档 > 已完成(金蝶自动关单) > 已审核 > 草稿
     *  ⚠ 与 ButtonService.docStatusOf **必须同改**(两处推导,一处管列表行、一处管按钮/保存门禁;
     *    2026-09-20 两级审批新增「待二级审批」时同改两处)。 */
    private String docStatus(Map<String, Object> st) {
        if (st != null && "Y".equals(st.get("canceled"))) return "已作废";
        if (st != null && "Y".equals(st.get("stopped"))) return "已中止";
        // 金蝶「手动关闭」(erp_close_state='H')= 人工终止,与 MES 中止同义(方案 A,2026-09-20)
        if (st != null && "H".equals(st.get("erp_close_state"))) return "已中止";
        if (st != null && "Y".equals(st.get("deleting"))) return "删除申请中";
        // 项目实施计划:终止二级审批(P1 待立项人/P2 待管理员/T 已终止)
        if (st != null && "T".equals(st.get("term_state"))) return "已终止";
        if (st != null && "P2".equals(st.get("term_state"))) return "终止审批中（管理员）";
        if (st != null && "P1".equals(st.get("term_state"))) return "终止审批中（立项人）";
        if (st != null && "R".equals(st.get("modify_state"))) return "修改申请中";
        if (st != null && "Y".equals(st.get("signoff_pending"))) return "会签中";
        if (st != null && "Y".equals(st.get("pending"))) {
            return l2Node(st) ? "待二级审批" : "审批中";
        }
        if (st != null && "Y".equals(st.get("modify_state"))) return "修改中";
        if (st != null && "Y".equals(st.get("effective"))) return "已生效";
        if (st != null && "Y".equals(st.get("archived"))) return "已归档";
        // 金蝶「已关闭」(erp_close_state='S')= 下游单据全部执行完系统自动关单,业务上是"做完了"
        if (st != null && "S".equals(st.get("erp_close_state"))) return "已完成";
        if (st != null && st.get("shr") != null) return "已审核";
        return "草稿";
    }

    /** approve_node=2 ⇒ 二级节点(空/1 都是一级) */
    private static boolean l2Node(Map<String, Object> st) {
        Object v = st.get("approve_node");
        return v != null && "2".equals(String.valueOf(v).trim().replace(".0", ""));
    }

    // ============ 公共 ============

    /** 生成 SELECT 列(col AS 中文标签);列名含特殊字符(%、.、空格等)必须方括号包裹 */
    private String selectCols(PanelRegistry.PanelDef def, List<PanelRegistry.FieldDef> fields) {
        StringBuilder sb = new StringBuilder();
        for (PanelRegistry.FieldDef f : fields) {
            if (sb.length() > 0) sb.append(", ");
            sb.append("t.[").append(f.col()).append("] AS [").append(f.label()).append("]");
        }
        return sb.length() == 0 ? "t.*" : sb.toString();
    }

    /** 行 -> 标签键映射(+id/__no) */
    private Map<String, Object> rowToLabels(PanelRegistry.PanelDef def, Map<String, Object> row, boolean withId) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (withId && row.get("__id") != null) out.put("id", row.get("__id"));
        for (PanelRegistry.FieldDef f : def.fields()) {
            Object v = row.get(f.label());
            if (v != null) out.put(f.label(), v);
        }
        return out;
    }

    /** 直接列过滤(档案模式) */
    private void appendDirectFilters(PanelRegistry.PanelDef def, String table, StringBuilder where,
                                     List<Object> args, String keyword, Map<String, Object> condition,
                                     Map<String, String> l2c, String alias) {
        if (condition != null) {
            // 仓库下拉(库存状况):按仓库编码(ckdm)精确过滤(_ckdm);绑定编码,仓库字典改名不影响
            Object ck = condition.get("_ckdm");
            if (ck != null && !String.valueOf(ck).isBlank()) {
                where.append(" AND ").append(alias).append(".[ckdm] = ?");
                args.add(String.valueOf(ck).trim());
            }
            // 报表日期段(查询弹窗):开始/结束日期 → 区间过滤。
            // 有 期次 列(收发存汇总)按月(yyyy-MM)闭区间;否则有 单据日期 列(库存台账)按全日期闭区间。
            // 这两个键不进通用 LIKE,下方的 l2c 兜底也会因无列名而跳过。
            String rangeCol = l2c.containsKey("期次") ? "期次" : (l2c.containsKey("单据日期") ? "单据日期" : null);
            boolean byMonth = "期次".equals(rangeCol);
            Object qs = condition.get("开始日期");
            if (rangeCol != null && qs != null && !String.valueOf(qs).isBlank()) {
                String v = String.valueOf(qs).trim();
                where.append(" AND ").append(alias).append(".[").append(rangeCol).append("] >= ?");
                args.add(byMonth && v.length() > 7 ? v.substring(0, 7) : v);
            }
            Object qe = condition.get("结束日期");
            if (rangeCol != null && qe != null && !String.valueOf(qe).isBlank()) {
                String v = String.valueOf(qe).trim();
                where.append(" AND ").append(alias).append(".[").append(rangeCol).append("] <= ?");
                args.add(byMonth && v.length() > 7 ? v.substring(0, 7) : v);
            }
            for (Map.Entry<String, Object> e : condition.entrySet()) {
                String col = l2c.get(e.getKey());
                Object v = e.getValue();
                if (col == null || v == null || String.valueOf(v).isBlank()) continue;
                if ("开始日期".equals(e.getKey()) || "结束日期".equals(e.getKey())) continue; // 已按期次区间处理
                where.append(" AND ").append(alias).append(".[").append(col).append("] LIKE ?");
                args.add("%" + v + "%");
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            StringBuilder or = new StringBuilder();
            List<Object> kargs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : def.fields()) {
                or.append(or.length() > 0 ? " OR " : "").append(alias).append(".[").append(f.col()).append("] LIKE ?");
                kargs.add("%" + keyword + "%");
            }
            if (or.length() > 0) {
                where.append(" AND (").append(or).append(")");
                args.addAll(kargs);
            }
        }
    }

    /**
     * 查询弹窗「高级筛选」→ WHERE。逐条 AND 组合(与前端 applyAdvFilters 的 every 语义一致),
     * 算子:contains(LIKE %v%) / eq、ne(去前后空格后按字符串比) / empty、notEmpty(空串判空)
     * / gt、lt、ge、le(两边都能当数字时按数值,否则按字符串比)。
     *
     * 与服务端 keyword、字段条件三者是 AND 关系;台账的期初/期末合成行按 仓库+存货+日期段
     * 另行聚合,不受这里影响(与 keyword 同款行为)。
     * 字段标签在本面板找不到列(改过名/来自别的面板)→ 跳过该行而非报错,避免旧查询方案打不开面板。
     */
    private void appendAdvFilters(List<Map<String, Object>> advFilters, StringBuilder where,
                                  List<Object> args, Map<String, String> l2c, String alias) {
        if (advFilters == null || advFilters.isEmpty()) return;
        StringBuilder and = new StringBuilder();
        List<Object> aargs = new ArrayList<>();
        for (Map<String, Object> f : advFilters) {
            if (f == null) continue;
            String col = l2c.get(strOf(f.get("field")));
            String op = strOf(f.get("op"));
            String val = strOf(f.get("value"));
            if (col == null || op.isEmpty()) continue;
            boolean valueless = "empty".equals(op) || "notEmpty".equals(op);
            if (!valueless && val.isEmpty()) continue; // 未填值的行不参与过滤(同前端)
            String c = alias + ".[" + col + "]";
            switch (op) {
                case "contains" -> {
                    and.append(" AND ").append(c).append(" LIKE ?");
                    aargs.add("%" + val + "%");
                }
                case "eq" -> {
                    and.append(" AND ").append(txtExpr(c)).append(" = ?");
                    aargs.add(val);
                }
                case "ne" -> {
                    and.append(" AND ").append(txtExpr(c)).append(" <> ?");
                    aargs.add(val);
                }
                case "empty" -> and.append(" AND ").append(txtExpr(c)).append(" = N''");
                case "notEmpty" -> and.append(" AND ").append(txtExpr(c)).append(" <> N''");
                case "gt", "lt", "ge", "le" -> {
                    String sym = switch (op) { case "gt" -> ">"; case "lt" -> "<"; case "ge" -> ">="; default -> "<="; };
                    String num = val.replace(",", ""); // 前端 parseFloat 前也去千分位
                    if (isNumeric(num)) {
                        and.append(" AND ").append(numExpr(c)).append(" ").append(sym).append(" ?");
                        aargs.add(Double.parseDouble(num));
                    } else {
                        and.append(" AND ").append(txtExpr(c)).append(" ").append(sym).append(" ?");
                        aargs.add(val);
                    }
                }
                default -> { /* 未知算子:不过滤(同前端兜底) */ }
            }
        }
        if (and.length() > 0) {
            where.append(and);
            args.addAll(aargs);
        }
    }

    /** 去前后空格的字符串形态:eq/ne/空判/字符串区间都比它,对齐前端 String(v).trim() */
    private String txtExpr(String col) {
        return "ISNULL(LTRIM(RTRIM(CAST(" + col + " AS nvarchar(4000)))),N'')";
    }

    /** 数值形态:比较值能当数字时用它。脏值(如 '暂无')经 TRY_CAST 变 NULL → 比较不成立、该行不命中;
     *  这种情况前端是退化成字符串比(可能命中),属已知的口径差 —— 数值列的脏值本来就不该参与数值比较。 */
    private String numExpr(String col) {
        return "TRY_CAST(REPLACE(" + txtExpr(col) + ",N',',N'') AS float)";
    }

    private boolean isNumeric(String s) {
        if (s.isEmpty()) return false;
        try {
            Double.parseDouble(s);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * 单据模式过滤:
     * - 头行式:头字段直接 t.col,行字段 EXISTS 行表
     * - 单表式:全部 EXISTS 行表(即 docTable 自身,按行匹配)
     */
    private void appendDocFilters(PanelRegistry.PanelDef def, StringBuilder where, List<Object> args,
                                  String keyword, Map<String, Object> condition, Map<String, String> l2c,
                                  boolean split, List<PanelRegistry.FieldDef> docCols, String docTable, String g) {
        List<PanelRegistry.FieldDef> lineFields = split ? def.fieldsAt("detail") : def.fields();
        boolean useExists = true; // 单表式也走 EXISTS(行级匹配语义更准)

        if (condition != null) {
            for (Map.Entry<String, Object> e : condition.entrySet()) {
                String col = l2c.get(e.getKey());
                Object v = e.getValue();
                if (col == null || v == null || String.valueOf(v).isBlank()) continue;
                boolean onDoc = split && docCols.stream().anyMatch(f -> f.col().equals(col));
                // 「审核人」是**虚拟字段**:显示值取自 yj_doc_status.shr(见 loadStatus),表内同名列对 MES 单据为空
                // (只有金蝶同步单才写列)。若只按列过滤,后端选了审核人也永远筛不出 MES 单据
                // → 过滤取两处并集(2026-09-20 配合「审核人绑职员」一起修)
                if (onDoc && "审核人".equals(e.getKey())) {
                    where.append(" AND (t.[").append(col).append("] LIKE ? OR EXISTS (SELECT 1 FROM yj_doc_status s")
                            .append(" WHERE s.panel_code = ? AND s.doc_no = CAST(t.[").append(g)
                            .append("] AS nvarchar(100)) AND s.shr LIKE ?))");
                    args.add("%" + v + "%");
                    args.add(def.code());
                    args.add("%" + v + "%");
                } else if (onDoc) {
                    where.append(" AND t.").append(col).append(" LIKE ?");
                    args.add("%" + v + "%");
                } else if (lineFields.stream().anyMatch(f -> f.col().equals(col)) || !split) {
                    where.append(" AND EXISTS (SELECT 1 FROM ").append(def.lineTable()).append(" x WHERE x.")
                            .append(g).append(" = t.").append(g)
                            .append(" AND ISNULL(x.asp_cancel,'N')<>'Y' AND x.").append(col).append(" LIKE ?)");
                    args.add("%" + v + "%");
                }
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            StringBuilder or = new StringBuilder();
            List<Object> kargs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : docCols) {
                or.append(or.length() > 0 ? " OR " : "").append("t.[").append(f.col()).append("] LIKE ?");
                kargs.add("%" + keyword + "%");
            }
            StringBuilder lineOr = new StringBuilder();
            List<Object> largs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : lineFields) {
                lineOr.append(lineOr.length() > 0 ? " OR " : "").append("x.[").append(f.col()).append("] LIKE ?");
                largs.add("%" + keyword + "%");
            }
            where.append(" AND (");
            if (or.length() > 0) {
                where.append("(").append(or).append(")");
                args.addAll(kargs);
                if (lineOr.length() > 0) where.append(" OR ");
            }
            if (lineOr.length() > 0) {
                where.append("EXISTS (SELECT 1 FROM ").append(def.lineTable()).append(" x WHERE x.").append(g)
                        .append(" = t.").append(g).append(" AND ISNULL(x.asp_cancel,'N')<>'Y' AND (")
                        .append(lineOr).append("))");
                args.addAll(largs);
            }
            where.append(")");
        }
    }
}
