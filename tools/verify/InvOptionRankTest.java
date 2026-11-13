import com.yinjia.mes.service.InvOptionRank;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * InvOptionRankTest —— 物料候选「范围筛选 + 命中优先级排序」纯函数验算(不碰库、直接跑)。
 *
 * <p>钉死 2026-11-13 用户报障场景:新增生产工单页「产品编码」输入 {@code 123},
 * 下拉里规格型号 {@code 123334-00-9} 的 Y-S-T(硫酸氧钛) 排最前,编码/名称含 123 的
 * SP00013(测试123) 反而靠后。修好后:**编码/名称含 123 的排最前,规格型号含 123 的排后面,
 * 只靠备注/图片链接命中的行不再出现在候选里**。
 *
 * <p>跑法(仓库根目录;**必须先有 JDK 25** —— {@code backend/pom.xml} 是
 * {@code <java.version>25</java.version>},而本机 PATH 上的 {@code java} 可能是老的 1.8
 * (会报 UnsupportedClassVersionError),跑前按仓库脚本的探测取 {@code JAVA_HOME} 并把
 * {@code %JAVA_HOME%\bin} 放到 PATH 最前):
 * <pre>
 *   javac -encoding UTF-8 -d .tmp/invrank tools/verify/InvOptionRankTest.java \
 *       backend/src/main/java/com/yinjia/mes/service/InvOptionRank.java
 *   java -cp .tmp/invrank InvOptionRankTest
 * </pre>
 */
public class InvOptionRankTest {

    private static int pass = 0, fail = 0;

    public static void main(String[] args) {
        scoreCases();
        filterCases();
        userScreenshotCase();
        tieBreakCases();
        truncateCases();
        keywordAndValueEdgeCases();
        rankResultShapeCases();

        System.out.println("RESULT: " + (fail == 0 ? "PASS" : "FAIL") + " (pass=" + pass + ", fail=" + fail + ")");
        if (fail > 0) System.exit(1);
    }

    // ── 1) 命中分档位:0 最好 … 9 兜底 ──────────────────────────────────────────

    private static void scoreCases() {
        // 用户截图里最典型的两行(规格型号 123334-00-9 的硫酸氧钛 vs 名称含 123 的 SP00013)
        Map<String, Object> lsys = row("存货编码", "Y-S-T", "存货名称", "硫酸氧钛", "规格型号", "123334-00-9");
        Map<String, Object> sp13 = row("存货编码", "SP00013", "存货名称", "测试123");

        check("档位5:只在规格型号里含 123(硫酸氧钛 123334-00-9)", InvOptionRank.score(lsys, "123") == 5,
                "score=" + InvOptionRank.score(lsys, "123"));
        check("档位4:名称含 123(SP00013 测试123)", InvOptionRank.score(sp13, "123") == 4,
                "score=" + InvOptionRank.score(sp13, "123"));
        check("编码== 最好(0)", InvOptionRank.score(row("存货编码", "123"), "123") == 0, "");
        check("编码前缀(1)", InvOptionRank.score(row("存货编码", "1234"), "123") == 1, "");
        check("编码包含(2)", InvOptionRank.score(row("存货编码", "SP1234"), "123") == 2, "");
        check("名称前缀(3)", InvOptionRank.score(row("存货编码", "SP9", "存货名称", "123 测试"), "123") == 3, "");
        check("助记码前缀(6)", InvOptionRank.score(row("存货编码", "SP9", "助记码", "123LSYT"), "123") == 6, "");
        check("助记码包含(7)", InvOptionRank.score(row("存货编码", "SP9", "助记码", "LSYT123"), "123") == 7, "");
        check("条形码包含(8)", InvOptionRank.score(row("存货编码", "SP9", "条形码", "6901234567890"), "123") == 8, "");
        check("五列都不含(兜底 9,该行会被筛掉)", InvOptionRank.score(row("存货编码", "SP9", "备注", "含123"), "123") == 9, "");
        check("编码与名称都命中时取更好的档位(编码包含2 胜过 名称包含4)",
                InvOptionRank.score(row("存货编码", "SP123", "存货名称", "测试123"), "123") == 2, "");

        // 大小写 / 空白归一(忽略大小写、trim)
        check("忽略大小写 + trim:kw ' sp00013 ' 命中编码 ' SP00013 ' ⇒ 0",
                InvOptionRank.score(row("存货编码", " SP00013 "), " sp00013 ") == 0, "");
        check("忽略大小写:kw 'sp' vs 编码 'SP00013' ⇒ 前缀1",
                InvOptionRank.score(row("存货编码", "SP00013"), "sp") == 1, "");
        check("空关键词 ⇒ 9(不参与排序)",
                InvOptionRank.score(row("存货编码", "123"), "  ") == 9
                        && InvOptionRank.score(row("存货编码", "123"), null) == 9, "");
        check("null 行不炸 ⇒ 9", InvOptionRank.score(null, "123") == 9, "");
    }

    // ── 2) 范围筛选:只留那五列命中的行 ─────────────────────────────────────────

    private static void filterCases() {
        List<Map<String, Object>> pool = new ArrayList<>(List.of(
                row("存货编码", "SP00013", "存货名称", "测试123"),                                  // 名称含 ⇒ 保留
                row("存货编码", "Y-S-T", "存货名称", "硫酸氧钛", "规格型号", "123334-00-9"),         // 规格型号含 ⇒ 保留
                row("存货编码", "SP00014", "存货名称", "测试124", "备注", "含123"),                  // 只有备注含 ⇒ 丢弃
                row("存货编码", "SP00015", "存货名称", "测试abc", "图片链接", "/img/123.png")));     // 只有图片链接含 ⇒ 丢弃
        pool.add(null);                                                                            // 脏数据 ⇒ 丢弃
        List<Map<String, Object>> kept = InvOptionRank.rank(pool, "123");
        check("范围筛选:备注/图片链接命中的行丢弃(null 行也丢弃)",
                codes(kept).equals(List.of("SP00013", "Y-S-T")), codes(kept).toString());

        // 只看那五列:助记码/条形码命中的行保留
        List<Map<String, Object>> otherCols = InvOptionRank.rank(List.of(
                row("存货编码", "SP001", "助记码", "LSYT123"),
                row("存货编码", "SP002", "条形码", "6901234567890"),
                row("存货编码", "SP003", "品牌", "123牌")), "123");
        check("范围筛选:助记码/条形码命中的保留,只有品牌命中的丢弃",
                codes(otherCols).equals(List.of("SP001", "SP002")), codes(otherCols).toString());

        check("范围筛选:完全没命中 ⇒ 空列表", InvOptionRank.rank(List.of(
                row("存货编码", "SP1", "存货名称", "测试"), row("存货编码", "SP2", "备注", "123")), "123").isEmpty(), "");
    }

    // ── 3) 用户截图场景(钉死):名称含 123 的排到规格型号含 123 的前面 ────────────

    private static void userScreenshotCase() {
        // 入参顺序刻意照"旧行为"排:规格型号命中、且 id 更大的在前(t.id DESC)
        List<Map<String, Object>> rows = List.of(
                row("存货编码", "Y-S-T", "存货名称", "硫酸氧钛", "规格型号", "123334-00-9"),
                row("存货编码", "Y-2-T", "存货名称", "二氧化钛", "规格型号", "1234567-00-2"),
                row("存货编码", "SP00013", "存货名称", "测试123"));
        List<Map<String, Object>> ranked = InvOptionRank.rank(rows, "123");
        check("用户截图场景:名称含 123 的 SP00013 排最前(不再被规格型号 123334 顶下去)",
                codeOf(ranked.get(0)).equals("SP00013"), codes(ranked).toString());
        check("用户截图场景:规格型号命中(档位5)整体排在名称命中(档位4)之后",
                codes(ranked).equals(List.of("SP00013", "Y-2-T", "Y-S-T")), codes(ranked).toString());
    }

    // ── 4) 同分排序:编码长度升序 → 编码字典序 → 原顺序稳定 ──────────────────────

    private static void tieBreakCases() {
        List<Map<String, Object>> rows = List.of(
                row("存货编码", "SP00012", "存货名称", "测试123"),
                row("存货编码", "SP00013", "存货名称", "测试123"),
                row("存货编码", "SP12", "存货名称", "测试123"),
                row("存货编码", "SP00011", "存货名称", "测试123"));
        List<Map<String, Object>> ranked = InvOptionRank.rank(rows, "123");
        check("同分:编码短的在前,同长按编码字典序升序",
                codes(ranked).equals(List.of("SP12", "SP00011", "SP00012", "SP00013")), codes(ranked).toString());

        // 档位不同时先按档位:编码包含(2) 一定在 名称包含(4) 之前
        List<Map<String, Object>> mixed = InvOptionRank.rank(List.of(
                row("存货编码", "SP00013", "存货名称", "测试123"),
                row("存货编码", "SP123", "存货名称", "测试124")), "123");
        check("档位优先于同分规则:编码包含(2) 排在 名称包含(4) 前面",
                codes(mixed).equals(List.of("SP123", "SP00013")), codes(mixed).toString());

        // 同分同编码 ⇒ 保持原顺序(稳定排序,结果可复跑)
        List<Map<String, Object>> same = InvOptionRank.rank(List.of(
                row("存货编码", "SP00013", "存货名称", "测试123", "所属类别", "A"),
                row("存货编码", "SP00013", "存货名称", "测试123", "所属类别", "B")), "123");
        check("同分同编码:保持原顺序(稳定排序,可复跑)",
                "A".equals(same.get(0).get("所属类别")) && "B".equals(same.get(1).get("所属类别")),
                String.valueOf(same));
    }

    // ── 5) 截断 MAX_OPTIONS(200)行 ─────────────────────────────────────────────

    private static void truncateCases() {
        check("MAX_OPTIONS = 200", InvOptionRank.MAX_OPTIONS == 200, "=" + InvOptionRank.MAX_OPTIONS);
        // 注意编码段要从 300 起:SP00123 自身就含 123(会被当成"编码包含"排到最前),
        // 那样就测不到"按编码长度/字典序取前 200"这件事了。
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 300; i < 550; i++) {
            many.add(row("存货编码", "INV" + String.format("%05d", i), "存货名称", "测试123"));
        }
        List<Map<String, Object>> cut = InvOptionRank.rank(many, "123");
        check("排序后截断 200 行", cut.size() == 200, "size=" + cut.size());
        check("截断保留排前面的 200 行(INV00300 … INV00499,编码都不含 123 ⇒ 同档位按字典序)",
                codeOf(cut.get(0)).equals("INV00300") && codeOf(cut.get(199)).equals("INV00499"),
                codeOf(cut.get(0)) + ".." + codeOf(cut.get(cut.size() - 1)));
    }

    // ── 6) 关键词空 / 值类型 / 空列表等边界 ─────────────────────────────────────

    private static void keywordAndValueEdgeCases() {
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 250; i++) many.add(row("存货编码", "SP" + i, "存货名称", "测试123"));
        List<Map<String, Object>> noKw = InvOptionRank.rank(many, "");
        check("空关键词:不筛不排不截断(仍是 250 行,保持原顺序)",
                noKw.size() == 250 && "SP0".equals(codeOf(noKw.get(0))), "size=" + noKw.size());
        check("空关键词:返回浅拷贝,不返回入参本身", noKw != many, "");

        check("null 列表 ⇒ 空列表", InvOptionRank.rank(null, "123").isEmpty(), "");
        check("空列表 ⇒ 空列表", InvOptionRank.rank(List.of(), "123").isEmpty(), "");

        // 条形码在库里可能是数字列:Number 值也要能命中
        Map<String, Object> byNum = row("存货编码", "SP1", "条形码", 6901234567890L);
        check("非字符串值(条形码是数字)也能命中", InvOptionRank.score(byNum, "1234") == 8
                && InvOptionRank.rank(List.of(byNum), "1234").size() == 1, "score=" + InvOptionRank.score(byNum, "1234"));

        // 纯数字关键词:编码里数字最多的排最前(编码前缀命中优先)
        List<Map<String, Object>> numeric = InvOptionRank.rank(List.of(
                row("存货编码", "Y-S-T", "存货名称", "硫酸氧钛", "规格型号", "123334-00-9"),
                row("存货编码", "12345", "存货名称", "测试"),
                row("存货编码", "SP12300", "存货名称", "测试")), "123");
        check("纯数字关键词:编码前缀(12345) → 编码包含(SP12300) → 规格型号(硫酸氧钛)",
                codes(numeric).equals(List.of("12345", "SP12300", "Y-S-T")), codes(numeric).toString());
    }

    // ── 7) 响应形状:rankResult 原样保留 {totalSize, list[{编号,状态,单据状态,detail:{<key>:[rows]}}]} ──

    @SuppressWarnings("unchecked")
    private static void rankResultShapeCases() {
        List<Map<String, Object>> items = new ArrayList<>(List.of(
                row("存货编码", "Y-S-T", "存货名称", "硫酸氧钛", "规格型号", "123334-00-9"),
                row("存货编码", "SP00013", "存货名称", "测试123"),
                row("存货编码", "SP00014", "存货名称", "测试124", "备注", "123")));
        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("编号", "存货");
        doc.put("状态", "启用");
        doc.put("单据状态", "启用");
        doc.put("detail", Map.of("inv", items));       // 刻意用面板自己的 detail key(不是 items/inv 写死)
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("totalSize", 3874);
        raw.put("list", List.of(doc));

        Map<String, Object> out = InvOptionRank.rankResult(raw, "123");
        Map<String, Object> docOut = (Map<String, Object>) ((List<?>) out.get("list")).get(0);
        Map<String, Object> detailOut = (Map<String, Object>) docOut.get("detail");
        List<Map<String, Object>> rowsOut = (List<Map<String, Object>>) detailOut.get("inv");

        check("响应形状:detail 的 key 原样保留(照抄面板 detail_key,没写死)",
                detailOut.keySet().equals(Map.of("inv", 0).keySet()), detailOut.keySet().toString());
        check("响应形状:单头其它键原样保留(编号/状态/单据状态)",
                "存货".equals(docOut.get("编号")) && "启用".equals(docOut.get("状态"))
                        && "启用".equals(docOut.get("单据状态")), String.valueOf(docOut.keySet()));
        check("响应形状:只保留五列命中的行(备注命中的 SP00014 被筛掉)",
                rowsOut.size() == 2 && codes(rowsOut).equals(List.of("SP00013", "Y-S-T")), codes(rowsOut).toString());
        check("响应形状:totalSize 改成截断后的行数(2,不再是 SQL 的 3874)",
                Integer.valueOf(2).equals(out.get("totalSize")), String.valueOf(out.get("totalSize")));
        check("响应形状:不就地改入参(raw.totalSize 仍 3874、原始 detail 行序未变)",
                Integer.valueOf(3874).equals(raw.get("totalSize"))
                        && "Y-S-T".equals(codeOf(items.get(0))), codeOf(items.get(0)));

        // totalSize 与截断联动:250 行 ⇒ totalSize=200
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 250; i++) many.add(row("存货编码", "SP" + String.format("%05d", i), "存货名称", "测试123"));
        Map<String, Object> doc2 = new LinkedHashMap<>();
        doc2.put("编号", "存货");
        doc2.put("detail", Map.of("items", many));
        Map<String, Object> raw2 = new LinkedHashMap<>();
        raw2.put("totalSize", 3000);
        raw2.put("list", List.of(doc2));
        Map<String, Object> out2 = InvOptionRank.rankResult(raw2, "123");
        check("响应形状:totalSize 与截断联动(3000 行命中 ⇒ totalSize 200)",
                Integer.valueOf(200).equals(out2.get("totalSize")), String.valueOf(out2.get("totalSize")));

        // 空关键词 / 畸形输入:原样返回同一个对象
        check("空关键词:rankResult 原样返回同一个对象(配方计算器「该类别全部」不受影响)",
                InvOptionRank.rankResult(raw, null) == raw && InvOptionRank.rankResult(raw, "  ") == raw, "");
        Map<String, Object> noList = Map.of("totalSize", 0);
        check("无 list 的畸形输入:原样返回、不抛异常",
                InvOptionRank.rankResult(noList, "123") == noList && InvOptionRank.rankResult(null, "123") == null, "");
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    /** 造一行:按 label → value 交替传参(行键就是中文 label,与 QueryService.rowToLabels 一致) */
    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    private static String codeOf(Map<String, Object> r) {
        Object v = r.get(InvOptionRank.CODE);
        return v == null ? "" : String.valueOf(v);
    }

    private static List<String> codes(List<Map<String, Object>> rows) {
        List<String> out = new ArrayList<>();
        for (Map<String, Object> r : rows) out.add(codeOf(r));
        return out;
    }

    private static void check(String name, boolean ok, String detail) {
        System.out.println((ok ? "[PASS] " : "[FAIL] ") + name + "  " + (ok ? "" : detail));
        if (ok) pass++; else fail++;
    }
}
