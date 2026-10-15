package com.yinjia.mes.service;

import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperReport;
import org.springframework.core.io.ClassPathResource;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 组装成品检验单(QC_ASM_INSP)的「检验项目矩阵」报表 —— **版式按当前明细里实际存在的检验项目动态生成**。
 *
 * <h3>用户口径(2026-10-16)</h3>
 * 「为当前的组装成品检验的导出报表格式为如图所示(检验时间|客户名称|产品编码|型号(mm)|批号|抽检总量|
 * 外观|尺寸|出货重量|结果判断),需要能真实获取明细表中的数据,针对当前不同项目获取格式实现」+
 * 「需要能实现根据当前存在什么检验项目就打印出什么项目的实现,因为当前报表形式不能固定死」。
 *
 * <h3>为什么「生成」而不是「写死 .jrxml」</h3>
 * 检验项目来自出货检验计划表(RD_INSP_PLAN),**每个产品不一样**(C-84-02 是 外观-端盖两头/尺寸-外径/
 * 出货重量/余氯去除率,换个产品又是另一套);而 JR 6.x 的 {@code reportElement} 的 x/y/width/height
 * **只能是整数常量**(写表达式会被 XSD 拒)⇒「一份模板运行期换列」走不通。做法与
 * {@link GenericReportSupport} 同一套路:**骨架固定 + 列按数据生成**:
 * <ul>
 *   <li>骨架 = {@code reports/qc_asm_insp.jrxml}(styles + 标题 + 页脚,**不带** columnHeader/detail);</li>
 *   <li>本类按明细的「检验类型」(2026-10-17 起;原名「表区」)分组、组内**一个检验项目一列**,生成表头两行 + 数据一格行,拼进骨架再编译;</li>
 *   <li>编译结果按「列签名」缓存(结构相同只编一次;数据变了不重编,值走参数)。</li>
 * </ul>
 *
 * <h3>版式(与用户截图同构)</h3>
 * <pre>
 *   ┌────────┬────────┬────────┬─────────┬───────┬────────┬────────────────────────────┬──────┐
 *   │检验时间│客户名称│产品编码│型号（mm）│ 批号  │抽检总量│ 外观(端盖两头|管身两侧|…)  │ 尺寸 │ … │结果判断│
 *   ├────────┼────────┼────────┼─────────┼───────┼────────┼──────┬──────┬──────────────┼──────┼───┼────────┤
 *   │2026-10-10│对应客户…│ C-84-02│45*25*178│20261006│手动录入│无异常│无异常│    44.5     │      │   │  合格  │
 *   └────────┴────────┴────────┴─────────┴───────┴────────┴──────┴──────┴──────────────┴──────┴───┴────────┘
 * </pre>
 * 列内**格数 = 该项目实测值的个数**(最多 5,照面板 测量值1..5),整表格数取各组最大 ⇒ 少格的项目
 * 下面留空格(与截图里的空框一致)。
 *
 * <h3>分组口径(不写死三组,有什么打什么)</h3>
 * 类别({@code 检验类型},原名 表区)按关键词归组:{@code 外观→外观}、{@code 尺寸/重要尺寸/主要尺寸→尺寸}、
 * {@code 重量/出货重量→重量},其余类别**原样自成一组**(性能/功能性测试…);组序 = 外观 → 尺寸 → 重量 → 其它(首次出现次序)。
 * {@code 检验类型=数量判定} 的行是数量分流行、不是检验项目 ⇒ 不进矩阵(整单结论仍进「结果判断」列)。
 *
 * <h3>单元格取值(优先级)</h3>
 * {@code 测量值1..5}(有几格落几格)→ 一格测量值都没有时用 {@code 产线常规功能性结果} →
 * **最后总是带上该行自己的 {@code 结果判断}**(非空才加)。用户 2026-10-16 口径:
 * 「当前各个行存在的判定结果就是这个的实际体现」—— 判定是**行级**的,必须落在**它自己那一列**上,
 * 不能被测量值挤掉(实测:功能性测试行的 结果判断=合格、检验项目行只有测量值,两类都要各归各位)。
 */
public final class QcAsmInspReportSupport {

    private QcAsmInspReportSupport() {}

    /** 报表模板编码(与 report-templates.properties、ReportService 分支一致) */
    public static final String CODE = "qc_asm_insp";
    /** 骨架文件(styles + 标题 + 页脚;columnHeader/detail 由本类生成后拼进去) */
    public static final String FRAME_FILE = "reports/qc_asm_insp.jrxml";

    /** A3 横向(截图是宽表:6 个表头列 + 若干项目列 + 结果判断) */
    public static final int PAGE_W = 1191;
    public static final int PAGE_H = 842;
    private static final int MARGIN = 30;
    /** 表体总宽 = pageWidth − 左右边距(与骨架的 columnWidth 一致) */
    public static final int TABLE_W = PAGE_W - MARGIN * 2;      // 1131
    private static final int HEAD_ROW_H = 15;                    // 表头每行(共两行)
    private static final int CELL_H = 18;                        // 数据格高
    /** 固定项列最多几格:1 格检验结果(定性)+ 5 格测量值(测量值1..5)+ 1 格该行自己的结果判断 */
    private static final int MAX_MEASURE_CELLS = 5;
    /**
     * 一列最多几格。固定项列最多 7(见上);**组列**装的是该组其余项目的值(整组一列多格,用户 2026-10-16
     * 拍板「照截图」)⇒ 行数天然更多,这里放到 20(A3 横向一页放得下 20×18pt),再多则只取前 20 格
     * (实际业务:一个组里通常 1~5 个项目、每个 1~5 个测量值,够用)。
     */
    private static final int MAX_CELLS = 20;
    private static final int MIN_ITEM_W = 38;
    private static final int MAX_ITEM_W = 170;

    /** 表头固定 6 列:{显示名, 参数名}(型号/批号在本单上叫 规格型号/批次号) */
    private static final String[][] HEAD_COLS = {
            {"检验时间", "检验时间"},
            {"客户名称", "客户名称"},
            {"产品编码", "产品编码"},
            {"型号（mm）", "规格型号"},
            {"批号", "批次号"},
            {"抽检总量", "抽检总量"}};
    private static final int[] HEAD_W = {76, 106, 82, 82, 72, 58};   // 合计 476
    private static final int VERDICT_W = 62;
    private static final String VERDICT_COL = "结果判断";

    /** 一个检验项目列:名称 + 若干格值 */
    public record Item(String name, List<String> values) {}
    /** 一个检验类型分组 */
    public record Group(String name, List<Item> items) {}
    /** 矩阵:分组(有序)+ 整单结果判断 + 最大格数 + 结构签名(做编译缓存键) */
    public record Matrix(List<Group> groups, String verdict, int maxCells, String signature) {}

    private static final Map<String, JasperReport> CACHE = new ConcurrentHashMap<>();

    // ============================================================ 取数 → 矩阵

    /** 明细行 → 矩阵(真实检验项目/检验类型/测量值,一行不多一行不少)。
     *  {@code fixed} = yj_panel.config 的固定组声明(见 PanelDef.fixedItems):**声明过的组永远铺**,
     *  组内列 = 固定项列(如 端盖两头/管身两侧)+ **一个组列**(列名「按照X检验项目填充」,装该组其余项目的值,
     *  整组一列多格 —— 用户 2026-10-16 拍板「照截图」)。 */
    public static Matrix matrix(List<Map<String, ?>> rows, String headVerdict, List<PanelRegistry.PanelDef.FixedGroup> fixed) {
        // 组名 → (列名 → 格值);LinkedHashMap 保序
        Map<String, Map<String, List<String>>> byGroup = new LinkedHashMap<>();
        Map<String, String> groupLabel = new LinkedHashMap<>();      // 组 → 组列名(声明优先)
        Map<String, java.util.Set<String>> fixedNames = new LinkedHashMap<>();  // 组 → 固定项的归一化名

        // ① 先铺固定组:组一定存在,固定项各占一列(值先留空,有数据再填)
        for (PanelRegistry.PanelDef.FixedGroup g : fixed == null ? List.<PanelRegistry.PanelDef.FixedGroup>of() : fixed) {
            String group = groupName(g.group());
            if (group.isEmpty()) continue;
            Map<String, List<String>> cols = byGroup.computeIfAbsent(group, k -> new LinkedHashMap<>());
            java.util.Set<String> names = fixedNames.computeIfAbsent(group, k -> new java.util.LinkedHashSet<>());
            groupLabel.putIfAbsent(group, g.columnLabel());
            for (String it : g.items()) {
                String key = PanelRegistry.PanelDef.normItem(it);
                if (key.isEmpty()) continue;
                cols.putIfAbsent(key, new ArrayList<>());
                names.add(key);
            }
        }

        // ② 数据行:固定项的值填进它自己那一列;其余项目进「组列」的格(按行序展平)
        String verdict = str(headVerdict);
        Map<String, List<String>> extraCells = new LinkedHashMap<>();   // 组 → 组列的格值(展平)
        for (Map<String, ?> r : rows == null ? List.<Map<String, ?>>of() : rows) {
            // 整单结论:优先表头 总结论;空则回落到**明细任意一行**的结果判断(数量判定行的 合格/不合格
            // 就是这么来的 —— 它不进矩阵,但结论要用它)⇒ 这一句必须放在下面「跳过数量判定行」之前。
            if (verdict.isEmpty()) verdict = str(r.get("结果判断"));
            String g = groupName(areaOf(r));
            if (g.isEmpty()) continue;                        // 数量判定行:不是检验项目
            String key = PanelRegistry.PanelDef.normItem(str(r.get("检验项目")));
            if (key.isEmpty()) continue;
            List<String> cells = itemValues(r);
            Map<String, List<String>> cols = byGroup.computeIfAbsent(g, k -> new LinkedHashMap<>());
            java.util.Set<String> names = fixedNames.computeIfAbsent(g, k -> new java.util.LinkedHashSet<>());
            if (names.contains(key)) {
                List<String> slot = cols.get(key);            // 固定项:有值即填(空表才填,不覆盖)
                if (slot != null && slot.isEmpty() && !cells.isEmpty()) cols.put(key, cells);
            } else {
                extraCells.computeIfAbsent(g, k -> new ArrayList<>()).addAll(cells);   // 其余项目 → 组列
            }
        }

        // ③ 组装:组序(外观→尺寸→重量→其它)+ 组内列序(固定项先,组列殿后)
        List<Group> groups = new ArrayList<>();
        int maxCells = 1;
        for (String g : sortGroups(byGroup.keySet())) {
            List<Item> items = new ArrayList<>();
            Map<String, List<String>> cols = byGroup.get(g);
            java.util.Set<String> names = fixedNames.get(g);
            for (Map.Entry<String, List<String>> e : cols.entrySet()) {
                items.add(new Item(e.getKey(), e.getValue()));
                maxCells = Math.max(maxCells, Math.max(1, e.getValue().size()));
            }
            List<String> extra = extraCells.getOrDefault(g, List.of());
            // 组列:装该组其余项目的值(可为空 —— 截图上「按照尺寸检验项目填充」那列没有值也照样在)
            items.add(new Item(groupLabel.getOrDefault(g, defaultGroupLabel(g)), extra));
            maxCells = Math.max(maxCells, Math.max(1, extra.size()));
            groups.add(new Group(g, List.copyOf(items)));
        }
        maxCells = Math.min(MAX_CELLS, maxCells);

        StringBuilder sig = new StringBuilder(CODE);
        for (Group g : groups) {
            sig.append('|').append(g.name()).append('{');
            for (Item it : g.items()) sig.append(it.name()).append(':').append(it.values().size()).append(',');
            sig.append('}');
        }
        sig.append("#k=").append(maxCells);
        return new Matrix(List.copyOf(groups), verdict, maxCells, sig.toString());
    }

    /** 组列名兜底(没声明 label 时):「检验项目」组直接用组名,其余「按照X检验项目填充」 */
    static String defaultGroupLabel(String group) {
        return "检验项目".equals(group) ? "检验项目" : "按照" + group + "检验项目填充";
    }

    /** 兼容重载:没有固定项声明时等价于只并数据行 */
    public static Matrix matrix(List<Map<String, ?>> rows, String headVerdict) {
        return matrix(rows, headVerdict, List.of());
    }

    /**
     * 明细行里的**类别键**:2026-10-17 起本单这一列正名为「检验类型」
     * (物理列 qc_asm_insp_detail.检验类型,由 migrate-asm-insp-type-rename-20261017.sql 改名而来),
     * 它同时是打印分组键 —— 报表的分段(外观 / 尺寸 / 重量 / 其它)就是按它归的。
     *
     * <p>这里**兼容读一次旧键「表区」**:部署时"先换 jar 还是先跑迁移脚本"不该决定报表能不能分段
     * (迁移没跑 = 行里只有 表区;跑了 = 只有 检验类型),两个键都认,报表都不掉组。</p>
     */
    private static String areaOf(Map<String, ?> r) {
        String v = str(r.get("检验类型"));
        return v.isEmpty() ? str(r.get("表区")) : v;
    }

    /** 表区 → 组名(关键词归组;数量判定不进矩阵;空类别按「检验项目」) */
    static String groupName(String sector) {
        String s = sector == null ? "" : sector.trim();
        if (s.isEmpty()) return "检验项目";
        if ("数量判定".equals(s)) return "";
        if (s.contains("外观")) return "外观";
        if (s.contains("尺寸")) return "尺寸";
        if (s.contains("重量")) return "重量";
        return s;                                             // 性能/功能性测试/…:有什么打什么
    }

    /** 组序:外观 → 尺寸 → 重量 → 其它(保持首次出现次序) */
    private static List<String> sortGroups(java.util.Collection<String> names) {
        List<String> out = new ArrayList<>();
        for (String fixed : List.of("外观", "尺寸", "重量")) {
            if (names.contains(fixed)) out.add(fixed);
        }
        for (String n : names) {
            if (!out.contains(n)) out.add(n);
        }
        return out;
    }

    /**
     * 一个检验项目的格值:**检验结果(定性观测值,如 无异常)** →**测量值1..5 逐格** →**该行的结果判断**。
     * 三者各司其职、都不丢:定性值放外观类,数值放尺寸/重量类,判定永远带出(用户 2026-10-16 口径
     * 「当前各个行存在的判定结果就是这个的实际体现」+「新增检验结果列」);值走 text() 定型(decimal 去尾零)。
     */
    private static List<String> itemValues(Map<String, ?> r) {
        List<String> out = new ArrayList<>();
        String obs = text(r.get("检验结果"));            // 定性观测值(外观类:无异常/异常…)
        if (!obs.isEmpty()) out.add(obs);
        for (int i = 1; i <= MAX_MEASURE_CELLS; i++) {
            String v = text(r.get("测量值" + i));
            if (!v.isEmpty()) out.add(v);
        }
        if (out.isEmpty()) {
            String fn = text(r.get("产线常规功能性结果"));
            if (!fn.isEmpty()) out.add(fn);
        }
        String verdict = text(r.get("结果判断"));
        if (!verdict.isEmpty() && !out.contains(verdict)) out.add(verdict);
        return out;
    }

    /** 报表数据源:**一行**(内容全走参数;没有数据源 Jasper 就不渲染 detail 带) */
    public static List<Map<String, ?>> dataRows() {
        return List.of(new LinkedHashMap<>());
    }

    // ============================================================ 生成 + 编译(按签名缓存)

    public static JasperReport report(Matrix m) {
        return CACHE.computeIfAbsent(m.signature(), k -> build(m));
    }

    private static JasperReport build(Matrix m) {
        List<Item> flat = new ArrayList<>();                  // 展平后的项目列(从左到右)
        for (Group g : m.groups()) flat.addAll(g.items());
        int n = flat.size();

        // ---- 列宽:表头 6 列固定;项目列平分剩余宽度,末列吃掉零头(整行铺满) ----
        int headTotal = 0;
        for (int w : HEAD_W) headTotal += w;
        int avail = TABLE_W - headTotal - VERDICT_W;
        int[] itemW = new int[n];
        if (n > 0) {
            int base = Math.max(MIN_ITEM_W, Math.min(MAX_ITEM_W, avail / n));
            for (int i = 0; i < n; i++) itemW[i] = base;
            int leftover = avail - base * n;
            // 还有余量 ⇒ 轮着加宽(整行铺满);超了 ⇒ 从宽列往下扣(MIN_ITEM_W 兜底,扣不动就接受略微溢出)
            for (int i = 0; leftover > 0; i = (i + 1) % n) { itemW[i]++; leftover--; }
            while (leftover < 0) {
                boolean shrunk = false;
                for (int k = 0; k < n && leftover < 0; k++) {
                    if (itemW[k] > MIN_ITEM_W) { itemW[k]--; leftover++; shrunk = true; }
                }
                if (!shrunk) break;
            }
        }

        // ---- 参数:头字段 + 结果判断 + 列名 N{c} + 每格 V{r}_{c} + 打印时间 ----
        StringBuilder params = new StringBuilder();
        for (String[] h : HEAD_COLS) params.append(param(h[1], "java.lang.String"));
        params.append(param(VERDICT_COL, "java.lang.String"));
        params.append(param("打印时间", "java.lang.String"));
        for (int c = 1; c <= n; c++) params.append(param("N" + c, "java.lang.String"));
        for (int r = 1; r <= m.maxCells(); r++) {
            for (int c = 1; c <= n; c++) params.append(param("V" + r + "_" + c, "java.lang.String"));
        }

        // ---- 表头两行:第一行 = 头字段(跨两行)+ 组名(跨本组各列)+ 结果判断(跨两行);第二行 = 项目名 ----
        StringBuilder head = new StringBuilder();
        int x = 0;
        for (int i = 0; i < HEAD_COLS.length; i++) {
            head.append(staticText(HEAD_COLS[i][0], x, HEAD_W[i], 0, HEAD_ROW_H * 2, "th"));
            x += HEAD_W[i];
        }
        int[] itemX = new int[n];
        int col = 0;
        for (Group g : m.groups()) {
            int gx = x;
            for (Item it : g.items()) {
                itemX[col] = x;
                // 列名按**列宽**截断:font 8 下一个汉字约占 4pt(displayWidth 里汉字算 2 单位)⇒ 每单位≈4pt。
                // (2026-10-16 修:原先按 8pt/单位 算,CJK 列名被砍成「按照尺寸检…」)
                head.append(staticText(clip(it.name(), Math.max(6, itemW[col] / 4)), x, itemW[col], HEAD_ROW_H, HEAD_ROW_H, "th"));
                x += itemW[col];
                col++;
            }
            head.append(staticText(g.name(), gx, Math.max(1, x - gx), 0, HEAD_ROW_H, "thGroup"));
        }
        head.append(staticText(VERDICT_COL, x, Math.max(1, TABLE_W - x), 0, HEAD_ROW_H * 2, "th"));

        // ---- 数据行:头字段值(整列高)+ 每列每格(竖排)+ 结果判断 ----
        int bodyH = Math.max(CELL_H, m.maxCells() * CELL_H);
        StringBuilder body = new StringBuilder();
        x = 0;
        for (int i = 0; i < HEAD_COLS.length; i++) {
            body.append(textField("cellC", x, HEAD_W[i], 0, bodyH, "$P{" + HEAD_COLS[i][1] + "}"));
            x += HEAD_W[i];
        }
        for (int c = 0; c < n; c++) {
            for (int r = 0; r < m.maxCells(); r++) {
                body.append(textField("cellC", itemX[c], itemW[c], r * CELL_H, CELL_H, "$P{V" + (r + 1) + "_" + (c + 1) + "}"));
            }
        }
        int afterItems = n > 0 ? itemX[n - 1] + itemW[n - 1] : x;   // 矩阵区右边界
        body.append(textField("cellC", afterItems, Math.max(1, TABLE_W - afterItems), 0, bodyH, "$P{" + VERDICT_COL + "}"));

        String xml = frame(params.toString(), head.toString(), body.toString(), bodyH);
        try {
            return JasperCompileManager.compileReport(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (JRException e) {
            throw new IllegalStateException("组装成品检验记录表编译失败：" + e.getMessage(), e);
        }
    }

    private static String param(String name, String cls) {
        return "  <parameter name=\"" + name + "\" class=\"" + cls + "\" isForPrompting=\"false\"/>\n";
    }

    private static String staticText(String text, int x, int w, int y, int h, String style) {
        return "      <staticText>\n"
                + "        <reportElement style=\"" + style + "\" x=\"" + x + "\" y=\"" + y + "\" width=\"" + w
                + "\" height=\"" + h + "\"/>\n"
                + "        <text><![CDATA[" + text + "]]></text>\n"
                + "      </staticText>\n";
    }

    private static String textField(String style, int x, int w, int y, int h, String expr) {
        return "      <textField isBlankWhenNull=\"true\">\n"
                + "        <reportElement style=\"" + style + "\" x=\"" + x + "\" y=\"" + y + "\" width=\"" + w
                + "\" height=\"" + h + "\"/>\n"
                + "        <textFieldExpression><![CDATA[" + expr + "]]></textFieldExpression>\n"
                + "      </textField>\n";
    }

    /**
     * 拼装:骨架(**styles + 标题 + 页脚**,不带 columnHeader/detail)+ 生成的参数段 +
     * columnHeader(表头两行)+ detail(数据一格行)。
     * ⚠ XSD 内容模型是**有序**的:parameter 必须在 title 之前、columnHeader/detail 在 title 之后
     *   ⇒ 参数插在 &lt;title&gt; 前,两个带插在 &lt;pageFooter&gt; 前(与 GenericReportSupport.compileMaster 同款切法)。
     */
    private static String frame(String paramsXml, String headXml, String bodyXml, int bodyH) {
        String base = readFrame();
        int titleAt = base.indexOf("<title>");
        int footerAt = base.indexOf("<pageFooter>");
        if (titleAt < 0 || footerAt < 0 || footerAt < titleAt) {
            throw new IllegalStateException("组装成品检验记录表骨架缺少 <title> 或 <pageFooter>：" + FRAME_FILE);
        }
        if (base.contains("<detail>") || base.contains("<columnHeader>")) {
            throw new IllegalStateException("骨架不该自带 <detail>/<columnHeader>(会与生成段重复)：" + FRAME_FILE);
        }
        return base.substring(0, titleAt)
                + paramsXml
                + base.substring(titleAt, footerAt)
                + "  <columnHeader>\n    <band height=\"" + (HEAD_ROW_H * 2) + "\">\n" + headXml + "    </band>\n  </columnHeader>\n"
                + "  <detail>\n    <band height=\"" + bodyH + "\">\n" + bodyXml + "    </band>\n  </detail>\n"
                + base.substring(footerAt);
    }

    /**
     * 读骨架并**剥掉 XML 注释**:骨架头部有一段给人看的说明,里面自然会写到 `<title>`/`<detail>` 这些字样 ——
     * 不剥的话下面按 indexOf 切分与「不该自带 detail」的守卫都会被注释里的字面量误命中(2026-10-16 实测踩到:
     * 报「骨架不该自带 &lt;detail&gt;」,其实只是注释里提了一句)。
     */
    private static String readFrame() {
        try (InputStream in = new ClassPathResource(FRAME_FILE).getInputStream()) {
            String raw = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            return raw.replaceAll("(?s)<!--.*?-->", "");
        } catch (IOException e) {
            throw new IllegalStateException("组装成品检验记录表骨架读不到：" + FRAME_FILE, e);
        }
    }

    // ============================================================ 填充参数

    /** 报表参数(ReportService 填充用):头字段 + 结果判断 + 列名/格值 + 打印时间 */
    public static Map<String, Object> params(Matrix m, Map<String, Object> head) {
        Map<String, Object> p = new LinkedHashMap<>();
        for (String[] h : HEAD_COLS) p.put(h[1], text(head.get(h[1])));
        p.put(VERDICT_COL, m.verdict());
        p.put("打印时间", LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        int c = 0;
        for (Group g : m.groups()) {
            for (Item it : g.items()) {
                c++;
                p.put("N" + c, it.name());
                for (int r = 1; r <= m.maxCells(); r++) {
                    p.put("V" + r + "_" + c, r <= it.values().size() ? it.values().get(r - 1) : "");
                }
            }
        }
        return p;
    }

    /** 矩阵可读摘要(探针/日志用) */
    public static String describe(Matrix m) {
        StringBuilder sb = new StringBuilder("组数=" + m.groups().size() + " 格数=" + m.maxCells() + " 结果判断=" + m.verdict());
        for (Group g : m.groups()) {
            sb.append("\n  [").append(g.name()).append(']');
            for (Item it : g.items()) sb.append(' ').append(it.name()).append('=').append(String.join("/", it.values()));
        }
        return sb.toString();
    }

    // ============================================================ 小工具

    /** 单元格文本:统一成字符串(动态列没有 per-column pattern,这里定型才不会出 2026-09-08 00:00:00.0) */
    public static String text(Object v) {
        if (v == null) return "";
        if (v instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate().toString();
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        if (v instanceof java.util.Date d) {
            return new java.sql.Timestamp(d.getTime()).toLocalDateTime().toLocalDate().toString();
        }
        if (v instanceof LocalDateTime dt) return dt.toLocalDate().toString();
        if (v instanceof LocalDate d) return d.toString();
        if (v instanceof BigDecimal bd) {
            BigDecimal s = bd.stripTrailingZeros();
            return s.scale() < 0 ? s.setScale(0, RoundingMode.UNNECESSARY).toPlainString() : s.toPlainString();
        }
        if (v instanceof Double || v instanceof Float) {
            return BigDecimal.valueOf(((Number) v).doubleValue()).stripTrailingZeros().toPlainString();
        }
        String s = String.valueOf(v);
        // 数值型**字符串**(decimal 列经查询/JSON 层会变成 "11.1000")⇒ 去尾零,报表上写 11.1
        // (批号 20261010 这类整数字符串不匹配,原样保留)
        if (s.matches("-?\\d+\\.\\d+")) {
            try {
                BigDecimal bd = new BigDecimal(s).stripTrailingZeros();
                return bd.scale() < 0 ? bd.setScale(0, RoundingMode.UNNECESSARY).toPlainString() : bd.toPlainString();
            } catch (ArithmeticException | NumberFormatException ignore) {
                // 落回原样
            }
        }
        return s.length() > 4000 ? s.substring(0, 4000) : s;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int displayWidth(String s) {
        int w = 0;
        for (int i = 0; i < s.length(); i++) w += s.charAt(i) > 0x2E80 ? 2 : 1;
        return w;
    }

    private static String clip(String s, int maxUnits) {
        if (s == null || s.isEmpty()) return "";
        if (displayWidth(s) <= maxUnits) return s;
        StringBuilder sb = new StringBuilder();
        int w = 0;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            int cw = ch > 0x2E80 ? 2 : 1;
            if (w + cw > maxUnits - 1) break;
            sb.append(ch);
            w += cw;
        }
        return sb + "…";
    }
}
