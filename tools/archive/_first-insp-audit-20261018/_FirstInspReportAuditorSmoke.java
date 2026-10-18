/*
 * _FirstInspReportAuditorSmoke.java —— 首件检验记录表「表尾第三格 = 审核人」的**离线冒烟**
 * (2026-10-18,不启动后端/不碰库/不重启 8090)。
 *
 * 为什么单独一支:本轮给服务端报表骨架 reports/qc_first_insp.jrxml 的表尾加了 `$P{审核人}`
 * (面板纸面 / 客户端 Excel 同批同口径,见 tools/archive/_first-insp-audit-20261018/),
 * 而 .jrxml 在 classpath 里 ⇒ **只有重新打包才会在 8090 生效**。
 * 本冒烟直接用 `mvn compile` 之后 target\classes 里那份**新骨架**跑
 * 「矩阵 → 生成 → 编译 → 填充 → 导出 PDF」,秒级证明:① 新参数声明不炸编译;
 * ② 未审核(审核人缺省)= 空格;③ 已审核(审核人=李四)= 值真的印在表尾第三格。
 *
 * 用法(仓库根):
 *   $env:JAVA_HOME="C:\Users\vigna\.jdks\ms-25.0.4"
 *   $cp = "backend\target\classes;" + (Get-Content backend\target\cp.txt -Raw)
 *   & "$env:JAVA_HOME\bin\java.exe" -Dstdout.encoding=UTF-8 -cp $cp tools\archive\_first-insp-audit-20261018\_FirstInspReportAuditorSmoke.java
 * 产物:tools/archive/_first-insp-audit-20261018/_smoke-auditor-{空,值}.pdf(PDF 文本层可抽出来核)
 */
import com.yinjia.mes.service.QcFirstInspReportSupport;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class _FirstInspReportAuditorSmoke {

    /** 两列就够核表尾(炭棒尺寸 / 密度管控),不必复刻图纸 10 列 */
    private static final String[][] DEFS = {
            {"outer", "炭棒外径", "尺寸及重量", "mm"},
            {"density", "密度管控", "尺寸及重量", "g/cm3"}};

    public static void main(String[] args) throws Exception {
        List<Map<String, ?>> rows = new ArrayList<>();
        int no = 0;
        for (String[] d : DEFS) {
            rows.add(row("标准", "标准", d, "外径:10mm", ++no));
            for (int s = 1; s <= 8; s++) rows.add(row("样品", s + "#", d, "", ++no));
        }
        Map<String, Object> base = new LinkedHashMap<>();
        base.put("产品编码", "T042");
        base.put("规格型号", "28*12*180");
        base.put("生产日期", "2026-10-18");
        base.put("生产线", "1号机");
        base.put("总结论", "合格");
        base.put("检验员", "张三");

        // ① 未审核:head 里没有「审核人」⇒ 表尾第三格应为空(不抛、不显示 null)
        one(rows, base, "空", "_smoke-auditor-空.pdf");
        // ② 已审核:审核人有值 ⇒ 值必须印出来
        Map<String, Object> audited = new LinkedHashMap<>(base);
        audited.put("审核人", "李四");
        one(rows, audited, "值", "_smoke-auditor-值.pdf");

        System.out.println("SMOKE OK");
    }

    private static void one(List<Map<String, ?>> rows, Map<String, Object> head, String tag, String out) throws Exception {
        QcFirstInspReportSupport.Matrix m = QcFirstInspReportSupport.matrix(rows, head);
        var report = QcFirstInspReportSupport.report(m);
        JasperPrint print = JasperFillManager.fillReport(report,
                QcFirstInspReportSupport.params(m, head),
                new JRMapCollectionDataSource(QcFirstInspReportSupport.dataRows()));
        File pdf = new File("tools/archive/_first-insp-audit-20261018/" + out);
        JasperExportManager.exportReportToPdfFile(print, pdf.getPath());
        System.out.println("[表尾 " + tag + "] page=" + report.getPageWidth() + "x" + report.getPageHeight()
                + " 页数=" + print.getPages().size() + " 审核人参数='" + QcFirstInspReportSupport.params(m, head).get("审核人")
                + "' → " + pdf.getPath() + " " + pdf.length() + " bytes");
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
}
