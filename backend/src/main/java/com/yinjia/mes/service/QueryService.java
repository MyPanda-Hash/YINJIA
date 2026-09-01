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
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        Map<String, String> l2c = def.labelToCol();
        if ("flat".equals(def.mode())) return queryFlat(def, keyword, condition, l2c, pageNo, pageSize);
        return def.isDoc() ? queryDocs(def, keyword, condition, l2c, pageNo, pageSize)
                : queryArchive(def, keyword, condition, l2c, pageNo, pageSize);
    }

    // ============ 平表模式(报表/库存状况,一行一记录直接返回) ============

    private Map<String, Object> queryFlat(PanelRegistry.PanelDef def, String keyword,
                                          Map<String, Object> condition, Map<String, String> l2c,
                                          int pageNo, int pageSize) {
        String cols = selectCols(def, def.fields());
        StringBuilder where = new StringBuilder("WHERE ISNULL(t.asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        appendDirectFilters(def, def.lineTable(), where, args, keyword, condition, l2c, "t");

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.lineTable() + " t " + where, Integer.class, args.toArray());

        String sql = "SELECT t.id AS __id, " + cols + " FROM " + def.lineTable() + " t " + where
                + " ORDER BY t.id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        args.add((pageNo - 1) * pageSize);
        args.add(pageSize);
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : rows) list.add(rowToLabels(def, r, false));

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", total == null ? 0 : total);
        out.put("list", list);
        return out;
    }

    // ============ 档案模式(单单据) ============
    // 档案保存语义 = 全量明细 upsert(缺席行=已删除),因此查询必须返回全量行(上限 2000),
    // 否则分页截断会造成"未加载的行被误删"。

    private Map<String, Object> queryArchive(PanelRegistry.PanelDef def, String keyword,
                                             Map<String, Object> condition, Map<String, String> l2c,
                                             int pageNo, int pageSize) {
        String cols = selectCols(def, def.fields());
        StringBuilder where = new StringBuilder("WHERE ISNULL(t.asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        appendDirectFilters(def, def.lineTable(), where, args, keyword, condition, l2c, "t");

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.lineTable() + " t " + where, Integer.class, args.toArray());

        // 全量返回(上限 2000):保存语义为"缺席行=已删除",必须保证明细完整
        String sql = "SELECT t.id AS __id, " + cols + " FROM " + def.lineTable() + " t " + where
                + " ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 2000 ROWS ONLY";
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
        appendDocFilters(def, where, args, keyword, condition, l2c, split, docCols, docTable, g);

        where.append(" AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = t.[")
                .append(g).append("] AND s.canceled = 'Y')");
        args.add(def.code());

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT t.[" + g + "]) FROM " + docTable + " t " + where,
                Integer.class, args.toArray());

        String pageSql = "SELECT DISTINCT t.[" + g + "] AS __no FROM " + docTable + " t " + where
                + " ORDER BY t.[" + g + "] DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
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
        jdbc.query("SELECT doc_no, shr, shsj, canceled, stopped, pending, pending_by, pending_at FROM yj_doc_status"
                + " WHERE panel_code = ? AND doc_no IN (" + in + ")", rs -> {
            Map<String, Object> m = new HashMap<>();
            m.put("shr", rs.getString("shr"));
            m.put("shsj", rs.getTimestamp("shsj"));
            m.put("canceled", rs.getString("canceled"));
            m.put("stopped", rs.getString("stopped"));
            m.put("pending", rs.getString("pending"));
            m.put("pending_by", rs.getString("pending_by"));
            m.put("pending_at", rs.getTimestamp("pending_at"));
            out.put(rs.getString("doc_no"), m);
        }, args.toArray());
        return out;
    }

    /** 状态推导(照搬 light-mes 审批流 + 中止档):已作废 > 已中止 > 已审核 > 审批中 > 草稿 */
    private String docStatus(Map<String, Object> st) {
        if (st != null && "Y".equals(st.get("canceled"))) return "已作废";
        if (st != null && "Y".equals(st.get("stopped"))) return "已中止";
        if (st != null && st.get("shr") != null) return "已审核";
        if (st != null && "Y".equals(st.get("pending"))) return "审批中";
        return "草稿";
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
            for (Map.Entry<String, Object> e : condition.entrySet()) {
                String col = l2c.get(e.getKey());
                Object v = e.getValue();
                if (col == null || v == null || String.valueOf(v).isBlank()) continue;
                where.append(" AND ").append(alias).append(".").append(col).append(" LIKE ?");
                args.add("%" + v + "%");
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            StringBuilder or = new StringBuilder();
            List<Object> kargs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : def.fields()) {
                or.append(or.length() > 0 ? " OR " : "").append(alias).append(".").append(f.col()).append(" LIKE ?");
                kargs.add("%" + keyword + "%");
            }
            if (or.length() > 0) {
                where.append(" AND (").append(or).append(")");
                args.addAll(kargs);
            }
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
                if (onDoc) {
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
                lineOr.append(lineOr.length() > 0 ? " OR " : "").append("x.").append(f.col()).append(" LIKE ?");
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
