package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 测试申请汇总表(2026-11-19)。
 *
 * <p><b>用户口径(原话)</b>:「做一个类似于样品检验汇总单一样的按照人员进行一个汇总分类的有关测试申请单的
 * 测试申请汇总面板,还可以点击跳转到对应的测试申请单」;补充确认:「内部和销售端放在同一张表里查询,
 * 按申请人分组,列按你拟的」。
 *
 * <p><b>数据源(2026-11-19 实测)</b>:「内部委托-测试申请单」「销售端-测试/检测申请表」<b>不是两张面板</b>,
 * 而是同一张 {@code RD_DOM_TEST}(测试申请单)的三个页签中的前两个 —— 两张申请表共用行表
 * {@code rd_dom_test_detail},靠物理列 {@code [表区]} 分块({@code 内部申请} / {@code 外部申请},
 * 见 {@code tools/migrate-rd-test-apply.sql})。所以「合并查询」= 一张头表 + 一张行表,不需要 UNION。
 * <ul>
 *   <li>头 {@code rd_dom_test_head}:单据编号 / 单据日期(文本 YYYY-MM-DD)/ 申请单类型 / 文件管理人 / 测试负责人;</li>
 *   <li>行 {@code rd_dom_test_detail}:申请人(内部申请)/ 发起人(销售端)/ 尺寸·配方·密度 /
 *       方法·标准·目标(内部)/ 测试（检测）内容(销售端)/ 是否要求送样/支数 / 备注;</li>
 *   <li>状态真源 {@code yj_doc_status}(panel_code + doc_no),与列表页/审批同一口径
 *       (已作废 &gt; 已中止 &gt; 审批中 &gt; 已审核 &gt; 草稿);头表本身没有「单据状态/审核时间」列。</li>
 * </ul>
 *
 * <p><b>申请人兜底</b>(用户提示两张表写法可能不同):按字段存在性先取候选,再在候选里取第一个非空 ——
 * {@code 申请人} → {@code 发起人} → {@code 委托人} → {@code 业务员};全空归入「未填申请人」。
 * 存在性用 {@code sys.columns} 实测,不存在的列不进 SQL(缺列/改列的库不会因此 500)。
 *
 * <p><b>为什么列这样拟</b>:测试申请单纸面没有「样品名称/型号/数量/收费」这几列 —— 那是样品检验汇总表的列。
 * 为保持「两个汇总表同款」的阅读习惯,这里保留同名列名,取值按**字段存在性 + 第一个非空**从本面板真实字段里取:
 * {@code 样品名称}←产品名称,{@code 样品型号/规格}←尺寸,{@code 样品数量}←是否要求送样/支数,
 * {@code 检测项目}←测试（检测）内容/目标/方法/背景·目的。本面板**没有任何金额列** ⇒ {@code 收费合计} 恒 0.00
 * (将来加了金额列会自动带出来,见 {@link #HEAD_FEE_CANDIDATES}/{@link #DETAIL_FEE_CANDIDATES})。
 *
 * <p><b>只读</b>:本服务不改任何业务数据;权限闸门在 Controller
 * ({@code PxController.testApplySummary} → {@code requirePanelView(RD_DOM_TEST)}),
 * 不给这个只读页新造页面级虚拟面板码 —— 能看到测试申请单的人才看得到它的汇总。
 */
@Service
public class TestApplySummaryService {

    /** 面板码:两张申请表同属的面板(也是本次汇总页的权限码与跳转目标) */
    static final String PANEL_CODE = "RD_DOM_TEST";

    /**
     * 单据行输出列(<b>顺序即契约</b>:前端 {@code TestApplySummary.vue} 的 {@code SUMMARY_COLUMNS}
     * 与导出 Excel 表头必须逐字同序,由 {@code testApplySummary.test.js} 守住)。
     */
    static final String[] SUMMARY_COLUMNS = {
            "单据日期", "单据编号", "申请人", "申请类型", "样品名称", "样品型号/规格",
            "样品数量", "检测项目", "检测项目数", "收费合计", "单据状态", "面板码",
    };

    /** 申请人兜底候选:内部申请写「申请人」,销售端写「发起人」;后两个是给将来换名/同类面板留的口子 */
    static final String[] APPLICANT_CANDIDATES = {"申请人", "发起人", "委托人", "业务员"};

    /** 检测项目兜底候选:销售端写「测试（检测）内容」;内部申请用「目标/方法/背景·目的/标准」 */
    static final String[] ITEM_CANDIDATES = {"测试（检测）内容", "目标", "方法", "背景/目的", "标准"};

    /** 样品名称兜底候选:本面板实体列是「产品名称」(历史列,仍在 yj_field 登记) */
    static final String[] SAMPLE_CANDIDATES = {"样品名称", "产品名称", "送样名称"};

    /** 样品型号/规格兜底候选:内部申请表用「尺寸」描述样品(配方/密度体积太大,只在明细里看) */
    static final String[] SPEC_CANDIDATES = {"样品型号/规格", "样品型号规格", "规格型号", "型号规格", "规格", "型号", "尺寸"};

    /** 样品数量兜底候选:销售端申请表用「是否要求送样/支数」 */
    static final String[] QTY_CANDIDATES = {"样品数量", "数量", "送样支数", "是否要求送样/支数"};

    /** 金额兜底候选(当前本面板一个都没有 ⇒ 收费合计恒 0.00;将来补列自动生效) */
    static final String[] HEAD_FEE_CANDIDATES = {"合计收费", "收费合计", "检测费合计", "费用合计", "金额"};
    static final String[] DETAIL_FEE_CANDIDATES = {"收费", "金额", "单价", "费用"};

    /** 单次最多取回的行(按天/周汇总远达不到;防"查全库"把内存和界面拖死) */
    private static final int MAX_ROWS = 20000;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String HEAD = "dbo.rd_dom_test_head";
    private static final String DETAIL = "dbo.rd_dom_test_detail";
    /** 取不到申请人时的归集名(与样品检验汇总表的「未填送样人」同款口径) */
    private static final String NO_APPLICANT = "未填申请人";

    private final JdbcTemplate jdbc;

    public TestApplySummaryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 汇总取数(只读)。
     *
     * @param from      日期起(YYYY-MM-DD;缺省 = 今天)
     * @param to        日期止(缺省 = 日期起;传反了按同一区间查,不报错)
     * @param applicant 申请人(模糊)
     * @param status    单据状态(草稿/审批中/已审核/已作废/已中止;空或「全部」= 全部且排除已作废/已中止)
     * @param keyword   单据编号 / 申请人 / 样品 / 检测项目 / 备注 任一段
     * @return {@code {数据时间, 查询条件, 汇总, 按申请人:[{…, 单据明细:[…]}], 按单据:[{…, 明细:[…]}]}}
     */
    public Map<String, Object> summary(String from, String to, String applicant, String status, String keyword) {
        String f = nz(from).trim();
        String t = nz(to).trim();
        if (f.isEmpty()) f = LocalDate.now().toString();
        if (t.isEmpty()) t = f;
        if (f.compareTo(t) > 0) {                     // 传反了不报错:按同一区间查(与汇总表同族口径一致)
            String x = f;
            f = t;
            t = x;
        }
        String ap = str(applicant);
        String st = nz(status).trim();
        String kw = str(keyword);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("数据时间", LocalDateTime.now().format(TS));
        Map<String, Object> cond = new LinkedHashMap<>();
        cond.put("日期起", f);
        cond.put("日期止", t);
        cond.put("申请人", nz(ap));
        cond.put("单据状态", st.isEmpty() ? "全部" : st);
        cond.put("keyword", nz(kw));
        out.put("查询条件", cond);

        List<Map<String, Object>> rows = new ArrayList<>();
        Set<String> detailCols = columnsOf(DETAIL);
        if (tableExists(HEAD) && !detailCols.isEmpty()) {
            rows = query(f, t, ap, st, kw, detailCols);
        }

        List<Map<String, Object>> docs = foldDocs(rows);
        List<Map<String, Object>> groups = foldGroups(docs);
        out.put("按申请人", groups);
        out.put("按单据", docs);
        out.put("汇总", summarize(docs));
        return out;
    }

    // ───────────────────────────── 取数 ─────────────────────────────

    /** 一条 SQL 取回「单据 × 行」(没有行的单据也保留:LEFT JOIN),折叠交给 {@link #foldDocs} */
    private List<Map<String, Object>> query(String from, String to, String applicant, String status,
                                            String keyword, Set<String> detailCols) {
        Set<String> headCols = columnsOf(HEAD);
        // ⚠ 兜底值必须是空串(不是「未填申请人」):一行申请人全空 ⇒ 返回 '',由 Java 侧 foldDocs
        //   按「第一个非空」取,最后整张单都没填才归入「未填申请人」。
        //   写死「未填申请人」会让**空壳行**先占位,把同一张单后面真正填了申请人的行挡住
        //   (2026-11-19 实测 DT-2026-10-0001 就因此掉进未填申请人分组)。
        String applicantExpr = pick(detailCols, APPLICANT_CANDIDATES, "");
        String itemExpr = pick(detailCols, ITEM_CANDIDATES, "");
        String sampleExpr = pick(detailCols, SAMPLE_CANDIDATES, "");
        String specExpr = pick(detailCols, SPEC_CANDIDATES, "");
        String qtyExpr = pick(detailCols, QTY_CANDIDATES, "");
        String remarkExpr = detailCols.contains("备注") ? "ISNULL(d.[备注], N'')" : "N''";
        String lineNoExpr = detailCols.contains("序号") ? "ISNULL(d.[序号], N'')" : "N''";
        // 申请类型:头表「申请单类型」是内部委托/销售端;空时按行表 [表区] 反推(内部申请→内部委托、外部申请→销售端)
        String typeExpr = headCols.contains("申请单类型")
                ? "COALESCE(NULLIF(LTRIM(RTRIM(h.[申请单类型])), N''), "
                  + (detailCols.contains("表区")
                        ? "CASE d.[表区] WHEN N'内部申请' THEN N'内部委托' WHEN N'外部申请' THEN N'销售端' ELSE N'' END)"
                        : "N'')")
                : "N''";
        String statusExpr = statusExpr();
        String dateExpr = "LEFT(ISNULL(CONVERT(nvarchar(20), h.[单据日期]), N''), 10)";
        String feeExpr = feeExpr(headCols, detailCols);

        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT TOP ").append(MAX_ROWS)
                .append(" h.[单据编号] AS [单据编号], ").append(dateExpr).append(" AS [单据日期],")
                .append(" ").append(typeExpr).append(" AS [申请类型],")
                .append(" ").append(applicantExpr).append(" AS [申请人],")
                .append(" ").append(sampleExpr).append(" AS [样品名称],")
                .append(" ").append(specExpr).append(" AS [样品规格],")
                .append(" ").append(qtyExpr).append(" AS [样品数量],")
                .append(" ").append(itemExpr).append(" AS [检测项目],")
                .append(" ").append(lineNoExpr).append(" AS [行号],")
                .append(" ").append(remarkExpr).append(" AS [行备注],")
                .append(" ").append(feeExpr).append(" AS [项目收费],")
                .append(" ").append(statusExpr).append(" AS [单据状态]")
                .append(" FROM ").append(HEAD).append(" h")
                .append(" LEFT JOIN ").append(DETAIL).append(" d ON d.[单据编号] = h.[单据编号]")
                .append(" OUTER APPLY (SELECT TOP 1 s.[id], s.[shr], s.[canceled], s.[stopped], s.[pending]")
                .append("   FROM dbo.[yj_doc_status] s")
                .append("  WHERE s.[panel_code] = N'").append(PANEL_CODE).append("' AND s.[doc_no] = h.[单据编号]")
                .append("  ORDER BY s.[id] DESC) ds")
                .append(" WHERE ISNULL(h.[asp_cancel], N'N') <> N'Y'")
                .append("   AND ").append(dateExpr).append(" >= ? AND ").append(dateExpr).append(" <= ?");
        args.add(from);
        args.add(to);

        String st = nz(status).trim();
        if (!st.isEmpty() && !"全部".equals(st)) {
            sql.append(" AND (").append(statusExpr).append(") = ?");
            args.add(st);
        } else {
            // 废单不算"检测工作量"(与样品检验汇总表同一口径);显式按状态筛选时照给定值查
            sql.append(" AND ISNULL(ds.[canceled], N'N') <> N'Y' AND ISNULL(ds.[stopped], N'N') <> N'Y'");
        }
        String ap = str(applicant);
        if (ap != null) {
            sql.append(" AND (").append(applicantExpr).append(") LIKE ?");
            args.add("%" + ap + "%");
        }
        String kw = str(keyword);
        if (kw != null) {
            String like = "%" + kw + "%";
            sql.append(" AND (h.[单据编号] LIKE ? OR (").append(applicantExpr).append(") LIKE ?")
                    .append(" OR (").append(sampleExpr).append(") LIKE ? OR (").append(itemExpr).append(") LIKE ?")
                    .append(" OR (").append(remarkExpr).append(") LIKE ?)");
            for (int i = 0; i < 5; i++) args.add(like);
        }
        sql.append(" ORDER BY ").append(dateExpr).append(" DESC, h.[单据编号] DESC");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    // ───────────────────────────── 折叠 ─────────────────────────────

    /** 行 → 单据:标题列按序回退取第一个非空,检测项目/样品/规格/数量去重汇总,收费求和 */
    private List<Map<String, Object>> foldDocs(List<Map<String, Object>> rows) {
        Map<String, Map<String, Object>> docs = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("单据编号"));
            if (no == null) continue;
            Map<String, Object> doc = docs.get(no);
            if (doc == null) {
                doc = new LinkedHashMap<>();
                doc.put("_日期", nz(str(r.get("单据日期"))));
                doc.put("_类型", nz(str(r.get("申请类型"))));
                doc.put("_申请人", "");
                doc.put("_样品", new LinkedHashSet<String>());
                doc.put("_规格", new LinkedHashSet<String>());
                doc.put("_数量", new LinkedHashSet<String>());
                doc.put("_项目", new LinkedHashSet<String>());
                doc.put("_项次", 0);
                doc.put("_收费", BigDecimal.ZERO);
                doc.put("_状态", nz(str(r.get("单据状态"))));
                doc.put("_明细", new ArrayList<Map<String, Object>>());
                docs.put(no, doc);
            }
            if (nz((String) doc.get("_申请人")).isEmpty()) {
                String a = str(r.get("申请人"));
                if (a != null) doc.put("_申请人", a);
            }
            String item = str(r.get("检测项目"));
            String sample = str(r.get("样品名称"));
            String spec = str(r.get("样品规格"));
            String qty = str(r.get("样品数量"));
            String remark = str(r.get("行备注"));
            // 空行不算"一项":两张申请表里都有只带 [表区] 的空壳行(实测 DT-2026-10-0001 的 2 行全空)
            if (item == null && sample == null && spec == null && qty == null && remark == null) continue;
            if (item != null) {
                setOf(doc, "_项目").add(item);
                doc.put("_项次", (Integer) doc.get("_项次") + 1);
            }
            if (sample != null) setOf(doc, "_样品").add(sample);
            if (spec != null) setOf(doc, "_规格").add(spec);
            if (qty != null) setOf(doc, "_数量").add(qty);
            doc.put("_收费", ((BigDecimal) doc.get("_收费")).add(decimalOf(r.get("项目收费"))));

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("序号", nz(str(r.get("行号"))));
            line.put("检测项目", nz(item));
            line.put("样品名称", nz(sample));
            line.put("样品型号/规格", nz(spec));
            line.put("样品数量", nz(qty));
            line.put("备注", nz(remark));
            listOf(doc, "_明细").add(line);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> e : docs.entrySet()) {
            Map<String, Object> raw = e.getValue();
            Set<String> items = setOf(raw, "_项目");
            Map<String, Object> d = new LinkedHashMap<>();
            // 按 SUMMARY_COLUMNS 顺序装配(顺序即契约,前端/导出/测试三方同源)
            d.put("单据日期", raw.get("_日期"));
            d.put("单据编号", e.getKey());
            d.put("申请人", nz((String) raw.get("_申请人")).isEmpty() ? NO_APPLICANT : raw.get("_申请人"));
            d.put("申请类型", raw.get("_类型"));
            d.put("样品名称", join(setOf(raw, "_样品")));
            d.put("样品型号/规格", join(setOf(raw, "_规格")));
            d.put("样品数量", join(setOf(raw, "_数量")));
            d.put("检测项目", join(items));
            d.put("检测项目数", items.size());
            d.put("收费合计", raw.get("_收费"));
            d.put("单据状态", raw.get("_状态"));
            d.put("面板码", PANEL_CODE);
            d.put("明细", listOf(raw, "_明细"));
            out.add(d);
        }
        return out;
    }

    /** 单据 → 申请人分组(用户口径「按申请人分组」;组内自带该人的单据明细,前端展开直接用)*/
    private List<Map<String, Object>> foldGroups(List<Map<String, Object>> docs) {
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        for (Map<String, Object> d : docs) {
            String name = nz((String) d.get("申请人")).isEmpty() ? NO_APPLICANT : (String) d.get("申请人");
            Map<String, Object> g = groups.get(name);
            if (g == null) {
                g = new LinkedHashMap<>();
                g.put("_申请人", name);
                g.put("_单据数", 0);
                g.put("_项次", 0);
                g.put("_样品", new LinkedHashSet<String>());
                g.put("_项目", new LinkedHashSet<String>());
                g.put("_已审核", 0);
                g.put("_待处理", 0);
                g.put("_收费", BigDecimal.ZERO);
                g.put("_最近", "");
                g.put("_明细", new ArrayList<Map<String, Object>>());
                groups.put(name, g);
            }
            g.put("_单据数", (Integer) g.get("_单据数") + 1);
            g.put("_项次", (Integer) g.get("_项次") + intOf(d.get("检测项目数")));
            String sample = nz((String) d.get("样品名称"));
            if (sample.isEmpty()) sample = nz((String) d.get("样品型号/规格"));
            if (!sample.isEmpty()) setOf(g, "_样品").add(sample);
            for (String it : split(nz((String) d.get("检测项目")))) setOf(g, "_项目").add(it);
            String status = nz((String) d.get("单据状态"));
            if ("已审核".equals(status)) g.put("_已审核", (Integer) g.get("_已审核") + 1);
            if ("草稿".equals(status) || "审批中".equals(status)) g.put("_待处理", (Integer) g.get("_待处理") + 1);
            g.put("_收费", ((BigDecimal) g.get("_收费")).add(decimalOf(d.get("收费合计"))));
            String date = nz((String) d.get("单据日期"));
            if (date.compareTo((String) g.get("_最近")) > 0) g.put("_最近", date);
            listOf(g, "_明细").add(d);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> raw : groups.values()) {
            Map<String, Object> g = new LinkedHashMap<>();
            g.put("申请人", raw.get("_申请人"));
            g.put("申请单据数", raw.get("_单据数"));
            g.put("检测项目项次", raw.get("_项次"));
            g.put("涉及样品", join(setOf(raw, "_样品")));
            g.put("检测项目", join(setOf(raw, "_项目")));
            g.put("已审核单数", raw.get("_已审核"));
            g.put("待处理单数", raw.get("_待处理"));
            g.put("收费合计", raw.get("_收费"));
            g.put("最近申请日期", raw.get("_最近"));
            g.put("单据明细", listOf(raw, "_明细"));
            out.add(g);
        }
        // 单多的排前面;同单数按最近日期倒序,再按姓名(顺序稳定,便于对照)
        out.sort((a, b) -> {
            int c = Integer.compare(intOf(b.get("申请单据数")), intOf(a.get("申请单据数")));
            if (c != 0) return c;
            c = String.valueOf(b.get("最近申请日期")).compareTo(String.valueOf(a.get("最近申请日期")));
            if (c != 0) return c;
            return String.valueOf(a.get("申请人")).compareTo(String.valueOf(b.get("申请人")));
        });
        return out;
    }

    /** 汇总条(6 项 KPI:人数 / 单据数 / 检测项目项次 / 收费合计 / 已审核单数 / 待处理单数) */
    private Map<String, Object> summarize(List<Map<String, Object>> docs) {
        Set<String> people = new LinkedHashSet<>();
        int items = 0;
        int approved = 0;
        int pending = 0;
        BigDecimal fee = BigDecimal.ZERO;
        for (Map<String, Object> d : docs) {
            people.add(nz((String) d.get("申请人")));
            items += intOf(d.get("检测项目数"));
            String status = nz((String) d.get("单据状态"));
            if ("已审核".equals(status)) approved++;
            if ("草稿".equals(status) || "审批中".equals(status)) pending++;
            fee = fee.add(decimalOf(d.get("收费合计")));
        }
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("申请人数", people.size());
        s.put("申请单据数", docs.size());
        s.put("检测项目项次", items);
        s.put("收费合计", fee);
        s.put("已审核单数", approved);
        s.put("待处理单数", pending);
        return s;
    }

    // ───────────────────────────── SQL 片段 ─────────────────────────────

    /**
     * 申请人表达式:按字段存在性挑候选列,再 COALESCE 第一个非空。
     * 两张申请表字段不同(内部「申请人」/ 销售端「发起人」),照用户口径「按字段存在性兜底取第一个非空」。
     */
    private static String pick(Set<String> detailCols, String[] candidates, String fallback) {
        return pickCol("d", detailCols, candidates, fallback);
    }

    private static String pickCol(String alias, Set<String> cols, String[] candidates, String fallback) {
        List<String> parts = new ArrayList<>();
        for (String c : candidates) {
            if (!cols.contains(c)) continue;
            parts.add("NULLIF(LTRIM(RTRIM(" + alias + ".[" + c + "])), N'')");
        }
        if (parts.isEmpty()) return "N'" + fallback + "'";
        return "COALESCE(" + String.join(", ", parts) + ", N'" + fallback + "')";
    }

    /** 金额表达式:头/行候选列(存在才拼)求和;一个都没有 ⇒ 0.00(本面板现状) */
    private static String feeExpr(Set<String> headCols, Set<String> detailCols) {
        String h = firstExisting(headCols, HEAD_FEE_CANDIDATES);
        String d = firstExisting(detailCols, DETAIL_FEE_CANDIDATES);
        if (h == null && d == null) return "CAST(0 AS decimal(18,2))";
        StringBuilder e = new StringBuilder("CAST(");
        if (h != null) e.append("ISNULL(TRY_CONVERT(decimal(18,2), h.[").append(h).append("]), 0)");
        if (h != null && d != null) e.append(" + ");
        if (d != null) e.append("ISNULL(TRY_CONVERT(decimal(18,2), d.[").append(d).append("]), 0)");
        return e.append(" AS decimal(18,2))").toString();
    }

    private static String firstExisting(Set<String> cols, String[] candidates) {
        for (String c : candidates) if (cols.contains(c)) return c;
        return null;
    }

    /**
     * 单据状态表达式(别名 ds 固定)。
     *
     * <p>本面板头表**没有**「单据状态 / 审核时间」列(实测),所以只认 {@code yj_doc_status};
     * 没有状态行 = 草稿。优先级与 {@link ButtonService#docStatusOf} 一致:
     * 已作废 &gt; 已中止 &gt; 审批中 &gt; 已审核 &gt; 草稿。
     */
    private static String statusExpr() {
        return "CASE WHEN ds.[id] IS NULL THEN N'草稿'"
                + " WHEN ISNULL(ds.[canceled], N'N') = N'Y' THEN N'已作废'"
                + " WHEN ISNULL(ds.[stopped], N'N') = N'Y' THEN N'已中止'"
                + " WHEN ISNULL(ds.[pending], N'N') = N'Y' THEN N'审批中'"
                + " WHEN ISNULL(ds.[shr], N'') <> N'' THEN N'已审核'"
                + " ELSE N'草稿' END";
    }

    // ───────────────────────────── 元数据与工具 ─────────────────────────────

    /** 表/列存在性(只读元数据):缺列/缺表时不拼 SQL,避免「列名无效」把整个接口打死 */
    private Set<String> columnsOf(String table) {
        try {
            List<String> names = jdbc.queryForList(
                    "SELECT [name] FROM sys.[columns] WHERE [object_id] = OBJECT_ID(?)", String.class, table);
            return new LinkedHashSet<>(names);
        } catch (RuntimeException e) {
            return new LinkedHashSet<>();
        }
    }

    private boolean tableExists(String table) {
        try {
            List<Integer> hit = jdbc.queryForList(
                    "SELECT CASE WHEN OBJECT_ID(?) IS NULL THEN 0 ELSE 1 END", Integer.class, table);
            return !hit.isEmpty() && intOf(hit.get(0)) == 1;
        } catch (RuntimeException e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private static Set<String> setOf(Map<String, Object> m, String key) {
        return (Set<String>) m.get(key);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOf(Map<String, Object> m, String key) {
        return (List<Map<String, Object>>) m.get(key);
    }

    /** 去重并集按「；」拼接(空集合 → 空串) */
    private static String join(Set<String> set) {
        return String.join("；", set);
    }

    /** 组行里的「检测项目」是拼好的串,拆回集合(分组去重时用) */
    private static List<String> split(String s) {
        List<String> out = new ArrayList<>();
        if (s == null || s.isBlank()) return out;
        for (String part : s.split("；")) {
            String p = part.trim();
            if (!p.isEmpty()) out.add(p);
        }
        return out;
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v);
        return s.isBlank() ? null : s.trim();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static BigDecimal decimalOf(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal d) return d;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static int intOf(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
