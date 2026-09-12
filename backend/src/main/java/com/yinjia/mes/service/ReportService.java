package com.yinjia.mes.service;

import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import net.sf.jasperreports.engine.export.ooxml.JRXlsxExporter;
import net.sf.jasperreports.export.SimpleExporterInput;
import net.sf.jasperreports.export.SimpleOutputStreamExporterOutput;
import net.sf.jasperreports.export.SimpleXlsxReportConfiguration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 对外正式报表服务(JasperReports)。
 *
 * 设计要点:
 * - **模板由 IT 维护**:模板 = classpath 下 reports/*.jrxml,注册表 = reports/report-templates.properties;
 *   业务侧只选单据 + 选格式,本期不做网页拖拽设计器。
 * - **取数沿用既有链路**:头/明细一律走 PanelRegistry + QueryService.loadOneDoc,
 *   不另写一套 SQL —— 中文数据键、作废过滤、状态推导与面板列表完全同源。
 * - 头字段下发为报表参数(parameter),明细行下发为数据源(field);两者中文名都取自 yj_field.label。
 * - 编译结果按模板缓存(首次导出时编译,之后复用);JRXML 改动需重启后端生效。
 * - 导出格式:pdf(JasperExportManager,中文字体由 fonts/ 字体扩展嵌入)/ xlsx(JRXlsxExporter)。
 */
@Service
public class ReportService {

    public static final String FORMAT_PDF = "pdf";
    public static final String FORMAT_XLSX = "xlsx";

    /** 注册表一行 */
    public record ReportTemplate(String code, String panelCode, String name, String file) {}

    private static final String REGISTRY = "reports/report-templates.properties";

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final List<ReportTemplate> templates;
    private final Map<String, JasperReport> compiled = new ConcurrentHashMap<>();

    public ReportService(PanelRegistry registry, QueryService queryService) {
        this.registry = registry;
        this.queryService = queryService;
        this.templates = loadRegistry();
    }

    /** 某面板可用的报表模板(前端入口按它显隐;不给 panelCode 就返回全部) */
    public List<ReportTemplate> templatesOf(String panelCode) {
        if (panelCode == null || panelCode.isBlank()) return templates;
        return templates.stream().filter(t -> t.panelCode().equals(panelCode)).toList();
    }

    /** 供 /api/report/templates 回给前端的结构 */
    public List<Map<String, Object>> templateList(String panelCode) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ReportTemplate t : templatesOf(panelCode)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", t.code());
            m.put("panelCode", t.panelCode());
            m.put("name", t.name());
            m.put("formats", List.of(FORMAT_PDF, FORMAT_XLSX));
            out.add(m);
        }
        return out;
    }

    /**
     * 生成报表字节流。
     *
     * @param code      模板编码(注册表键)
     * @param panelCode 面板编码(必须与模板登记的面板一致,防止张冠李戴)
     * @param docNo     单据编号(yj_panel.group_col 的值)
     * @param format    pdf / xlsx
     */
    public byte[] export(String code, String panelCode, String docNo, String format) {
        ReportTemplate tpl = templates.stream().filter(t -> t.code().equals(code)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("报表模板不存在：" + code));
        String panel = (panelCode == null || panelCode.isBlank()) ? tpl.panelCode() : panelCode;
        if (!tpl.panelCode().equals(panel)) {
            throw new IllegalArgumentException("报表模板 " + code + " 不属于面板 " + panel);
        }
        if (docNo == null || docNo.isBlank()) throw new IllegalArgumentException("单据编号不能为空");
        String fmt = (format == null || format.isBlank()) ? FORMAT_PDF : format.trim().toLowerCase();
        if (!FORMAT_PDF.equals(fmt) && !FORMAT_XLSX.equals(fmt)) {
            throw new IllegalArgumentException("不支持的报表格式：" + format + "(只支持 pdf / xlsx)");
        }

        PanelRegistry.PanelDef def = registry.panel(panel);
        Map<String, Object> doc = queryService.loadOneDoc(def, docNo);

        Map<String, Object> params = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : doc.entrySet()) {
            // 头字段(标量)一律下发为报表参数:模板要用哪个用哪个,加字段不必改 Java
            Object v = e.getValue();
            if (v == null || v instanceof Map || v instanceof Iterable) continue;
            params.put(e.getKey(), v);
        }
        params.put("单据编号", docNo);
        params.put("打印时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));

        List<Map<String, ?>> rows = detailRows(def, doc);
        // 单号在库里不存在时,QueryService 会返回一张只有「编号」的空壳单(头表查不到行、明细为空)。
        // 报表不能把空壳当单据打出去 —— 按面板元数据判空后直接报错,避免"导出一张空白正式单据"。
        if (rows.isEmpty() && !hasAnyHeadValue(def, doc)) {
            throw new IllegalArgumentException("单据不存在：" + docNo);
        }

        JasperPrint print;
        try {
            print = JasperFillManager.fillReport(compile(tpl), params, new JRMapCollectionDataSource(rows));
        } catch (JRException e) {
            throw new IllegalArgumentException("报表填充失败：" + rootMessage(e));
        }

        try {
            return FORMAT_PDF.equals(fmt) ? JasperExportManager.exportReportToPdf(print) : toXlsx(print);
        } catch (JRException e) {
            throw new IllegalArgumentException("报表导出失败：" + rootMessage(e));
        }
    }

    /** 报表文件名(浏览器另存用):销售订单-SO-2026-08-0001.pdf */
    public String fileName(String code, String docNo, String format) {
        String name = templates.stream().filter(t -> t.code().equals(code)).map(ReportTemplate::name)
                .findFirst().orElse(code);
        return name + "-" + docNo + (FORMAT_XLSX.equalsIgnoreCase(format) ? ".xlsx" : ".pdf");
    }

    // ============ 内部 ============

    /** 明细行:沿用 QueryService 行契约 doc.detail.<tabKey> */
    @SuppressWarnings("unchecked")
    private List<Map<String, ?>> detailRows(PanelRegistry.PanelDef def, Map<String, Object> doc) {
        Object detail = doc.get("detail");
        if (!(detail instanceof Map<?, ?> dm)) return List.of();
        Object rows = dm.get(def.tabKey());
        if (!(rows instanceof List<?> list)) return List.of();
        List<Map<String, ?>> out = new ArrayList<>();
        for (Object r : list) {
            if (r instanceof Map<?, ?> m) out.add((Map<String, ?>) m);
        }
        return out;
    }

    /** 头字段里有没有任何一个有值(判「单据是否真的存在」用,见 export 里的空壳单守卫) */
    private static boolean hasAnyHeadValue(PanelRegistry.PanelDef def, Map<String, Object> doc) {
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            if (doc.get(f.label()) != null) return true;
        }
        return false;
    }

    private JasperReport compile(ReportTemplate tpl) {
        return compiled.computeIfAbsent(tpl.code(), k -> {
            try (InputStream in = new ClassPathResource(tpl.file()).getInputStream()) {
                return JasperCompileManager.compileReport(in);
            } catch (IOException | JRException e) {
                throw new IllegalStateException("报表模板编译失败(" + tpl.file() + ")：" + rootMessage(e));
            }
        });
    }

    private static byte[] toXlsx(JasperPrint print) throws JRException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        JRXlsxExporter exporter = new JRXlsxExporter();
        exporter.setExporterInput(new SimpleExporterInput(print));
        exporter.setExporterOutput(new SimpleOutputStreamExporterOutput(out));
        SimpleXlsxReportConfiguration cfg = new SimpleXlsxReportConfiguration();
        cfg.setOnePagePerSheet(false);
        cfg.setDetectCellType(true);         // 数字/日期按类型落单元格,Excel 里可直接参与计算
        cfg.setWhitePageBackground(false);   // 不铺白底,保留模板的浅灰表头
        cfg.setIgnorePageMargins(true);
        cfg.setRemoveEmptySpaceBetweenRows(true);
        cfg.setSheetNames(new String[]{print.getName()});
        exporter.setConfiguration(cfg);
        exporter.exportReport();
        return out.toByteArray();
    }

    private static String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        String m = t.getMessage();
        return m == null || m.isBlank() ? t.getClass().getSimpleName() : m;
    }

    /**
     * 读注册表。逐行解析(不用 Properties.load):①保序 ②UTF-8 中文名不乱码。
     * 注册表缺文件/缺键 = 没有可用模板(前端入口自动不显示),不阻断启动。
     */
    private static List<ReportTemplate> loadRegistry() {
        ClassPathResource res = new ClassPathResource(REGISTRY);
        if (!res.exists()) return List.of();
        Map<String, String[]> byCode = new LinkedHashMap<>();
        try (InputStream in = res.getInputStream()) {
            String text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            for (String raw : text.split("\\R")) {
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#") || line.startsWith("!")) continue;
                int eq = line.indexOf('=');
                if (eq <= 0) continue;
                String key = line.substring(0, eq).trim();
                String val = line.substring(eq + 1).trim();
                int dot = key.lastIndexOf('.');
                if (dot <= 0) continue;
                String[] row = byCode.computeIfAbsent(key.substring(0, dot), k -> new String[3]);
                switch (key.substring(dot + 1)) {
                    case "panelCode" -> row[0] = val;
                    case "name" -> row[1] = val;
                    case "file" -> row[2] = val;
                    default -> { /* 未知键忽略,便于将来扩展 */ }
                }
            }
        } catch (IOException e) {
            return List.of();
        }
        List<ReportTemplate> out = new ArrayList<>();
        for (Map.Entry<String, String[]> e : byCode.entrySet()) {
            String[] r = e.getValue();
            if (r[0] == null || r[1] == null || r[2] == null) continue; // 三键不全的行丢掉
            out.add(new ReportTemplate(e.getKey(), r[0], r[1], r[2]));
        }
        return List.copyOf(out);
    }
}
