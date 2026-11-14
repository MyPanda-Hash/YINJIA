/*
 * _FirstInspReportSmoke.java —— 首件检验记录表「纸面黄格」口径（2026-11-15 第十一轮）的**离线冒烟**：
 * 不启动后端、不碰库，直接跑「假明细 → matrix() → 生成 → 编译 → 填充 → 导出 PDF/xlsx → 逐格断言」。
 *
 * 为什么要有它：`QcFirstInspReportSupport` 是"按数据生成 JRXML 再编译"的写法，生成的 XML/样式
 * 一旦不合法，要到「导出报表」点下去才会炸（而且要走一次打包重启）。这里秒级拿到真错误。
 *
 * 断言口径唯一真源 = `docs/design/首件检验单-可填范围.md` §一：
 *   10 列 × 8 行 ⇒ 可填格 **20 个**（黄底 #FFF3CA）、`/` 占位格 **60 个**（白底）；
 *   表观/脱粉 1#/2#、外径/内径/长度/重量 3#/4#、跌落+挤压强度 5#/6#、压降+浊度 7#/8#；
 *   认不出列名的新增列 → 分组兜底（表观及脱粉 1#/2#、尺寸及重量 3#/4#、强度 5#/6#、
 *   浊度及压降 7#/8#、未知组 7#/8#）；标准行表观/脱粉两格灰底 #D9D9D9。
 *
 * 用法（⚠ 在**仓库根**执行；JDK 必须 25 —— backend/pom.xml 的 maven.compiler.release=25，
 *       本机会话默认 JAVA_HOME=openjdk-23 会报「不支持发行版本 25」，故这里显式钉 ms-25.0.4）：
 *
 *   JAVA='C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
 *   CP="backend/target/classes;$(tr '\n' ';' < backend/target/cp.txt)"
 *   "$JAVA" -Dstdout.encoding=UTF-8 -cp "$CP" \
 *       tools/archive/_first-insp-report-20261114/_FirstInspReportSmoke.java
 *
 * 产物（同目录）：_first-insp-report-yellow.pdf / _first-insp-report-yellow.xlsx
 * ⚠ 单文件源码启动会在**源码旁边**留 .class —— 仓库 .gitignore 已挡（tools/archive/_*.class）。
 */
import com.yinjia.mes.service.QcFirstInspReportSupport;
import net.sf.jasperreports.engine.JRPrintElement;
import net.sf.jasperreports.engine.JRPrintPage;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import net.sf.jasperreports.engine.export.ooxml.JRXlsxExporter;
import net.sf.jasperreports.export.SimpleExporterInput;
import net.sf.jasperreports.export.SimpleOutputStreamExporterOutput;
import net.sf.jasperreports.export.SimpleXlsxReportConfiguration;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.InflaterInputStream;

public class _FirstInspReportSmoke {

    /**
     * 图纸上的 10 个测试项目：{数据键, 列名, 项目分组} ——
     * 与 `FirstInspItems.DEFS` / `frontend/src/core/qc/firstInspCols.js` 的 DEFAULT_TEST_ITEMS 同源。
     */
    private static final String[][] DEFS = {
            {"appearance", "炭棒表观状态", "表观及脱粉"},
            {"depowder", "炭棒脱粉情况", "表观及脱粉"},
            {"outer", "炭棒外径", "尺寸及重量"},
            {"inner", "炭棒内径", "尺寸及重量"},
            {"length", "炭棒长度", "尺寸及重量"},
            {"weight", "炭棒重量", "尺寸及重量"},
            {"drop", "跌落", "强度"},
            {"compress", "挤压强度", "强度"},
            {"turbidity", "浊度NTU", "浊度及压降"},
            {"pressure", "压降kPa", "浊度及压降"}};

    /** 标准行取值（外观/脱粉/浊度纸面就是 `/`；其余来自《成型工艺清单》，此处照 FirstInspItems 的拼法） */
    private static final Map<String, String> STANDARDS = new LinkedHashMap<>();
    static {
        STANDARDS.put("appearance", "/");
        STANDARDS.put("depowder", "/");
        STANDARDS.put("outer", "");
        STANDARDS.put("inner", "");
        STANDARDS.put("length", "");
        STANDARDS.put("weight", "");
        STANDARDS.put("drop", "跌落高度: 10cm;跌落次数: 10次;跌落要求: 10");
        STANDARDS.put("compress", "测试间距: 10mm;压头下降速度: 10mm/min;强度要求: 10");
        STANDARDS.put("turbidity", "/");
        STANDARDS.put("pressure", "压降标准: 10kPa;是否测试: √");
    }

    /** 契约矩阵（`首件检验单-可填范围.md` §一）：每列可填的样品行，顺序同 {@link #DEFS} */
    private static final int[][] EXPECT_ROWS = {
            {1, 2}, {1, 2},                   // 炭棒表观状态 / 炭棒脱粉情况
            {3, 4}, {3, 4}, {3, 4}, {3, 4},   // 外径 / 内径 / 长度 / 重量
            {5, 6},                           // 跌落
            {5, 6},                           // 挤压强度（2026-11-15 起与跌落同一对）
            {7, 8}, {7, 8}};                  // 浊度NTU / 压降kPa

    /** 契约合计：10 列 × 8 行 ⇒ 可填 20 格、`/` 60 格 */
    private static final int EXPECT_FILLABLE = 20;
    private static final int EXPECT_BLANK = 60;
    /** 样品行高（`QcFirstInspReportSupport.SAMPLE_ROW_H`，布局契约；灰格底边 = 标准行底） */
    private static final int SAMPLE_ROW_H = 20;
    /** 纸面两色 */
    private static final Color YELLOW = new Color(0xFF, 0xF3, 0xCA);
    private static final Color GRAY = new Color(0xD9, 0xD9, 0xD9);

    /** 「认不出列名的新增列 / 列名变体」用例：{列名, 项目分组, 期望可填行} */
    private static final String[][] FALLBACKS = {
            // ① 列名变体：按列名认，不看分组
            {"炭粉情况", "表观及脱粉", "1,2"},
            {"跌落强度", "尺寸及重量", "5,6"},     // 显式列名优先于分组兜底
            {"抗压强度", "强度", "5,6"},           // 2026-11-15 起与跌落同一对（强度组两支样品）
            {"压缩kPa", "强度", "7,8"},            // 压降(压缩) 组
            // ② 认不出列名 ⇒ 按项目分组兜底
            {"自定义项目A", "表观及脱粉", "1,2"},
            {"自定义项目B", "尺寸及重量", "3,4"},
            {"自定义项目C", "强度", "5,6"},
            {"自定义项目D", "浊度及压降", "7,8"},
            {"自定义项目E", "未分组XYZ", "7,8"}};

    private static int pass = 0;
    private static final List<String> fails = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        File outDir = new File("tools/archive/_first-insp-report-20261114");
        if (!outDir.isDirectory() && !outDir.mkdirs()) throw new IllegalStateException("建不了输出目录：" + outDir);

        // =============================================================== ① 假明细（10 列 × 8 行）
        List<Map<String, ?>> rows = new ArrayList<>();
        int no = 0;
        for (String[] d : DEFS) {
            rows.add(row("标准", "标准", d[0], d[1], d[2], STANDARDS.getOrDefault(d[0], ""), ++no));
            for (int s = 1; s <= 8; s++) rows.add(row("样品", s + "#", d[0], d[1], d[2], "", ++no));
        }
        // 可填格里落值：每组一对里各落一个，核「值确实进了矩阵、只落在本列那一对行上」
        put(rows, "appearance", "2#", "无粘模（均匀）");
        put(rows, "outer", "4#", "34.2");
        put(rows, "drop", "6#", "5");
        put(rows, "compress", "5#", "155");
        put(rows, "turbidity", "8#", "1.2");
        put(rows, "pressure", "8#", "1.1");
        // 历史遗留值落在**本轮不可填**的格子（第九轮"八行全开"时可能录过）：报表按纸面写 `/`
        put(rows, "outer", "5#", "99.9");
        put(rows, "appearance", "5#", "严重粘模");

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("产品编码", "T042");
        head.put("规格型号", "28*12*180");
        head.put("生产日期", "2026-11-14");
        head.put("生产线", "1号机");
        head.put("总结论", "合格");
        head.put("检验员", "admin");
        head.put("审核人", "qc01");
        head.put("审批人", "supervisor");

        System.out.println("==== ① 矩阵（10 列 × 8 行）====");
        QcFirstInspReportSupport.Matrix m = QcFirstInspReportSupport.matrix(rows, head);
        System.out.println(QcFirstInspReportSupport.describe(m));
        System.out.println();

        // ---- 结构：10 列 / 4 组（顺序与每组的列数）----
        eq("列数", 10, m.colCount());
        eq("组数", 4, m.groups().size());
        String[] groupNames = {"表观及脱粉", "尺寸及重量", "强度", "浊度及压降"};
        int[] groupCols = {2, 4, 2, 2};
        for (int i = 0; i < groupNames.length; i++) {
            if (i >= m.groups().size()) {
                fail("分组[" + (i + 1) + "] 缺失（期望 " + groupNames[i] + "）");
                continue;
            }
            eq("分组[" + (i + 1) + "] 名称", groupNames[i], m.groups().get(i).name());
            eq("分组[" + groupNames[i] + "] 列数", groupCols[i], m.groups().get(i).cols().size());
        }

        // ---- 逐列：列身份 + 可填样品行 = 契约 ----
        List<QcFirstInspReportSupport.Col> cols = m.flatCols();
        eq("展平列数", 10, cols.size());
        int fillable = 0;
        int blank = 0;
        for (int c = 0; c < Math.min(cols.size(), DEFS.length); c++) {
            QcFirstInspReportSupport.Col col = cols.get(c);
            eq("列[" + (c + 1) + "] 数据键", DEFS[c][0], col.key());
            eq("列[" + (c + 1) + "] 列名", DEFS[c][1], col.label());
            eq("列[" + (c + 1) + "] 分组", DEFS[c][2], col.group());
            List<String> cells = col.cells();
            eq("列[" + (c + 1) + "] 样品格数", 8, cells.size());
            List<Integer> gotRows = new ArrayList<>();
            for (int s = 1; s <= 8; s++) {
                String v = cells.get(s - 1);
                if ("/".equals(v)) blank++;
                else {
                    fillable++;
                    gotRows.add(s);
                }
            }
            check("列[" + (c + 1) + "] " + DEFS[c][1] + " 可填行 = " + gotRows, rowsEq(EXPECT_ROWS[c], gotRows));
        }
        eq("可填样品格总数", EXPECT_FILLABLE, fillable);
        eq("`/` 占位格总数", EXPECT_BLANK, blank);

        // ---- 值落点：只落在本列那一对行上 ----
        eq("appearance 2# 实测值", "无粘模（均匀）", cellValue(m, "appearance", 2));
        eq("outer 4# 实测值", "34.2", cellValue(m, "outer", 4));
        eq("drop 6# 实测值", "5", cellValue(m, "drop", 6));
        eq("compress 5# 实测值", "155", cellValue(m, "compress", 5));
        eq("turbidity 8# 实测值", "1.2", cellValue(m, "turbidity", 8));
        eq("pressure 8# 实测值", "1.1", cellValue(m, "pressure", 8));
        // 不可填格上的历史值：按纸面写 `/`（数据不删，库里/面板原样只读）
        eq("outer 5#（本轮不可填）纸面占位", "/", cellValue(m, "outer", 5));
        eq("appearance 5#（本轮不可填）纸面占位", "/", cellValue(m, "appearance", 5));

        // ---- 认不出列名的新增列：分组兜底 ----
        System.out.println("\n==== ② 新增列 / 列名变体（按列名认 + 分组兜底）====");
        for (String[] fb : FALLBACKS) {
            QcFirstInspReportSupport.Matrix one = oneCol(fb[0], fb[1]);
            List<Integer> want = new ArrayList<>();
            for (String s : fb[2].split(",")) want.add(Integer.parseInt(s.trim()));
            List<Integer> got = fillRowsOf(one).isEmpty() ? List.of() : fillRowsOf(one).get(0);
            check("列名=" + fb[0] + " 分组=" + fb[1] + " 可填行=" + got, want.equals(got));
        }

        // =============================================================== ③ 生成 → 编译（缓存）
        System.out.println("\n==== ③ 生成 → 编译 ====");
        long t0 = System.currentTimeMillis();
        JasperReport report = QcFirstInspReportSupport.report(m);
        System.out.println("  编译耗时 " + (System.currentTimeMillis() - t0) + "ms");
        eq("pageWidth", 842, report.getPageWidth());
        eq("pageHeight", 595, report.getPageHeight());
        eq("columnWidth", 782, report.getColumnWidth());
        check("同矩阵二次取命中编译缓存", QcFirstInspReportSupport.report(m) == report);

        // =============================================================== ④ 填充 + 底色取证
        System.out.println("\n==== ④ 填充 + 黄格/灰格底色取证（JasperPrint 元素 backcolor）====");
        JasperPrint print = JasperFillManager.fillReport(report,
                QcFirstInspReportSupport.params(m, head),
                new JRMapCollectionDataSource(QcFirstInspReportSupport.dataRows()));
        eq("PDF 页数", 1, print.getPages().size());

        int yellow = 0;
        int gray = 0;
        int bandTop = -1;
        int stdH = -1;
        List<JRPrintElement> yellows = new ArrayList<>();
        for (JRPrintPage page : print.getPages()) {
            for (JRPrintElement e : page.getElements()) {
                Color bg = e.getBackcolor();
                if (YELLOW.equals(bg)) {
                    yellow++;
                    yellows.add(e);
                } else if (GRAY.equals(bg)) {
                    gray++;
                    if (bandTop < 0) {
                        bandTop = e.getY();
                        stdH = e.getHeight();
                    } else {
                        check("标准行两灰格 y/height 一致",
                                bandTop == e.getY() && stdH == e.getHeight());
                    }
                }
            }
        }
        eq("黄格数（#FFF3CA）", EXPECT_FILLABLE, yellow);
        eq("灰格数（#D9D9D9，标准行表观/脱粉）", 2, gray);
        check("标准行灰格高度 > 0（取到标准行高）", stdH > 0);

        // 黄格几何：x 归列（列序 = x 升序）、y 归样品行（标准行底 + (s-1)*行高）
        List<Integer> xs = new ArrayList<>();
        for (JRPrintElement e : yellows) if (!xs.contains(e.getX())) xs.add(e.getX());
        xs.sort(Integer::compareTo);
        eq("黄格覆盖列数", 10, xs.size());
        Map<Integer, Set<Integer>> yellowRowsByCol = new LinkedHashMap<>();
        for (JRPrintElement e : yellows) {
            int c = xs.indexOf(e.getX());
            int rel = e.getY() - bandTop - stdH;
            check("黄格 y 落在样品行网格上（x=" + e.getX() + " y=" + e.getY() + "）",
                    rel >= 0 && rel % SAMPLE_ROW_H == 0);
            if (rel >= 0 && rel % SAMPLE_ROW_H == 0) {
                yellowRowsByCol.computeIfAbsent(c, k -> new LinkedHashSet<>()).add(rel / SAMPLE_ROW_H + 1);
            }
        }
        System.out.printf("  %-4s %-12s %-14s %-12s %s%n", "列", "列名", "分组", "矩阵可填行", "PDF 黄格行");
        for (int c = 0; c < Math.min(cols.size(), DEFS.length); c++) {
            List<Integer> got = new ArrayList<>(yellowRowsByCol.getOrDefault(c, Set.of()));
            List<Integer> want = new ArrayList<>();
            for (int s : EXPECT_ROWS[c]) want.add(s);
            check("列[" + (c + 1) + "] " + DEFS[c][1] + " PDF 黄格行 = " + got, want.equals(got));
            System.out.printf("  %-4d %-12s %-14s %-12s %s%n",
                    c + 1, DEFS[c][1], DEFS[c][2], want, got);
        }

        // =============================================================== ⑤ 导出 PDF
        System.out.println("\n==== ⑤ 导出 PDF（1 页 / A4 横向 842×595）====");
        File pdf = new File(outDir, "_first-insp-report-yellow.pdf");
        JasperExportManager.exportReportToPdfFile(print, pdf.getPath());
        check("PDF 文件非空（>10KB）", pdf.isFile() && pdf.length() > 10_000);
        System.out.println("  " + pdf.getPath() + " " + pdf.length() + " bytes");
        String pdfText = new String(Files.readAllBytes(pdf.toPath()), StandardCharsets.ISO_8859_1);
        Matcher mb = Pattern.compile("/MediaBox\\s*\\[\\s*(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\]")
                .matcher(pdfText);
        if (mb.find()) {
            eq("PDF MediaBox 宽", "842.0", Double.toString(Double.parseDouble(mb.group(3))));
            eq("PDF MediaBox 高", "595.0", Double.toString(Double.parseDouble(mb.group(4))));
        } else {
            fail("PDF 里找不到 /MediaBox");
        }
        eq("PDF 页对象数（/Type/Page）", 1, countPdfPages(pdfText));

        // 黄底/灰底是否真的被印进 PDF：正式导出的页面内容流是 FlateDecode 压缩的（直接搜字节搜不到），
        // 故先把 PDF 里各压缩流解压出来，再数填充色算子（`1 0.95294 0.79216 rg` = #FFF3CA、
        // `0.85098 0.85098 0.85098 rg` = #D9D9D9）。解压逻辑见 pdfFlateStreamsText。
        String colorPdf = pdfFlateStreamsText(Files.readAllBytes(pdf.toPath()));
        String yellowOp = pdfColorOp(YELLOW);
        String grayOp = pdfColorOp(GRAY);
        System.out.println("  颜色算子（PDF 解压后内容流）：黄=\"" + yellowOp + "\" 灰=\"" + grayOp + "\"");
        eq("PDF 黄底填充次数 " + yellowOp, EXPECT_FILLABLE, countOf(colorPdf, yellowOp));
        eq("PDF 灰底填充次数 " + grayOp, 2, countOf(colorPdf, grayOp));

        // =============================================================== ⑥ 导出 xlsx
        System.out.println("\n==== ⑥ 导出 xlsx ====");
        File xlsx = new File(outDir, "_first-insp-report-yellow.xlsx");
        SimpleXlsxReportConfiguration cfg = new SimpleXlsxReportConfiguration();
        cfg.setDetectCellType(true);
        cfg.setOnePagePerSheet(false);
        JRXlsxExporter x = new JRXlsxExporter();
        x.setExporterInput(new SimpleExporterInput(print));
        try (FileOutputStream fos = new FileOutputStream(xlsx)) {
            x.setExporterOutput(new SimpleOutputStreamExporterOutput(fos));
            x.setConfiguration(cfg);
            x.exportReport();
        }
        check("xlsx 文件非空（>1KB）", xlsx.isFile() && xlsx.length() > 1_000);
        System.out.println("  " + xlsx.getPath() + " " + xlsx.length() + " bytes");
        try (XSSFWorkbook wb = new XSSFWorkbook(new FileInputStream(xlsx))) {
            eq("xlsx sheet 名", "qc_first_insp", wb.getSheetName(0));
            int rowCount = wb.getSheetAt(0).getLastRowNum() + 1;
            check("xlsx 行数 >= 20（标题+两级表头+标准行+8 样品行+相关要求+表尾）", rowCount >= 20);
            System.out.println("  xlsx 行数 = " + rowCount);
            // 样品行（行标签 1#..8#）里的 `/` 必须恰好 60 个（每列 8 行里非可填的 6 格）——
            // 与「可填格 20 个」互补，是"导出产物"这一层对矩阵的直接复核。
            int sampleRows = 0;
            int sampleSlash = 0;
            for (Row r : wb.getSheetAt(0)) {
                boolean isSampleRow = false;
                for (Cell cell : r) {
                    if (cell.getCellType() == CellType.STRING
                            && cell.getStringCellValue().matches("[1-8]#")) {
                        isSampleRow = true;
                        break;
                    }
                }
                if (!isSampleRow) continue;
                sampleRows++;
                for (Cell cell : r) {
                    if (cell.getCellType() == CellType.STRING && "/".equals(cell.getStringCellValue())) {
                        sampleSlash++;
                    }
                }
            }
            eq("xlsx 样品行数", 8, sampleRows);
            eq("xlsx 样品行里的 `/` 单元格数", EXPECT_BLANK, sampleSlash);
        }

        // =============================================================== ⑦ 空明细（未铺列）不炸
        System.out.println("\n==== ⑦ 空明细（单子上还一列都没铺）不炸 ====");
        QcFirstInspReportSupport.Matrix empty = QcFirstInspReportSupport.matrix(List.of(), head);
        eq("空明细列数", 0, empty.colCount());
        check("空明细也能编译", QcFirstInspReportSupport.report(empty) != null);

        // =============================================================== 结果
        System.out.println();
        System.out.println("===== 冒烟结果：" + pass + " PASS / " + fails.size() + " FAIL =====");
        for (String f : fails) System.out.println("  [FAIL] " + f);
        if (!fails.isEmpty()) throw new IllegalStateException("冒烟失败 " + fails.size() + " 项");
        System.out.println("SMOKE OK");
    }

    // ================================================================ 小工具

    private static Map<String, Object> row(String type, String sample, String key, String label, String group,
                                           String std, int no) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("表区", "首件检验");
        r.put("行类型", type);
        r.put("样品序号", sample);
        r.put("检验列", key);
        r.put("检验项目", label);
        r.put("项目分组", group);
        r.put("标准", std);
        r.put("实测数值", "");
        r.put("结果判断", "");
        r.put("行号", no);
        return r;
    }

    @SuppressWarnings("unchecked")
    private static void put(List<Map<String, ?>> rows, String key, String sample, String v) {
        for (Map<String, ?> r : rows) {
            if (key.equals(r.get("检验列")) && sample.equals(r.get("样品序号"))) {
                ((Map<String, Object>) r).put("实测数值", v);
                return;
            }
        }
        throw new IllegalStateException("假明细里没有该格：" + key + " / " + sample);
    }

    /** 单列矩阵（新增列 / 列名变体用例：1 标准行 + 8 样品行） */
    private static QcFirstInspReportSupport.Matrix oneCol(String label, String group) {
        List<Map<String, ?>> rs = new ArrayList<>();
        rs.add(row("标准", "标准", label, label, group, "", 1));
        for (int s = 1; s <= 8; s++) rs.add(row("样品", s + "#", label, label, group, "", s + 1));
        return QcFirstInspReportSupport.matrix(rs, Map.of());
    }

    /** 从矩阵里反推每列"可填样品行"（可填格不是 `/`；空值 = 空格，与纸面一致） */
    private static List<List<Integer>> fillRowsOf(QcFirstInspReportSupport.Matrix m) {
        List<List<Integer>> out = new ArrayList<>();
        for (QcFirstInspReportSupport.Col c : m.flatCols()) {
            List<Integer> rs = new ArrayList<>();
            List<String> cells = c.cells();
            for (int s = 1; s <= cells.size(); s++) if (!"/".equals(cells.get(s - 1))) rs.add(s);
            out.add(rs);
        }
        return out;
    }

    private static String cellValue(QcFirstInspReportSupport.Matrix m, String key, int sample) {
        for (QcFirstInspReportSupport.Col c : m.flatCols()) {
            if (key.equals(c.key())) return c.cells().get(sample - 1);
        }
        throw new IllegalStateException("矩阵里没有该列：" + key);
    }

    private static boolean rowsEq(int[] want, List<Integer> got) {
        if (want.length != got.size()) return false;
        for (int i = 0; i < want.length; i++) if (want[i] != got.get(i)) return false;
        return true;
    }

    /** PDF 页对象数：`/Type/Page`（排除 `/Type/Pages`） */
    private static int countPdfPages(String pdfText) {
        Matcher m = Pattern.compile("/Type\\s*/Page\\b").matcher(pdfText);
        int n = 0;
        while (m.find()) n++;
        return n;
    }

    /** JR PDF 导出填充色算子（PDF 里是 `r g b rg`，每通道按 5 位小数四舍五入、去尾零，如 `1 0.95294 0.79216 rg`） */
    private static String pdfColorOp(Color c) {
        StringBuilder sb = new StringBuilder();
        for (int v : new int[]{c.getRed(), c.getGreen(), c.getBlue()}) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(BigDecimal.valueOf(v / 255.0).setScale(5, RoundingMode.HALF_UP)
                    .stripTrailingZeros().toPlainString());
        }
        return sb.append(" rg").toString();
    }

    private static int countOf(String hay, String needle) {
        int n = 0;
        for (int i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length())) n++;
        return n;
    }

    /**
     * 把 PDF 里所有 FlateDecode 流解压后拼成一段文本。
     * <p>JR 的 PDF 导出把每个流写成 `.../Length N>>stream\n&lt;压缩字节&gt;endstream`，按 `N` 精确取字节
     * 再 Inflate 即可（不用 PDF 解析库；非 Flate 的流 / 长度对不上的直接跳过）。</p>
     */
    private static String pdfFlateStreamsText(byte[] pdf) {
        String iso = new String(pdf, StandardCharsets.ISO_8859_1);
        Matcher m = Pattern.compile("/Length\\s+(\\d+)\\s*>>\\s*stream\\r?\\n").matcher(iso);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            int len;
            try {
                len = Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                continue;
            }
            int start = m.end();
            if (len <= 0 || start + len > pdf.length) continue;
            try (InflaterInputStream in = new InflaterInputStream(new ByteArrayInputStream(pdf, start, len))) {
                out.append(new String(in.readAllBytes(), StandardCharsets.ISO_8859_1));
            } catch (Exception ignore) {
                // 不是 Flate（或损坏）的流：跳过
            }
        }
        return out.toString();
    }

    private static void eq(String name, Object expect, Object got) {
        if (Objects.equals(String.valueOf(expect), String.valueOf(got))) {
            pass++;
            System.out.println("  [PASS] " + name + " = " + got);
        } else {
            fail(name + " 期望=" + expect + " 实际=" + got);
        }
    }

    private static void check(String name, boolean cond) {
        if (cond) {
            pass++;
            System.out.println("  [PASS] " + name);
        } else {
            fail(name);
        }
    }

    private static void fail(String msg) {
        fails.add(msg);
        System.out.println("  [FAIL] " + msg);
    }
}
