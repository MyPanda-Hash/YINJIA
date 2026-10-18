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
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 炭棒成型车间首件检验记录表(QC_FIRST_INSP)的「样品 × 测试项目矩阵」报表 ——
 * **版式按当前明细里实际存在的测试项目动态生成**。
 *
 * <h3>用户口径(2026-10-17)</h3>
 * 「打印样式需要实现就是当前报表的excel表,当前制程检验单已经存在实现。」
 * ⇒ 「文档输出 → 导出报表」的服务端报表要按**面板上这张纸**出(与它的 Excel 导出同版式),
 *   照制程检验单({@code qc_proc_insp})/ 组装成品检验单({@link QcAsmInspReportSupport})的既有实现做。
 * <p>改前本面板没有专用模板,{@code ReportService} 回落 generic 通用模板 ⇒ 导出来是
 * <b>14 页 / 415 行</b>的「序号 / 检验项目 / 检验要求 / 检验方法」字段流水,与这张纸毫无关系。</p>
 *
 * <h3>为什么「生成」而不是「写死 .jrxml」</h3>
 * 面板支持「新增测试项目 = 新增一列」(见 {@code core/qc/firstInspCols.js}),而 JR 6.x 的
 * {@code reportElement} 的 x/y/width/height **只能是整数常量**(写表达式会被 XSD 拒)
 * ⇒「一份模板运行期换列」走不通。做法与 {@link QcAsmInspReportSupport} 同一套路:
 * <ul>
 *   <li>骨架 = {@code reports/qc_first_insp.jrxml}(styles + 标题 + 抬头 + 相关要求 + 表尾 + 页脚,
 *       **不带** columnHeader/detail);</li>
 *   <li>本类按明细的「项目分组」分组、组内**一个测试项目一列**,生成两级表头 + 标准行 + 1#..8# 样品行,
 *       拼进骨架再编译;</li>
 *   <li>编译结果按「列签名」缓存(结构相同只编一次;数据变了不重编,值走参数)。</li>
 * </ul>
 *
 * <h3>版式(与面板纸张 / 它的 Excel 导出同源)</h3>
 * <pre>
 *   产品编号 │…│ 产品型号 │…│ 生产日期 │…│ 组别 │…          ← 骨架 title(值走参数)
 *   ┌────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
 *   │测试项目│        表观及脱粉        │           尺寸及重量           │ 强度 │浊度及压降│
 *   │样品序号│表观状态│脱粉情况│ 外径 │ 内径 │ 长度 │ 重量 │ 跌落 │挤压强度│浊度NTU│压降kPa│
 *   ├────────┼──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┤
 *   │  标准  │  /   │  /   │外径:…│  …   │      │      │跌落:…│  …   │  /   │压降:…│
 *   │   1#   │无粘模…│无明显…│  /   │  /   │  /   │  /   │  /   │  /   │  /   │  /   │
 *   │  …8#   │  …                                                                  │
 *   └────────┴──────────────────────────────────────────────────────────────────────┘
 *   相关要求 6 条 + 检验结果 / 检验人 / 审核人                        ← 骨架 summary
 *   (审核人 2026-10-18 补:首件检验单同批开了直接审核,值走参数取自 yj_doc_status.shr)
 * </pre>
 *
 * <h3>可填格口径(与面板、Excel 导出**逐字同源**)</h3>
 * 相关要求第 1 条「…各记录 2 支样品」= **每个分组各占一对样品行**:
 * 表观及脱粉→1#/2#、尺寸及重量→3#/4#、强度→5#/6#、浊度及压降→7#/8#(未知分组落最后一对)。
 * 本组那一对写实测值(<b>没值就是空格</b>,与纸面一致),其余格一律写 {@code /}。
 */
public final class QcFirstInspReportSupport {

    private QcFirstInspReportSupport() {}

    /** 报表模板编码(与 report-templates.properties、ReportService 分支一致) */
    public static final String CODE = "qc_first_insp";
    /** 骨架文件(styles + 标题/抬头 + 相关要求 + 表尾 + 页脚;表头与样品行由本类生成后拼进去) */
    public static final String FRAME_FILE = "reports/qc_first_insp.jrxml";

    /** A4 横向(11 列矩阵;与面板纸张的横宽比例一致) */
    public static final int PAGE_W = 842;
    public static final int PAGE_H = 595;
    private static final int MARGIN = 30;
    /** 表体总宽 = pageWidth − 左右边距(与骨架的 columnWidth 一致) */
    public static final int TABLE_W = PAGE_W - MARGIN * 2;      // 782
    /** 行标签列(样品序号 / 标准)宽 */
    private static final int LABEL_W = 78;
    /** 表头每行高(两级 ⇒ 共两行) */
    private static final int HEAD_ROW_H = 20;
    /** 样品行高 */
    private static final int SAMPLE_ROW_H = 20;
    /** 字号(标准行 7pt、其余 8pt —— 与骨架里的 style 对齐,用来估行高) */
    private static final double STD_FONT = 7;
    private static final double CELL_FONT = 8;
    /** 1 个"显示单位"≈ 半个汉字 ≈ 字号/2 宽(pt);行高按 1.35 倍字号估 */
    private static final double LINE_FACTOR = 1.45;

    /** 分组先后(与 core/qc/firstInspCols.js 的 GROUP_ORDER 逐字一致) */
    private static final String[] GROUP_ORDER = {"表观及脱粉", "尺寸及重量", "强度", "浊度及压降"};
    /** 每个分组各占哪一对样品行(与 firstInspCols.GROUP_SAMPLES 一致;未知分组落最后一对) */
    private static final int[][] GROUP_SAMPLES = {{1, 2}, {3, 4}, {5, 6}, {7, 8}};
    private static final int SAMPLE_COUNT = 8;
    private static final String ROW_STANDARD = "标准";
    private static final String ROW_SAMPLE = "样品";
    /** 纸面「本格无需填写」的占位符 */
    private static final String BLANK = "/";
    /** 抬头四对:纸面标签 → 头字段键(生产日期另有回落链) */
    private static final String[][] HEAD_PAIRS = {
            {"产品编号", "产品编码"},
            {"产品型号", "规格型号"},
            {"生产日期", "生产日期"},
            {"组别", "生产线"}};

    /** 一个测试项目列:数据键 + 列名 + 归属分组 + 显示用列头 + 标准 + 8 个样品格(未填=空串、不该填=/) */
    public record Col(String key, String label, String group, String headText, String standard, List<String> cells) {}
    /** 一个分组(有序) */
    public record Group(String name, List<Col> cols) {}
    /** 抬头一对 */
    public record HeadPair(String label, String value) {}
    /**
     * 矩阵:分组(有序)+ 抬头四对 + 检验结果/检验人 + 列宽 + 结构签名(做编译缓存键)。
     * {@code itemW} 与 {@code groups} 里的列**同序展平**一一对应。
     */
    public record Matrix(List<Group> groups, List<HeadPair> headPairs, String result, String inspector,
                         int[] itemW, String signature) {
        /** 展平后的列数 */
        public int colCount() {
            int n = 0;
            for (Group g : groups) n += g.cols().size();
            return n;
        }
        /** 展平后的列(顺序 = 组序 × 组内序) */
        public List<Col> flatCols() {
            List<Col> out = new ArrayList<>();
            for (Group g : groups) out.addAll(g.cols());
            return out;
        }
    }

    private static final Map<String, JasperReport> CACHE = new ConcurrentHashMap<>();

    // ============================================================ 取数 → 矩阵

    /**
     * 明细行(长表:行类型/样品序号/检验列/检验项目/项目分组/标准/实测数值)→ 矩阵。
     * 列身份 = {@code 检验列}(改列名不动 key,与面板同口径);列序 = 分组按 {@link #GROUP_ORDER}、
     * 组内按**首次出现**的先后;未知分组排最后(它的可填样品对 = 最后一对,与面板一致)。
     */
    public static Matrix matrix(List<Map<String, ?>> rows, Map<String, Object> head) {
        Map<String, Builder> builders = new LinkedHashMap<>();   // key → 构造中(LinkedHashMap 保首次出现序)
        for (Map<String, ?> r : rows == null ? List.<Map<String, ?>>of() : rows) {
            String key = str(r.get("检验列"));
            if (key.isEmpty()) key = str(r.get("检验项目"));
            if (key.isEmpty()) continue;
            String type = str(r.get("行类型"));
            Builder b = builders.get(key);
            if (b == null) {
                b = new Builder(key, str(r.get("检验项目")), str(r.get("项目分组")));
                builders.put(key, b);
            }
            if (ROW_STANDARD.equals(type)) {
                b.standard = str(r.get("标准"));
            } else if (ROW_SAMPLE.equals(type)) {
                int s = sampleNo(str(r.get("样品序号")));
                if (s >= 1 && s <= SAMPLE_COUNT) b.raw[s - 1] = str(r.get("实测数值"));
            }
        }

        // 分组归并:已知组按 GROUP_ORDER,未知组按首次出现序排在后面
        Map<String, List<Col>> byGroup = new LinkedHashMap<>();
        for (String g : GROUP_ORDER) byGroup.put(g, new ArrayList<>());
        List<String> extra = new ArrayList<>();
        for (Builder b : builders.values()) {
            String g = groupName(b.group);
            if (!byGroup.containsKey(g)) {
                byGroup.put(g, new ArrayList<>());
                extra.add(g);
            }
            byGroup.get(g).add(b.build());
        }
        List<Group> groups = new ArrayList<>();
        for (Map.Entry<String, List<Col>> e : byGroup.entrySet()) {
            if (!e.getValue().isEmpty()) groups.add(new Group(e.getKey(), List.copyOf(e.getValue())));
        }

        // 列宽:行标签列固定,其余**等分剩余宽度**(余数补到最后一列,保证合计恰好 = TABLE_W)
        int n = builders.size();
        int[] itemW = new int[Math.max(0, n)];
        if (n > 0) {
            int avail = TABLE_W - LABEL_W;
            int base = Math.max(24, avail / n);
            for (int i = 0; i < n; i++) itemW[i] = base;
            itemW[n - 1] = Math.max(24, itemW[n - 1] + (avail - base * n));
        }

        List<HeadPair> pairs = new ArrayList<>();
        for (String[] p : HEAD_PAIRS) {
            pairs.add(new HeadPair(p[0], headValue(head, p[1])));
        }
        String result = text(head == null ? null : head.get("总结论"));
        String inspector = text(head == null ? null : head.get("检验员"));

        Matrix raw = new Matrix(groups, pairs, result, inspector, itemW, "");
        return new Matrix(groups, pairs, result, inspector, itemW, signature(raw));
    }

    /** 结构签名:列数 + 每列的(分组|key|列头|标准)。同签名 ⇒ 同一份编译产物(值走参数) */
    private static String signature(Matrix m) {
        StringBuilder sb = new StringBuilder();
        sb.append(m.groups().size()).append('|').append(m.colCount());
        for (Group g : m.groups()) {
            sb.append('#').append(g.name());
            for (Col c : g.cols()) sb.append('~').append(c.key()).append('=').append(c.headText())
                    .append('@').append(c.standard());
        }
        return Integer.toHexString(sb.toString().hashCode()) + "-" + m.colCount();
    }

    // ============================================================ 生成 → 编译(带缓存)

    /** 按矩阵取(必要时生成并编译)报表;同签名命中缓存 */
    public static JasperReport report(Matrix m) {
        String sig = m.signature();
        JasperReport cached = CACHE.get(sig);
        if (cached != null) return cached;
        int n = m.colCount();
        int[] itemW = m.itemW();

        // ---- 参数段:固定几个(骨架要用)+ 生成的列名/标准/格值 ----
        StringBuilder params = new StringBuilder();
        for (String p : new String[]{"产品编号", "产品型号", "生产日期", "组别", "总结论", "检验员", "审核人", "打印时间"}) {
            params.append(param(p, "java.lang.String"));
        }
        for (int c = 1; c <= n; c++) {
            params.append(param("N" + c, "java.lang.String"));
            params.append(param("STD" + c, "java.lang.String"));
        }
        for (int s = 1; s <= SAMPLE_COUNT; s++) {
            for (int c = 1; c <= n; c++) params.append(param("V" + s + "_" + c, "java.lang.String"));
        }

        // ---- 表头两级 ----
        StringBuilder head = new StringBuilder();
        // 左上角:两行字拼出纸面那条斜线("测试项目"右上 / "样品序号"左下)
        head.append(staticText("测试项目", 0, LABEL_W, 0, HEAD_ROW_H, "cornerA"));
        head.append(staticText("样品序号", 0, LABEL_W, HEAD_ROW_H, HEAD_ROW_H, "cornerB"));
        int x = LABEL_W;
        int ci = 0;
        for (Group g : m.groups()) {
            int gx = x;
            for (Col c : g.cols()) {
                head.append(staticText(c.headText(), x, itemW[ci], HEAD_ROW_H, HEAD_ROW_H, "th"));
                x += itemW[ci];
                ci++;
            }
            head.append(staticText(g.name(), gx, Math.max(1, x - gx), 0, HEAD_ROW_H, "thGroup"));
        }

        // ---- 标准行 + 1#..8# 样品行 ----
        List<Col> cols = m.flatCols();
        int stdH = stdRowHeight(cols, itemW);
        StringBuilder body = new StringBuilder();
        body.append(staticText("标准", 0, LABEL_W, 0, stdH, "th"));
        x = LABEL_W;
        for (int c = 0; c < n; c++) {
            body.append(textField("small", x, itemW[c], 0, stdH, "$P{STD" + (c + 1) + "}"));
            x += itemW[c];
        }
        for (int s = 1; s <= SAMPLE_COUNT; s++) {
            int y = stdH + (s - 1) * SAMPLE_ROW_H;
            body.append(staticText(s + "#", 0, LABEL_W, y, SAMPLE_ROW_H, "th"));
            x = LABEL_W;
            for (int c = 0; c < n; c++) {
                body.append(textField("cellC", x, itemW[c], y, SAMPLE_ROW_H, "$P{V" + s + "_" + (c + 1) + "}"));
                x += itemW[c];
            }
        }
        int bodyH = stdH + SAMPLE_COUNT * SAMPLE_ROW_H;

        String xml = frame(params.toString(), head.toString(), body.toString(), bodyH);
        try {
            JasperReport report = JasperCompileManager.compileReport(
                    new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            CACHE.put(sig, report);
            return report;
        } catch (JRException e) {
            throw new IllegalStateException("首件检验记录表编译失败：" + e.getMessage(), e);
        }
    }

    /** 标准行需要多高:按每列文字在**本列宽度**下要折几行估(字体小、列窄,写死 20pt 会被裁) */
    private static int stdRowHeight(List<Col> cols, int[] itemW) {
        double lineH = STD_FONT * LINE_FACTOR;
        int maxLines = 1;
        for (int c = 0; c < cols.size(); c++) {
            String v = cols.get(c).standard().isEmpty() ? BLANK : cols.get(c).standard();
            maxLines = Math.max(maxLines, estLines(v, itemW[c], STD_FONT));
        }
        return (int) Math.ceil(Math.max(1, maxLines) * lineH) + 4;
    }

    /** 一段文字在 widthPt 宽、fontPt 字号下大约占几行(汉字算 2 个显示单位) */
    private static int estLines(String s, int widthPt, double fontPt) {
        if (s == null || s.isEmpty()) return 1;
        // 1 个显示单位 ≈ fontPt/2 pt 宽 ⇒ 每行可容的显示单位数
        double unitsPerLine = Math.max(4, widthPt / (fontPt / 2.0));
        int lines = 0;
        for (String seg : s.split("\n")) {
            lines += Math.max(1, (int) Math.ceil(displayWidth(seg) / unitsPerLine));
        }
        return Math.max(1, lines);
    }

    private static String param(String name, String cls) {
        return "  <parameter name=\"" + name + "\" class=\"" + cls + "\" isForPrompting=\"false\"/>\n";
    }

    private static String staticText(String text, int x, int w, int y, int h, String style) {
        return "      <staticText>\n"
                + "        <reportElement style=\"" + style + "\" x=\"" + x + "\" y=\"" + y + "\" width=\"" + w
                + "\" height=\"" + h + "\"/>\n"
                + "        <text><![CDATA[" + cdata(text) + "]]></text>\n"
                + "      </staticText>\n";
    }

    private static String textField(String style, int x, int w, int y, int h, String expr) {
        return "      <textField isBlankWhenNull=\"true\">\n"
                + "        <reportElement style=\"" + style + "\" x=\"" + x + "\" y=\"" + y + "\" width=\"" + w
                + "\" height=\"" + h + "\"/>\n"
                + "        <textFieldExpression><![CDATA[" + expr + "]]></textFieldExpression>\n"
                + "      </textField>\n";
    }

    /** CDATA 里不能出现 ]]> —— 列名/标准都是业务文本,真出现就拆开写(不写它会把整个模板弄坏) */
    private static String cdata(String s) {
        return s == null ? "" : s.replace("]]>", "]]]]><![CDATA[>");
    }

    /**
     * 拼装:骨架 + 生成的参数段 + columnHeader(两级表头)+ detail(标准行 + 8 个样品行)。
     * ⚠ XSD 内容模型是**有序**的:parameter 必须在 title 之前、columnHeader/detail 在 title 之后、
     *   且都要在 pageFooter 之前 ⇒ 参数插在 &lt;title&gt; 前,两个带插在 &lt;pageFooter&gt; 前
     *   (与 QcAsmInspReportSupport.frame 同款切法)。
     */
    private static String frame(String paramsXml, String headXml, String bodyXml, int bodyH) {
        String base = readFrame();
        int titleAt = base.indexOf("<title>");
        int footerAt = base.indexOf("<pageFooter>");
        if (titleAt < 0 || footerAt < 0 || footerAt < titleAt) {
            throw new IllegalStateException("首件检验记录表骨架缺少 <title> 或 <pageFooter>：" + FRAME_FILE);
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
     * 不剥的话按 indexOf 切分与「不该自带 detail」的守卫都会被注释里的字面量误命中
     * (QcAsmInspReportSupport 2026-10-16 实测踩到过,这里沿用同一处理)。
     */
    private static String readFrame() {
        try (InputStream in = new ClassPathResource(FRAME_FILE).getInputStream()) {
            String raw = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            return raw.replaceAll("(?s)<!--.*?-->", "");
        } catch (IOException e) {
            throw new IllegalStateException("首件检验记录表骨架读不到：" + FRAME_FILE, e);
        }
    }

    // ============================================================ 填充参数

    /** 报表参数(ReportService 填充用):抬头四对 + 总结论/检验员/审核人 + 列名/标准/每格格值 + 打印时间 */
    public static Map<String, Object> params(Matrix m, Map<String, Object> head) {
        Map<String, Object> p = new LinkedHashMap<>();
        for (HeadPair hp : m.headPairs()) p.put(hp.label(), hp.value());
        p.put("总结论", m.result());
        p.put("检验员", m.inspector());
        // 审核人(2026-10-18):**不是本表物理列** —— ReportService.headParams 下发的是单据的虚拟字段
        // 「审核人」(QueryService 对非两级审批面板用 yj_doc_status.shr 覆盖),未审核/取不到时给空串。
        p.put("审核人", head == null ? "" : text(head.get("审核人")));
        p.put("打印时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        List<Col> cols = m.flatCols();
        for (int c = 1; c <= cols.size(); c++) {
            Col col = cols.get(c - 1);
            p.put("N" + c, col.headText());
            p.put("STD" + c, col.standard().isEmpty() ? BLANK : col.standard());
            for (int s = 1; s <= SAMPLE_COUNT; s++) p.put("V" + s + "_" + c, col.cells().get(s - 1));
        }
        return p;
    }

    /** 数据源:内容全走参数,Jasper 没有数据源就不渲染 detail 带 ⇒ 必须给一行(与 QcAsmInspReportSupport 同款) */
    public static List<Map<String, ?>> dataRows() {
        Map<String, Object> one = new LinkedHashMap<>();
        one.put("dummy", 1);
        return List.of(one);
    }

    /** 矩阵可读摘要(探针/日志用) */
    public static String describe(Matrix m) {
        StringBuilder sb = new StringBuilder("组数=" + m.groups().size() + " 列数=" + m.colCount()
                + " 结果=" + m.result() + " 检验人=" + m.inspector());
        for (Group g : m.groups()) {
            sb.append("\n  [").append(g.name()).append(']');
            for (Col c : g.cols()) {
                sb.append(' ').append(c.headText()).append("(标准=").append(c.standard()).append("; 格=")
                        .append(String.join(",", c.cells())).append(')');
            }
        }
        return sb.toString();
    }

    // ============================================================ 小工具(口径与前端 core/qc/firstInspCols.js 对齐)

    /** 分组名:与前端 GROUP_ORDER 逐字比对;不认识的原样自成一组(空 ⇒ 落最后一组) */
    private static String groupName(String g) {
        String s = str(g);
        for (String k : GROUP_ORDER) if (k.equals(s)) return k;
        return s.isEmpty() ? GROUP_ORDER[GROUP_ORDER.length - 1] : s;
    }

    /** 本分组用哪一对样品行(未知分组落最后一对,与前端 samplesOfGroup 一致) */
    private static int[] samplesOf(String group) {
        for (int i = 0; i < GROUP_ORDER.length; i++) if (GROUP_ORDER[i].equals(group)) return GROUP_SAMPLES[i];
        return GROUP_SAMPLES[GROUP_SAMPLES.length - 1];
    }

    /** 这一格要不要填(与前端 isFillableCell 同口径) */
    private static boolean fillable(int sample, String group) {
        for (int s : samplesOf(group)) if (s == sample) return true;
        return false;
    }

    /** 「3#」→ 3;解析不出给 -1 */
    private static int sampleNo(String s) {
        String t = str(s).replace("#", "").trim();
        try {
            return Integer.parseInt(t);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /** 列头显示文字:列名 + 单位,但**单位不重复**(列名里已有 NTU/kPa/mm 的就不再后缀括号) */
    public static String columnHeadText(String label, String unit) {
        String l = str(label);
        String u = str(unit);
        if (u.isEmpty()) return l;
        return l.toLowerCase().contains(u.toLowerCase()) ? l : l + "(" + u + ")";
    }

    /** 列名里能一眼看出来的单位(与前端 unitOfLabel 同口径) */
    public static String unitOfLabel(String label) {
        String s = str(label);
        if (s.matches("(?i).*kpa.*")) return "kPa";
        if (s.matches("(?i).*ntu.*")) return "NTU";
        if (s.matches("(?i).*kgf.*")) return "kgf";
        if (s.matches("(?i).*mm.*")) return "mm";
        if (s.matches("(?i).*cm.*")) return "cm";
        if (s.contains("重量") || s.contains("克重")) return "g";
        return "";
    }

    /** 抬头取值:生产日期按 生产日期 → 检验日期 → 单据日期 回落(与面板只读态同口径) */
    private static String headValue(Map<String, Object> head, String key) {
        if (head == null) return "";
        if ("生产日期".equals(key)) {
            for (String k : new String[]{"生产日期", "检验日期", "单据日期"}) {
                String v = text(head.get(k));
                if (!v.isEmpty()) return v;
            }
            return "";
        }
        if ("规格型号".equals(key)) {
            String v = text(head.get("规格型号"));
            return v.isEmpty() ? text(head.get("产品名称")) : v;
        }
        return text(head.get(key));
    }

    // ---- 与前端 firstInspCols.js 的列模型保持"同一张图纸"的默认 10 列单位表 ----
    /** 图纸声明的单位(前端 DEFAULT_TEST_ITEMS 同源;自定义列回落到 unitOfLabel 猜) */
    private static String declaredUnit(String key, String label) {
        return switch (key) {
            case "outer", "inner", "length" -> "mm";
            case "weight" -> "g";
            case "compress" -> "kgf";
            case "turbidity" -> "NTU";
            case "pressure" -> "kPa";
            default -> unitOfLabel(label);
        };
    }

    /** 单元格/文本统一成字符串(日期去时间、数值去尾零,避免 2026-09-08 00:00:00.0 这种) */
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

    /** 显示宽度:汉字(含全角)算 2 单位、其余算 1(QcAsmInspReportSupport 同款阈值) */
    private static int displayWidth(String s) {
        int w = 0;
        for (int i = 0; i < s.length(); i++) w += s.charAt(i) > 0x2E80 ? 2 : 1;
        return w;
    }

    /** 列构造器:明细是长表,同一列的标准行与 8 个样品行要攒到一起(record 不可变,先攒后冻) */
    private static final class Builder {
        private final String key;
        private final String label;
        private final String group;
        private String standard = "";
        private final String[] raw = new String[SAMPLE_COUNT];

        Builder(String key, String label, String group) {
            this.key = key;
            this.label = label;
            this.group = group;
        }

        Col build() {
            String g = groupName(group);
            String unit = declaredUnit(key, label);
            List<String> cells = new ArrayList<>(SAMPLE_COUNT);
            for (int s = 1; s <= SAMPLE_COUNT; s++) {
                // 本组那一对:写实测值(**没值就是空格**);其余格:纸面上的占位符 `/`
                cells.add(fillable(s, g) ? (raw[s - 1] == null ? "" : raw[s - 1]) : BLANK);
            }
            return new Col(key, label, g, columnHeadText(label, unit), standard, List.copyOf(cells));
        }
    }
}
