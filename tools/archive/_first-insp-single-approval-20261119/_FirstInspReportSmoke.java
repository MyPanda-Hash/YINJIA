/*
 * _FirstInspReportSmoke.java —— 首件检验记录表「去掉批准格 + 相关要求换十条」的**离线冒烟**
 * (2026-11-19 用户口径:截图红字「描述文字未修改」「没有二级审核,去掉批准流程」)。
 *
 * 不启动后端、不碰库:假明细 → matrix() → 生成 JRXML → 编译 → 填充 → 导出 PDF/xlsx → 逐项断言。
 * 为什么要有它:`QcFirstInspReportSupport` 是"按数据生成 JRXML 再编译"的写法,骨架 qc_first_insp.jrxml
 * 里任何一处 XML/坐标写错,都要到「导出报表」点下去才炸(而且要走一次打包重启)。这里秒级拿到真错误。
 *
 * 断言口径(唯一真源 = 面板 frontend/src/core/qc/QcFirstInspSheet.vue 的 REQUIREMENTS 常量 +
 * `docs/design/首件检验单-服务端报表模板.md`):
 *   ① 报表参数**没有** 审批人(批准格已删),仍有 审核人;
 *   ② summary 的静态文案 = 《相关要求》十条(逐字)+ 表尾三段 检验结果/检验人/审核人;
 *   ③ summary 里**任何**静态文案都不许再出现「批准」,文本域表达式不许再引用 $P{审批人};
 *   ④ 填充后仍是 **1 页**(十条比六条多 50pt,band 高 126 → 176,必须还在一页里);
 *   ⑤ 导出的 xlsx 里十条齐全、「批准」一个单元格都没有。
 *
 * 用法(⚠ 在**仓库根**执行;JDK 必须 25 —— backend/pom.xml 的 maven.compiler.release=25):
 *   cd backend && mvn -o -s ../tools/settings.xml -q -DskipTests compile
 *   cd backend && mvn -o -s ../tools/settings.xml -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
 *   cd .. && JAVA='C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
 *   CP="backend/target/classes;$(tr '\n' ';' < backend/target/cp.txt)"
 *   "$JAVA" -Dstdout.encoding=UTF-8 -cp "$CP" \
 *       tools/archive/_first-insp-single-approval-20261119/_FirstInspReportSmoke.java
 *
 * 产物(同目录):_first-insp-report-single.pdf / _first-insp-report-single.xlsx
 * ⚠ 单文件源码启动会在**源码旁边**留 .class —— 仓库 .gitignore 已挡(tools/archive/_*.class)。
 */
import com.yinjia.mes.service.QcFirstInspReportSupport;
import net.sf.jasperreports.engine.JRBand;
import net.sf.jasperreports.engine.JRChild;
import net.sf.jasperreports.engine.JRStaticText;
import net.sf.jasperreports.engine.JRTextField;
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

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class _FirstInspReportSmoke {

    /** 受控表单原文十条 —— 与面板 REQUIREMENTS 常量逐字一致(改一处必须同步另一处) */
    private static final String[] REQUIREMENTS = {
            "1. 首件在脱模时取前2架模具内炭棒8支测试数据，并进行判定。",
            "2. 测试判定标准依据工艺管控清单。",
            "3. 表观及脱粉8支全检，记录2支数据。",
            "4. 尺寸及重量8支全检，取炭棒最长和最短的记录数据。",
            "5. 跌落强度测试2支，抗压强度工序单有要求才测，没有要求则只测跌落强度。",
            "6. 压降测试：依照工艺管控清单，明确测试方法并要求测试压降的才进行测试。",
            "7. 所有测试均按照检测设备的实际读数进行记录数据。",
            "8. 炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）",
            "9. 测试样品需保留至本班次生产完成。",
            "10. C-95客户相关产品脱模后立马进行首件检验，压降测试数据需要在3个小时内出结果，合格后方可进行生产作业。",
    };

    /** 图纸上的 10 个测试项目:{数据键, 列名, 项目分组} —— 与 FirstInspItems.DEFS / firstInspCols.js 同源 */
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

    private static final Map<String, String> STANDARDS = new LinkedHashMap<>();
    static {
        STANDARDS.put("appearance", "/");
        STANDARDS.put("depowder", "/");
        STANDARDS.put("turbidity", "/");
        STANDARDS.put("drop", "跌落高度: 10cm;跌落次数: 10次;跌落要求: 10");
        STANDARDS.put("compress", "测试间距: 10mm;压头下降速度: 10mm/min;强度要求: 10");
        STANDARDS.put("pressure", "压降标准: 10kPa;是否测试: √");
    }

    private static int pass = 0;
    private static final List<String> fails = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        File outDir = new File("tools/archive/_first-insp-single-approval-20261119");
        if (!outDir.isDirectory() && !outDir.mkdirs()) throw new IllegalStateException("建不了输出目录：" + outDir);

        // =============================================================== ① 假明细(10 列 × 8 行)
        List<Map<String, ?>> rows = new ArrayList<>();
        int no = 0;
        for (String[] d : DEFS) {
            rows.add(row("标准", "标准", d[0], d[1], d[2], STANDARDS.getOrDefault(d[0], ""), ++no));
            for (int s = 1; s <= 8; s++) rows.add(row("样品", s + "#", d[0], d[1], d[2], "", ++no));
        }
        put(rows, "appearance", "2#", "无粘模（均匀）");
        put(rows, "outer", "4#", "34.2");
        put(rows, "drop", "6#", "5");
        put(rows, "compress", "5#", "155");

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("产品编码", "T042");
        head.put("规格型号", "28*12*180");
        head.put("生产日期", "2026-11-19");
        head.put("生产线", "2号车间");
        head.put("总结论", "合格");
        head.put("检验员", "程志");
        head.put("审核人", "冯敏");
        // 故意给「审批人」:单级审批下这一格**不该**被模板引用
        head.put("审批人", "系统管理员");

        QcFirstInspReportSupport.Matrix m = QcFirstInspReportSupport.matrix(rows, head);
        System.out.println("==== ① 矩阵 ====");
        System.out.println(QcFirstInspReportSupport.describe(m));
        eq("列数", 10, m.colCount());

        // =============================================================== ② 生成 → 编译
        System.out.println("\n==== ② 生成 → 编译 ====");
        JasperReport report = QcFirstInspReportSupport.report(m);
        eq("pageWidth", 842, report.getPageWidth());
        eq("pageHeight", 595, report.getPageHeight());
        eq("columnWidth", 782, report.getColumnWidth());

        // ---- 参数:没有「审批人」,仍有「审核人」 ----
        Set<String> params = new LinkedHashSet<>();
        for (net.sf.jasperreports.engine.JRParameter p : report.getParameters()) params.add(p.getName());
        System.out.println("  参数 = " + params);
        check("参数里有「审核人」", params.contains("审核人"));
        check("参数里**没有**「审批人」(批准格已删)", !params.contains("审批人"));

        // ---- summary 静态文案 / 文本域表达式 ----
        JRBand summary = report.getSummary();
        check("有 summary 段", summary != null);
        List<String> statics = new ArrayList<>();
        List<String> exprs = new ArrayList<>();
        if (summary != null) {
            for (JRChild ch : summary.getChildren()) {
                if (ch instanceof JRStaticText t) statics.add(t.getText() == null ? "" : t.getText());
                else if (ch instanceof JRTextField t && t.getExpression() != null) exprs.add(t.getExpression().getText());
            }
        }
        System.out.println("  summary 静态文案 " + statics.size() + " 条 / 文本域 " + exprs.size() + " 条");

        // ① 十条逐字都在(顺序也一致)
        for (String r : REQUIREMENTS) check("summary 含《相关要求》「" + r.substring(0, Math.min(14, r.length())) + "…」", statics.contains(r));
        int reqCount = 0;
        for (String s : statics) if (s.matches("^\\d+\\. .*")) reqCount++;
        eq("summary 里编号要求条数", REQUIREMENTS.length, reqCount);
        check("summary 含「相关要求：」", statics.contains("相关要求："));

        // ② 表尾三段:检验结果 / 检验人 / 审核人
        for (String label : new String[]{"检验结果", "检验人", "审核人"}) {
            check("summary 表尾含「" + label + "」", statics.contains(label));
        }
        // ③ 批准必须彻底消失(静态文案 + 文本域表达式两条路都查)
        check("summary 静态文案里没有「批准」", statics.stream().noneMatch(s -> s.contains("批准")));
        check("summary 文本域里没有 $P{审批人}", exprs.stream().noneMatch(e -> e.contains("审批人")));
        check("summary 文本域里有 $P{审核人}", exprs.stream().anyMatch(e -> e.contains("$P{审核人}")));
        check("summary 文本域里有 $P{总结论}/$P{检验员}",
                exprs.stream().anyMatch(e -> e.contains("$P{总结论}")) && exprs.stream().anyMatch(e -> e.contains("$P{检验员}")));

        // =============================================================== ③ 填充 → 必须仍是 1 页
        System.out.println("\n==== ③ 填充(十条不许把纸撑到第二页) ====");
        JasperPrint print = JasperFillManager.fillReport(report,
                QcFirstInspReportSupport.params(m, head),
                new JRMapCollectionDataSource(QcFirstInspReportSupport.dataRows()));
        eq("PDF 页数", 1, print.getPages().size());

        // =============================================================== ④ 导出 PDF/xlsx
        System.out.println("\n==== ④ 导出 PDF / xlsx ====");
        File pdf = new File(outDir, "_first-insp-report-single.pdf");
        JasperExportManager.exportReportToPdfFile(print, pdf.getPath());
        check("PDF 文件非空(>10KB)", pdf.isFile() && pdf.length() > 10_000);
        System.out.println("  " + pdf.getPath() + " " + pdf.length() + " bytes");
        String pdfText = new String(java.nio.file.Files.readAllBytes(pdf.toPath()), java.nio.charset.StandardCharsets.ISO_8859_1);
        eq("PDF 页对象数(/Type/Page)", 1, countPdfPages(pdfText));

        File xlsx = new File(outDir, "_first-insp-report-single.xlsx");
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
        check("xlsx 文件非空(>1KB)", xlsx.isFile() && xlsx.length() > 1_000);
        System.out.println("  " + xlsx.getPath() + " " + xlsx.length() + " bytes");
        try (XSSFWorkbook wb = new XSSFWorkbook(new FileInputStream(xlsx))) {
            Set<String> cells = new LinkedHashSet<>();
            for (Row r : wb.getSheetAt(0)) {
                for (Cell c : r) {
                    if (c.getCellType() == CellType.STRING) cells.add(c.getStringCellValue());
                }
            }
            for (String req : REQUIREMENTS) check("xlsx 含《相关要求》「" + req.substring(0, Math.min(14, req.length())) + "…」", cells.contains(req));
            check("xlsx 里一个「批准」单元格都没有", cells.stream().noneMatch(s -> s.contains("批准")));
            check("xlsx 含表尾「审核人」", cells.contains("审核人"));
        }

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

    /** PDF 页对象数:`/Type/Page`(排除 `/Type/Pages`) */
    private static int countPdfPages(String pdfText) {
        Matcher m = Pattern.compile("/Type\\s*/Page\\b").matcher(pdfText);
        int n = 0;
        while (m.find()) n++;
        return n;
    }

    private static void eq(String what, Object want, Object got) {
        if (want == null ? got == null : want.equals(got)) pass++;
        else fails.add(what + " 期望=" + want + " 实际=" + got);
    }

    private static void check(String what, boolean ok) {
        if (ok) pass++;
        else fails.add(what);
    }
}
