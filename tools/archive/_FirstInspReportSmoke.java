/*
 * _FirstInspReportSmoke.java —— 首件检验记录表报表模板的**离线冒烟**(不启动后端/不碰库)。
 *
 * 为什么要有它:`QcFirstInspReportSupport` 是"按数据生成 JRXML 再编译"的写法,
 * 生成的 XML 一旦不合法,要到「导出报表」点下去才会炸(而且要走一次 3 分钟的打包重启)。
 * 这里直接拿**假明细**跑「矩阵 → 生成 → 编译 → 填充 → 导出 PDF/xlsx」,秒级拿到真错误。
 *
 * 用法(仓库根):
 *   $env:JAVA_HOME="C:\Users\vigna\.jdks\ms-25.0.4"
 *   $cp = "backend\target\classes;" + (Get-Content backend\target\cp.txt -Raw)
 *   & "$env:JAVA_HOME\bin\java.exe" -Dstdout.encoding=UTF-8 -cp $cp tools\archive\_FirstInspReportSmoke.java
 *
 * ⚠ 单文件源码启动(classpath 上带 -cp)在**源码旁边**留 .class —— 跑完自己删掉(仓库 .gitignore 已挡)。
 */
import com.yinjia.mes.service.QcFirstInspReportSupport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.export.ooxml.JRXlsxExporter;
import net.sf.jasperreports.export.SimpleExporterInput;
import net.sf.jasperreports.export.SimpleOutputStreamExporterOutput;
import net.sf.jasperreports.export.SimpleXlsxReportConfiguration;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class _FirstInspReportSmoke {

    /** 图纸上的 10 个测试项目:{数据键, 列名, 分组, 单位, 标准} —— 与 FirstInspItems.DEFS 同源 */
    private static final String[][] DEFS = {
            {"appearance", "炭棒表观状态", "表观及脱粉", "", "/"},
            {"depowder", "炭棒脱粉情况", "表观及脱粉", "", "/"},
            {"outer", "炭棒外径", "尺寸及重量", "mm", ""},
            {"inner", "炭棒内径", "尺寸及重量", "mm", ""},
            {"length", "炭棒长度", "尺寸及重量", "mm", ""},
            {"weight", "炭棒重量", "尺寸及重量", "g", ""},
            {"drop", "跌落", "强度", "", "跌落高度: 10cm;跌落次数: 10次;跌落要求: 10"},
            {"compress", "挤压强度", "强度", "kgf", "测试间距: 10mm;压头下降速度: 10mm/min;强度要求: 10"},
            {"turbidity", "浊度NTU", "浊度及压降", "NTU", "/"},
            {"pressure", "压降kPa", "浊度及压降", "kPa", "压降标准: 10kPa;是否测试: √"}};

    public static void main(String[] args) throws Exception {
        List<Map<String, ?>> rows = new ArrayList<>();
        int no = 0;
        for (String[] d : DEFS) {
            rows.add(row("标准", "标准", d, "/".equals(d[4]) ? "/" : d[4], ++no));
            for (int s = 1; s <= 8; s++) rows.add(row("样品", s + "#", d, "", ++no));
        }
        // 四组各填一格(与探针同口径),核"值确实进了矩阵"
        put(rows, "appearance", "2#", "无粘模（均匀）");
        put(rows, "outer", "4#", "34.2");
        put(rows, "drop", "6#", "5");
        put(rows, "turbidity", "8#", "1.1");

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("产品编码", "T042");
        head.put("规格型号", "28*12*180");
        head.put("生产日期", "2026-10-17");
        head.put("生产线", "1号机");
        head.put("总结论", "合格");
        head.put("检验员", "admin");

        QcFirstInspReportSupport.Matrix m = QcFirstInspReportSupport.matrix(rows, head);
        System.out.println("[矩阵] " + QcFirstInspReportSupport.describe(m));

        long t0 = System.currentTimeMillis();
        var report = QcFirstInspReportSupport.report(m);
        // ⚠ 页面尺寸要**实测**:JR 对 jasperReport 上的 pageWidth/pageHeight + orientation 有自己的换算口径,
        //   声明"横向 842×595"未必真出横向(实测量到的是 595×842 ⇒ 纸面右半张被裁)。
        System.out.println("[编译] OK " + (System.currentTimeMillis() - t0) + "ms"
                + "  page=" + report.getPageWidth() + "x" + report.getPageHeight()
                + "  columnWidth=" + report.getColumnWidth());
        // 二次取应命中缓存(同签名)
        if (QcFirstInspReportSupport.report(m) != report) throw new IllegalStateException("编译缓存没命中");

        JasperPrint print = JasperFillManager.fillReport(report,
                QcFirstInspReportSupport.params(m, head),
                new JRMapCollectionDataSource(QcFirstInspReportSupport.dataRows()));
        System.out.println("[填充] 页数=" + print.getPages().size());

        File pdf = new File("tools/archive/_smoke-first-insp-report.pdf");
        JasperExportManager.exportReportToPdfFile(print, pdf.getPath());
        System.out.println("[PDF ] " + pdf.getPath() + " " + pdf.length() + " bytes");

        SimpleXlsxReportConfiguration cfg = new SimpleXlsxReportConfiguration();
        cfg.setDetectCellType(true);
        cfg.setOnePagePerSheet(false);
        JRXlsxExporter x = new JRXlsxExporter();
        x.setExporterInput(new SimpleExporterInput(print));
        File xlsx = new File("tools/archive/_smoke-first-insp-report.xlsx");
        x.setExporterOutput(new SimpleOutputStreamExporterOutput(new FileOutputStream(xlsx)));
        x.setConfiguration(cfg);
        x.exportReport();
        System.out.println("[XLSX] " + xlsx.getPath() + " " + xlsx.length() + " bytes");

        // 空明细也要能出(不抛)—— 单子上还什么都没铺时点导出不能 500
        QcFirstInspReportSupport.Matrix empty = QcFirstInspReportSupport.matrix(List.of(), head);
        System.out.println("[空明细] 列数=" + empty.colCount() + " 编译="
                + (QcFirstInspReportSupport.report(empty) != null));
        System.out.println("SMOKE OK");
    }

    private static Map<String, Object> row(String type, String sample, String[] d, String std, int no) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("表区", "首件检验");
        r.put("行类型", type);
        r.put("样品序号", sample);
        r.put("检验列", d[0]);
        r.put("检验项目", d[1]);
        r.put("项目分组", d[2]);
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
    }
}
