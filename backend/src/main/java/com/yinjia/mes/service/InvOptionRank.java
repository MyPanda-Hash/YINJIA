package com.yinjia.mes.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 物料候选({@code /px/invOptions})的**范围筛选 + 命中优先级排序**纯函数(2026-11-13 用户口径)。
 *
 * <p><b>为什么需要它</b>:用户报障「新增生产工单页『产品编码』输入 {@code 123},下候选顺序乱,
 * 规格型号含 123 的 Y-S-T(硫酸氧钛,规格 123334-00-9)排最前,真正编码/名称含 123 的
 * SP00013(测试123)反而靠后」。根因不在前端:候选来自
 * {@code /px/invOptions → QueryService.queryFormDataList("INV", keyword, …)},而 INV 是**档案面板**,
 * keyword 走「本面板**全部 75 列** LIKE %kw%」的 OR,排序只有 {@code ORDER BY t.id DESC}
 * ⇒ 只要备注/规格型号/图片链接等任意一列含 123 就算命中,顺序与"编码/名称命中"毫无关系。
 *
 * <p><b>口径</b>(用户:「模糊搜索要做一个范围筛选,符合输入的数字的在前面」):
 * <ol>
 *   <li><b>范围筛选</b>:只保留「存货编码 / 存货名称 / 规格型号 / 助记码 / 条形码」任一列**包含** keyword
 *       的行(忽略大小写、两侧空白);原来只靠其它列(备注 / 品牌 / 图片链接…)命中的行**丢弃**。</li>
 *   <li><b>命中优先级</b>(小分在前,见 {@link #score}):
 *       编码== → 编码前缀 → 编码包含 → 名称前缀 → 名称包含 → 规格型号包含
 *       → 助记码前缀 → 助记码包含 → 条形码包含 → 其它兜底。</li>
 *   <li><b>同分</b>:存货编码**长度升序** → 存货编码**字典序**;仍相同则保持原顺序
 *       (Java {@link List#sort} 是稳定排序,原顺序即 SQL 的 {@code t.id DESC},所以结果可复跑)。</li>
 *   <li><b>截断</b>:最多 {@link #MAX_OPTIONS} 行(下拉防过大);{@code totalSize} 同步改成截断后的行数。</li>
 * </ol>
 *
 * <p><b>纯数字关键字天然适用</b>:同一个 keyword 丢进来,编码/名称含 123 的排最前,
 * 只在规格型号里含 123 的排后面 —— 不需要为"数字"单开一套规则。
 *
 * <p><b>为什么是纯函数</b>:规则要能被 {@code tools/verify/InvOptionRankTest.java} 直接验算(不碰库),
 * 也满足《代码规范与防臃肿》A2 —— Controller 只做参数校验与转发,规则落在 service。
 *
 * <p><b>空 keyword 一律不筛不排不截断</b>(见 {@link #rankResult}):配方计算器用 {@code kind} 收窄、
 * keyword 留空取「该类别全部物料」是既有行为,不能被这次排序顺手改掉。
 */
public final class InvOptionRank {

    /** 行字段(label —— 与 {@code yj_field.label} 一致,**不是**物理列名) */
    public static final String CODE = "存货编码";
    public static final String NAME = "存货名称";
    public static final String SPEC = "规格型号";
    public static final String MNEMONIC = "助记码";
    public static final String BARCODE = "条形码";

    /** 下拉候选上限(行):排序后截断,防一次下发几千行把下拉撑爆 */
    public static final int MAX_OPTIONS = 200;

    /** 五列都不含 keyword 的兜底档位(会被范围筛选丢弃) */
    private static final int OTHER = 9;

    private InvOptionRank() {
    }

    /**
     * 命中分(**越小越靠前**),只看 5 个行字段;五列都不含 keyword 时返回 {@code 9}(其它兜底)。
     *
     * <p>分档(严格按 2026-11-13 口径):
     * <pre>
     *   0 存货编码 == kw          1 存货编码 前缀        2 存货编码 包含
     *   3 存货名称 前缀            4 存货名称 包含
     *   5 规格型号 包含
     *   6 助记码 前缀              7 助记码 包含
     *   8 条形码 包含              9 其它(五列都不命中)
     * </pre>
     *
     * <p>为什么"编码包含"排在"名称前缀"前面:用户输入的是**产品编码**框,编码命中一定更贴近意图;
     * 而规格型号(如 123334-00-9)只是"数字碰巧一样",必须排到最后,别把下拉第一屏占满。
     *
     * @param row     档案行(键 = 中文 label;值可能是 String / Number 等)
     * @param keyword 用户输入(可为 null / 空白 ⇒ 返回 9,即"不排")
     */
    public static int score(Map<String, Object> row, String keyword) {
        String kw = normalize(keyword);
        if (kw.isEmpty()) return OTHER;
        String code = lower(text(row, CODE));
        if (code.equals(kw)) return 0;          // 输入的就是编码
        if (code.startsWith(kw)) return 1;      // 边输边收窄,编码前缀
        if (code.contains(kw)) return 2;
        String name = lower(text(row, NAME));
        if (name.startsWith(kw)) return 3;
        if (name.contains(kw)) return 4;        // 例:SP00013「测试123」—— 用户截图里被压到后面的那行
        String spec = lower(text(row, SPEC));
        if (spec.contains(kw)) return 5;        // 例:硫酸氧钛 规格 123334-00-9 —— 原来霸占第一屏的那些
        String mnemonic = lower(text(row, MNEMONIC));
        if (mnemonic.startsWith(kw)) return 6;
        if (mnemonic.contains(kw)) return 7;
        String barcode = lower(text(row, BARCODE));
        if (barcode.contains(kw)) return 8;
        return OTHER;
    }

    /**
     * 范围筛选 + 命中排序 + 截断({@link #MAX_OPTIONS} 行)。
     *
     * <p>排序键:命中分 → 存货编码长度 → 存货编码字典序;完全相同则**保持入参顺序**
     * ({@link List#sort} 稳定)。不修改入参行,返回新列表。
     *
     * @param rows    原始行(键 = 中文 label);null 视为空列表
     * @param keyword 用户输入;**空 / null ⇒ 原样返回**(浅拷贝,不筛、不排、不截断)
     * @return 重排后的行(最多 {@link #MAX_OPTIONS} 行)
     */
    public static List<Map<String, Object>> rank(List<Map<String, Object>> rows, String keyword) {
        List<Map<String, Object>> src = rows == null ? List.of() : rows;
        if (normalize(keyword).isEmpty()) return new ArrayList<>(src);
        List<Scored> scored = new ArrayList<>(src.size());
        for (Map<String, Object> row : src) {
            if (row == null) continue;              // 防御:脏数据不参与
            int s = score(row, keyword);
            if (s >= OTHER) continue;               // 范围筛选:五列都不命中 ⇒ 丢弃(不再靠备注/图片链接命中)
            scored.add(new Scored(row, s, text(row, CODE)));
        }
        scored.sort(Comparator.comparingInt(Scored::score)
                .thenComparingInt(o -> o.code().length())
                .thenComparing(Scored::code));
        int size = Math.min(scored.size(), MAX_OPTIONS);
        List<Map<String, Object>> out = new ArrayList<>(size);
        for (int i = 0; i < size; i++) out.add(scored.get(i).row());
        return out;
    }

    /**
     * 把 {@code QueryService.queryFormDataList} 的结果按 {@link #rank} 重排后**原样返回同形状**。
     *
     * <p>响应形状(档案契约,保持不变):
     * <pre>
     *   { totalSize: 行数, list: [ { 编号, 状态, 单据状态, detail: {&lt;detailKey&gt;: [rows]} } ] }
     * </pre>
     * {@code detail} 的 key **一律照抄**(不写死 {@code items}/{@code inv},由面板的
     * {@code yj_panel.detail_key} 决定),单头上其它键(编号/状态/单据状态…)逐个保留;
     * {@code totalSize} 改成重排后的实际行数(截断后),前端只拿 list,无副作用。
     *
     * <p>空 keyword **原样返回同一个对象**(不筛不排不截断),保住配方计算器「该类别全部物料」的既有行为;
     * 结果缺少 {@code list}/{@code detail} 等畸形输入同样原样返回,不抛异常。
     *
     * @param result  {@code queryFormDataList} 的返回(可 null)
     * @param keyword 用户输入(空 / null ⇒ 原样返回)
     */
    public static Map<String, Object> rankResult(Map<String, Object> result, String keyword) {
        if (result == null || normalize(keyword).isEmpty()) return result;
        Object listObj = result.get("list");
        if (!(listObj instanceof List<?> docs)) return result;
        List<Object> docsOut = new ArrayList<>(docs.size());
        int total = 0;
        for (Object d : docs) {
            if (!(d instanceof Map<?, ?> doc)) {
                docsOut.add(d);                     // 非单头:原样带过
                continue;
            }
            Map<String, Object> docOut = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : doc.entrySet()) {
                String key = String.valueOf(e.getKey());
                Object v = e.getValue();
                if (!"detail".equals(key) || !(v instanceof Map<?, ?> detail)) {
                    docOut.put(key, v);
                    continue;
                }
                Map<String, Object> detailOut = new LinkedHashMap<>();
                for (Map.Entry<?, ?> de : detail.entrySet()) {
                    Object rowsVal = de.getValue();
                    if (rowsVal instanceof List<?> rows) {
                        List<Map<String, Object>> ranked = rank(asRowList(rows), keyword);
                        total += ranked.size();
                        detailOut.put(String.valueOf(de.getKey()), ranked);
                    } else {
                        detailOut.put(String.valueOf(de.getKey()), rowsVal);
                    }
                }
                docOut.put(key, detailOut);
            }
            docsOut.add(docOut);
        }
        Map<String, Object> out = new LinkedHashMap<>(result);
        out.put("totalSize", total);
        out.put("list", docsOut);
        return out;
    }

    // ── 内部工具(纯函数,无状态) ──────────────────────────────────────────────

    /** 关键词归一:trim + 小写(用 {@link Locale#ROOT},避免土耳其语 i 之类的大小写陷阱) */
    private static String normalize(String keyword) {
        return keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
    }

    /** 字段值统一小写(与 {@link #normalize} 同一把尺:先 trim 再小写,都走 {@link Locale#ROOT}) */
    private static String lower(String s) {
        return s.toLowerCase(Locale.ROOT);
    }

    /** 行字段值 → trim 后的文本;缺列 / null ⇒ "" */
    private static String text(Map<String, Object> row, String label) {
        if (row == null) return "";
        Object v = row.get(label);
        return v == null ? "" : String.valueOf(v).trim();
    }

    /**
     * {@code detail} 下的行列表:契约上一定是 {@code List<Map<String,Object>>}
     * ({@code QueryService.rowToLabels} 产出的中文 label 行),这里只是把泛型擦除补回来。
     */
    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asRowList(List<?> rows) {
        return (List<Map<String, Object>>) rows;
    }

    /** 排序中间态:行 + 命中分 + 编码(编码在比较器里要用两次,先取出来免得重复 String.valueOf) */
    private record Scored(Map<String, Object> row, int score, String code) {
    }
}
