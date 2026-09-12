package com.yinjia.mes.service;

import net.sf.jasperreports.engine.JRDataSource;
import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 通用单据报表的**动态明细表**(元数据驱动)。
 *
 * 为什么是「生成」而不是「写死模板」:
 *   铺开范围有 38 张单据面板,明细列从 0 列(日记录类)到 22 列(采购入库单)不等,
 *   一单一 .jrxml 不现实;JR 6.21 的 reportElement 的 x/y/width/height 又**只能是整数常量**
 *   (实测:写表达式会被 XSD 拒: cvc-datatype-valid NMTOKEN),所以「一份模板运行时换列宽」
 *   这条路走不通。做法 = 骨架固定 + 明细按元数据生成:
 *     · 骨架  = reports/report-generic.jrxml(公司抬头/报表名/单据信息/头字段网格/页脚/样式);
 *     · 明细  = 这里按 yj_field(place='detail')的 label + data_type 生成子报表:
 *               列名、列宽、对齐、是否数字列全部来自元数据;
 *     · 列多时**按页分块**:每块独立表头,块标题写「明细（第 a-b 列 / 共 M 列）」——
 *       这是 22 列单据能看的关键;
 *     · 明细 0 行 / 该面板没有明细列时,子报表不产出内容,只有头字段也照常出图。
 *
 * 编译结果按「面板编码 + 列签名」/「块数」缓存,只在某面板第一次导出报表时编译一次。
 */
public final class GenericReportSupport {

    private GenericReportSupport() {}

    /** 基础版式(classpath):骨架 + 样式单一出处 */
    public static final String MASTER_FILE = "reports/report-generic.jrxml";
    private static final String SUBREPORT_NAME = "report_generic_detail";
    /** 与 report-generic.jrxml 的 columnWidth 一致(842 - 37×2) */
    public static final int TABLE_WIDTH = 768;
    /** 头字段网格格数:3 列 × 5 行(与 jrxml 里的格数一致) */
    public static final int HEAD_GRID_CELLS = 15;

    // ---- 版式常量 ----
    private static final int SEQ_WIDTH = 30;          // 序号列
    private static final int MIN_COL = 46;            // 单列下限
    private static final int MAX_COL = 204;           // 单列上限
    private static final int COL_GAP = 6;             // 列间距(并进列宽,相邻单元格各自带边框不会加粗)
    private static final int MAX_COLS_PER_BLOCK = 12; // 一块最多列数
    private static final int ROW_HEIGHT = 16;
    private static final int MAX_ROW_HEIGHT = 60;
    private static final int TABLE_HEAD_HEIGHT = 17;
    private static final int CAPTION_HEIGHT = 18;
    private static final int SUBREPORT_MIN_HEIGHT = 20;
    private static final String FONT = "NotoSansSC";

    private static final Map<String, JasperReport> SUB_CACHE = new ConcurrentHashMap<>();
    private static final Map<String, JasperReport> MASTER_CACHE = new ConcurrentHashMap<>();
    /** 基础版式正文的样式段(生成的报表复用它 —— 样式只维护一处) */
    private static final Pattern STYLE_TAG = Pattern.compile("<style\\b[^>]*/>|<style\\b.*?</style>", Pattern.DOTALL);
    private static volatile String styleBlock;

    /** 一列明细的版式素材(label = yj_field.label,即数据键) */
    public record Col(String label, String dataType) {}

    /** 一个列块:cols = 该块用到的列下标(升序,指向完整列数组);widths = 对应列宽(含列距) */
    public record Block(List<Integer> cols, List<Integer> widths, String caption) {
        public int width() {
            int w = SEQ_WIDTH;
            for (int x : widths) w += x;
            return w;
        }
    }

    // ============================================================ 分块与数据

    /** 明细列 → 列块;列数为 0 时返回空列表(单据没有明细表,报表只有头字段) */
    public static List<Block> layout(List<Col> cols) {
        List<Block> blocks = new ArrayList<>();
        if (cols.isEmpty()) return blocks;
        int total = cols.size();
        int i = 0;
        while (i < total) {
            int n = 1;
            while (i + n < total && n < MAX_COLS_PER_BLOCK && pickWidths(cols, i, n + 1) != null) n++;
            List<Integer> widths = pickWidths(cols, i, n);
            if (widths == null) widths = pickWidths(cols, i, 1);
            List<Integer> idx = new ArrayList<>();
            for (int j = i; j < i + n; j++) idx.add(j);
            String caption = blocks.isEmpty() && i + n >= total
                    ? "明细"
                    : "明细（第 " + (i + 1) + "-" + (i + n) + " 列 / 共 " + total + " 列）";
            blocks.add(new Block(List.copyOf(idx), List.copyOf(widths), caption));
            i += n;
        }
        return blocks;
    }

    /**
     * 某块的明细数据源(扁平行):{SEQ: 块内行号, C1..Cn: 该块第 i 列的值}。
     * 每块一个数据源 —— 主报表每行 = 一个列块,子报表在带里消费它。
     */
    public static JRDataSource blockDataSource(List<Col> cols, Block block, List<Map<String, ?>> rows) {
        List<Map<String, ?>> out = new ArrayList<>();
        int seq = 0;
        for (Map<String, ?> row : rows) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("SEQ", ++seq);
            for (int ci = 0; ci < block.cols().size(); ci++) {
                r.put("C" + (ci + 1), text(row.get(cols.get(block.cols().get(ci)).label())));
            }
            out.add(r);
        }
        return new JRMapCollectionDataSource(out);
    }

    /** 行高:按该块扁平行里最长的单元格估算占几行(自动换行要占更高的带,否则文字叠在一起) */
    public static int rowHeight(Block block, List<Map<String, ?>> flatRows) {
        int maxLines = 1;
        for (Map<String, ?> row : flatRows) {
            for (int i = 0; i < block.cols().size(); i++) {
                String s = text(row.get("C" + (i + 1)));
                int usable = Math.max(6, block.widths().get(i) / 5 - 1);
                maxLines = Math.max(maxLines, (int) Math.ceil(displayWidth(s) / (double) usable));
            }
        }
        return Math.min(MAX_ROW_HEIGHT, ROW_HEIGHT * Math.max(1, maxLines));
    }

    /** 表头标签:截到 9 个显示宽度单位(长标签把列撑宽不值得) */
    public static String headerLabel(String label) {
        return clip(label, 9);
    }

    /**
     * 单元格文本:统一成字符串再下发 ——
     * 动态列没有 per-column pattern,在这里定型才不会出现「2026-09-08 00:00:00.0」。
     */
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
        return s.length() > 4000 ? s.substring(0, 4000) : s;
    }

    // ============================================================ 编译

    /** 明细子报表:按「面板 + 列签名 + 块」编译一次 */
    public static JasperReport detailSubreport(String cacheKey, List<Col> cols, Block block) {
        return SUB_CACHE.computeIfAbsent(cacheKey, k -> compileDetail(cols, block));
    }

    /** 主报表(骨架 + 每块一条 detail 带):块结构不同 → 不同版式,按签名分开缓存 */
    public static JasperReport masterReport(String layoutKey, int blockCount) {
        return MASTER_CACHE.computeIfAbsent("generic-master|" + layoutKey + "|" + blockCount,
                k -> compileMaster(blockCount));
    }

    // ============================================================ 列宽

    /** 试排 [from, from+n) 列;放不下返回 null(调用方缩一块) */
    private static List<Integer> pickWidths(List<Col> cols, int from, int n) {
        int avail = TABLE_WIDTH - SEQ_WIDTH - COL_GAP * n;
        double sum = 0;
        double[] w = new double[n];
        for (int i = 0; i < n; i++) {
            w[i] = weight(cols.get(from + i));
            sum += w[i];
        }
        List<Integer> out = new ArrayList<>(n);
        int used = 0;
        for (int i = 0; i < n; i++) {
            int px = (int) Math.round(avail * w[i] / sum);
            if (px < MIN_COL) return null;
            int cw = Math.min(px, MAX_COL);
            out.add(cw + COL_GAP);
            used += cw + COL_GAP;
        }
        return used <= TABLE_WIDTH - SEQ_WIDTH ? out : null;
    }

    /** 列宽权重:标题显示宽度 + 典型数值宽度(上限 11 个宽度单位,长备注列不独占一页) */
    private static double weight(Col c) {
        return Math.max(3.2, Math.min(11, displayWidth(c.label()) * 0.85 + 1.4));
    }

    private static boolean isNumeric(String dataType) {
        String t = dataType == null ? "" : dataType.trim();
        return t.contains("小数") || t.contains("整数") || t.contains("数量")
                || t.contains("金额") || t.contains("单价") || t.contains("比率") || t.contains("税率");
    }

    private static boolean isCentered(String dataType) {
        String t = dataType == null ? "" : dataType.trim();
        return isNumeric(t) || t.contains("日期") || t.contains("下拉") || t.contains("状态")
                || t.contains("单位") || t.contains("是否");
    }

    private static int displayWidth(String s) {
        if (s == null) return 0;
        int w = 0;
        for (int i = 0; i < s.length(); i++) w += s.charAt(i) > 0x2E80 ? 2 : 1;
        return w;
    }

    private static String clip(String s, int maxUnits) {
        if (s == null) return "";
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

    // ============================================================ 生成:明细子报表

    /**
     * 明细子报表版式(列宽/列名在这一刻定死 —— XSD 不允许运行期表达式):
     *   columnHeader = 序号 + 各列名(浅灰底 + 边框,数字列右对齐、日期/状态居中)
     *   detail       = 行内序号 + 各列值(长文本自动换行撑高)
     *   summary      = 「明细共 N 行 · M 列」/「（本单据无明细数据）」
     */
    private static JasperReport compileDetail(List<Col> cols, Block block) {
        StringBuilder fields = new StringBuilder();
        fields.append("  <field name=\"SEQ\" class=\"java.lang.Integer\"/>\n");
        for (int i = 0; i < block.cols().size(); i++) {
            fields.append("  <field name=\"C").append(i + 1).append("\" class=\"java.lang.String\"/>\n");
        }

        StringBuilder head = new StringBuilder();
        StringBuilder row = new StringBuilder();
        head.append(staticText("序号", 0, SEQ_WIDTH, "thC"));
        row.append(textField("cellC", 0, SEQ_WIDTH, "$F{SEQ}"));
        int x = SEQ_WIDTH;
        for (int i = 0; i < block.cols().size(); i++) {
            Col c = cols.get(block.cols().get(i));
            boolean num = isNumeric(c.dataType());
            boolean cen = isCentered(c.dataType());
            head.append(staticText(headerLabel(c.label()), x, block.widths().get(i), num ? "thR" : (cen ? "thC" : "thL")));
            row.append(textField(num ? "cellR" : (cen ? "cellC" : "cellL"), x, block.widths().get(i),
                    "$F{C" + (i + 1) + "}"));
            x += block.widths().get(i);
        }

        String xml = """
<?xml version="1.0" encoding="UTF-8"?>
<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"
  name="%s" language="java" columnCount="1"
  pageWidth="%d" pageHeight="842" orientation="Portrait"
  columnWidth="%d" leftMargin="0" rightMargin="0" topMargin="0" bottomMargin="0"
  whenNoDataType="NoDataSection">
  <property name="net.sf.jasperreports.awt.ignore.missing.font" value="false"/>
  <property name="net.sf.jasperreports.default.font.name" value="%s"/>
  <property name="net.sf.jasperreports.export.xlsx.detect.cell.type" value="true"/>
%s
  <parameter name="明细行数" class="java.lang.Integer" isForPrompting="false"/>
  <parameter name="明细列数" class="java.lang.Integer" isForPrompting="false"/>
  <parameter name="行高" class="java.lang.Integer" isForPrompting="false"/>
%s
  <columnHeader>
    <band height="%d">
%s    </band>
  </columnHeader>
  <detail>
    <band height="%d">
%s    </band>
  </detail>
  <summary>
    <band height="15">
      <textField isBlankWhenNull="true">
        <reportElement style="note" x="0" y="0" width="%d" height="15"/>
        <textFieldExpression><![CDATA[$P{明细行数} == 0 ? "（本单据无明细数据）" : "明细共 " + $P{明细行数} + " 行 · " + $P{明细列数} + " 列"]]></textFieldExpression>
      </textField>
    </band>
  </summary>
</jasperReport>
""".formatted(SUBREPORT_NAME, TABLE_WIDTH, TABLE_WIDTH, FONT,
                styles(), fields, TABLE_HEAD_HEIGHT, head, ROW_HEIGHT, row, TABLE_WIDTH);
        try {
            return JasperCompileManager.compileReport(
                    new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (JRException e) {
            throw new IllegalStateException("通用报表明细表编译失败：" + e.getMessage(), e);
        }
    }

    private static String staticText(String text, int x, int w, String style) {
        return """
      <staticText>
        <reportElement style="%s" x="%d" y="0" width="%d" height="%d"/>
        <text><![CDATA[%s]]></text>
      </staticText>
""".formatted(style, x, w, TABLE_HEAD_HEIGHT, text);
    }

    private static String textField(String style, int x, int w, String expression) {
        // ⚠ height 只能整数常量(JR XSD 的 NMTOKEN 限制,$P{行高} 会被拒);
        //   长文本换行由 isStretchWithOverflow 撑高,行高不再走参数。
        return """
      <textField isBlankWhenNull="true" isStretchWithOverflow="true">
        <reportElement style="%s" x="%d" y="0" width="%d" height="%d"/>
        <textFieldExpression><![CDATA[%s]]></textFieldExpression>
      </textField>
""".formatted(style, x, w, ROW_HEIGHT, expression);
    }

    // ============================================================ 生成:主报表(骨架 + 每块一条带)

    /**
     * 主报表 = report-generic.jrxml 正文(保留 <style>/参数/页眉/页脚)+ 每个列块一条 detail 带。
     * 带里子报表的数据源 = $F{块数据}(主数据源每行 = 一个列块),块数 = 带数 = 主数据源行数;
     * 每块一份子报表版式(列宽不同),故参数是 子报表0 / 子报表1 …,带 i 引用 $P{子报表i}。
     * 明细 0 行时块数为 0 → 没有 detail 带 → 主数据源不传行 → 页面只出页眉(头字段),不出空表。
     */
    private static JasperReport compileMaster(int blockCount) {
        String base = readBase();
        int cut = base.indexOf("<pageFooter>");
        if (cut < 0) throw new IllegalStateException("通用报表基础版式缺少 <pageFooter>：" + MASTER_FILE);
        // 基础版式已声明「子报表」参数与 块数据/块标识/行高 三个字段(见 report-generic.jrxml);
        // 多块时补 子报表1..n-1 参数。⚠ XSD 内容模型:<parameter> 必须全部在 <field> 之前,
        // 所以锚在「块数据」字段声明前插入,不能挪到 <pageHeader> 前(那里已是 field 之后)。
        StringBuilder params = new StringBuilder();
        for (int i = 0; i < blockCount; i++) {
            if (i > 0) {
                params.append("  <parameter name=\"子报表").append(i)
                        .append("\" class=\"java.lang.Object\" isForPrompting=\"false\"/>\n");
            }
        }
        String head;
        String tail;
        int pcut = base.indexOf("<pageFooter>");
        tail = base.substring(pcut);
        if (params.length() > 0) {
            String anchor = "<field name=\"块数据\"";
            int fcut = base.indexOf(anchor);
            if (fcut < 0) throw new IllegalStateException("通用报表基础版式缺少 块数据 字段声明：" + MASTER_FILE);
            // ⚠ 第二段必须截到 pageFooter 为止——substring(fcut) 到文件尾会把 pageFooter+</jasperReport>
            //   卷进 head,后面 bands+tail 再拼一遍就成了「根元素后出现标记」。
            head = base.substring(0, fcut) + params + base.substring(fcut, pcut);
        } else {
            head = base.substring(0, pcut);
        }

        StringBuilder bands = new StringBuilder("  <detail>\n");
        for (int i = 0; i < blockCount; i++) {
            bands.append("""
    <band height="%d">
      <subreport>
        <reportElement x="0" y="%d" width="%d" height="%d"/>
        <subreportParameter name="行高">
          <subreportParameterExpression><![CDATA[$F{行高}]]></subreportParameterExpression>
        </subreportParameter>
        <dataSourceExpression><![CDATA[$F{块数据}]]></dataSourceExpression>
        <subreportExpression class="net.sf.jasperreports.engine.JasperReport"><![CDATA[(net.sf.jasperreports.engine.JasperReport) $P{子报表%s}]]></subreportExpression>
      </subreport>
    </band>
""".formatted(CAPTION_HEIGHT + SUBREPORT_MIN_HEIGHT + 2, CAPTION_HEIGHT + 2, TABLE_WIDTH,
                    SUBREPORT_MIN_HEIGHT, i == 0 ? "" : String.valueOf(i)));
        }
        bands.append("  </detail>\n");

        try {
            return JasperCompileManager.compileReport(new ByteArrayInputStream(
                    (head + bands + tail).getBytes(StandardCharsets.UTF_8)));
        } catch (JRException e) {
            throw new IllegalStateException("通用报表主版式编译失败：" + e.getMessage(), e);
        }
    }

    /** 基础版式正文(每次调用读一次;编译结果有缓存,不构成热点) */
    private static String readBase() {
        ClassPathResource res = new ClassPathResource(MASTER_FILE);
        try (InputStream in = res.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("通用报表基础版式读不到：" + MASTER_FILE, e);
        }
    }

    /** 基础版式的 <style> 段 + 明细表补充样式(表头 thL/thC/thR、表体 cellL/cellC/cellR、表尾 note) */
    private static String styles() {
        String cached = styleBlock;
        if (cached != null) return cached;
        StringBuilder sb = new StringBuilder();
        Matcher m = STYLE_TAG.matcher(readBase());
        while (m.find()) {
            sb.append("  ").append(m.group().trim()).append('\n');
        }
        if (sb.length() == 0) throw new IllegalStateException("通用报表基础版式里没有 <style>：" + MASTER_FILE);
        sb.append("""
  <style name="thC" style="base" isBold="true" hAlign="Center" vAlign="Middle" mode="Opaque" backcolor="#EFEFEF">
    <box padding="2"><pen lineWidth="0.5" lineColor="#8A8A8A"/></box>
  </style>
  <style name="thL" style="thC" hAlign="Left"/>
  <style name="thR" style="thC" hAlign="Right"/>
  <style name="cellL" style="base" hAlign="Left" vAlign="Middle">
    <box padding="2"><pen lineWidth="0.5" lineColor="#8A8A8A"/></box>
  </style>
  <style name="cellC" style="cellL" hAlign="Center"/>
  <style name="cellR" style="cellL" hAlign="Right"/>
  <style name="note" style="base" fontSize="8.5" vAlign="Middle"/>
""");
        styleBlock = sb.toString();
        return styleBlock;
    }
}
