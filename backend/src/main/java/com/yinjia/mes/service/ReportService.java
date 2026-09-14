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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 对外正式报表服务(JasperReports,ADR-0002)。
 *
 * 设计要点:
 * - **模板存数据库 yj_report_template**(管理员上传即生效免重启,上传时编译校验);
 *   classpath 的 report-templates.properties 保留为兜底(库中没有的 code 才回退),便于过渡。
 * - **取数沿用既有链路**:头/明细一律走 PanelRegistry + QueryService.loadOneDoc,
 *   不另写一套 SQL —— 中文数据键、作废过滤、状态推导与面板列表完全同源。
 * - 头字段下发为报表参数(parameter),明细行下发为数据源(field);两者中文名都取自 yj_field.label。
 * - 编译缓存按 code+update_at 键控:模板在库里被更新(update_at 变化)即自动重编译,无需重启。
 * - 导出格式:pdf(中文字体由 fonts/ 字体扩展嵌入)/ xlsx(JRXlsxExporter)。
 */
@Service
public class ReportService {

    public static final String FORMAT_PDF = "pdf";
    public static final String FORMAT_XLSX = "xlsx";

    private static final String REGISTRY = "reports/report-templates.properties";
    private static final String SEED_FILE = "reports/so_order.jrxml";

    /** 模板一行(DB 或 classpath 注册表统一视图) */
    public record ReportTemplate(Long id, String code, String panelCode, String name,
                                 String file, String jrxmlText, boolean enabled, Timestamp updatedAt) {}

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final JdbcTemplate jdbc;
    private final Map<String, CompiledTemplate> compiled = new ConcurrentHashMap<>();

    /** 编译缓存条目:模板 update_at 变了就重编译 */
    private record CompiledTemplate(Timestamp updatedAt, JasperReport report) {}

    public ReportService(PanelRegistry registry, QueryService queryService, JdbcTemplate jdbc) {
        this.registry = registry;
        this.queryService = queryService;
        this.jdbc = jdbc;
        seedFromClasspath();
    }

    // ============ 查询(前端入口显隐 + 弹窗下拉) ============

    /** 某面板可用(启用)的报表模板;不给 panelCode 返回全部 */
    public List<ReportTemplate> templatesOf(String panelCode) {
        return resolveTemplates().stream()
                .filter(ReportTemplate::enabled)
                .filter(t -> panelCode == null || panelCode.isBlank() || t.panelCode().equals(panelCode))
                .toList();
    }

    /** 供 /api/report/templates 回给前端的结构;all=true 含停用(管理弹窗用,调用方先做 admin 校验) */
    public List<Map<String, Object>> templateList(String panelCode, boolean all) {
        List<ReportTemplate> src = all ? resolveTemplates() : templatesOf(panelCode);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ReportTemplate t : src) {
            if (!all && panelCode != null && !panelCode.isBlank() && !t.panelCode().equals(panelCode)) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.id());
            m.put("code", t.code());
            m.put("panelCode", t.panelCode());
            m.put("name", t.name());
            m.put("enabled", t.enabled());
            m.put("updateBy", t.updatedAt() == null ? null : t.updatedAt().toLocalDateTime()
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            m.put("formats", List.of(FORMAT_PDF, FORMAT_XLSX));
            out.add(m);
        }
        return out;
    }

    // ============ 管理(上传/启停/删除;调用方先 requireAdmin) ============

    /** 上传/覆盖模板:编译校验失败抛 400;同 code 覆盖(更新 jrxml/名称/面板并启用) */
    public Map<String, Object> upload(String code, String panelCode, String name, String jrxmlText, String remark, String user) {
        if (code == null || !code.matches("[a-z][a-z0-9_]{1,58}")) {
            throw new IllegalArgumentException("模板编码须为小写字母开头的小写字母/数字/下划线(2~59 位)：" + code);
        }
        if (name == null || name.isBlank()) throw new IllegalArgumentException("报表名称不能为空");
        if (jrxmlText == null || jrxmlText.isBlank()) throw new IllegalArgumentException("模板内容(.jrxml)不能为空");
        if (!jrxmlText.contains("<jasperReport")) throw new IllegalArgumentException("这不是 JasperReports 模板文件(缺 <jasperReport> 根元素)");
        try {
            JasperCompileManager.compileReport(new ByteArrayInputStream(jrxmlText.getBytes(StandardCharsets.UTF_8)));
        } catch (JRException e) {
            throw new IllegalArgumentException("模板编译失败,请检查 .jrxml：" + rootMessage(e));
        }
        PanelRegistry.PanelDef def;
        try {
            def = registry.panel(panelCode);
        } catch (Exception e) {
            def = null;
        }
        if (def == null) throw new IllegalArgumentException("面板不存在：" + panelCode);

        int n = jdbc.update(
                "MERGE yj_report_template AS t USING (VALUES (?, ?, ?, ?, ?, ?)) AS s(template_code, panel_code, name, jrxml_text, remark, update_by) "
                        + "ON t.template_code = s.template_code "
                        + "WHEN MATCHED THEN UPDATE SET panel_code = s.panel_code, name = s.name, jrxml_text = s.jrxml_text, "
                        + "enabled = 'Y', remark = s.remark, update_by = s.update_by, update_at = SYSDATETIME() "
                        + "WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by) "
                        + "VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, 'Y', s.remark, s.update_by, s.update_by);",
                code, panelCode, name.trim(), jrxmlText, remark, user);
        compiled.remove(code);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", code);
        out.put("updated", n);
        return out;
    }

    /** 启用/停用 */
    public void setEnabled(Long id, boolean enabled, String user) {
        int n = jdbc.update("UPDATE yj_report_template SET enabled = ?, update_by = ?, update_at = SYSDATETIME() WHERE id = ?",
                enabled ? "Y" : "N", user, id);
        if (n == 0) throw new IllegalArgumentException("模板不存在：id=" + id);
    }

    /** 删除(仅库内模板;classpath 注册表条目无 id,不可删) */
    public void delete(Long id) {
        List<String> codes = jdbc.queryForList("SELECT template_code FROM yj_report_template WHERE id = ?", String.class, id);
        if (codes.isEmpty()) throw new IllegalArgumentException("模板不存在：id=" + id);
        jdbc.update("DELETE FROM yj_report_template WHERE id = ?", id);
        compiled.remove(codes.get(0));
    }

    // ============ 导出 ============

    /**
     * 生成报表字节流。
     *
     * @param code      模板编码(库或注册表)
     * @param panelCode 面板编码(必须与模板登记的面板一致,防止张冠李戴)
     * @param docNo     单据编号(yj_panel.group_col 的值)
     * @param format    pdf / xlsx
     */
    public byte[] export(String code, String panelCode, String docNo, String format) {
        ReportTemplate tpl = resolveTemplates().stream().filter(t -> t.code().equals(code)).findFirst()
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
        String name = resolveTemplates().stream().filter(t -> t.code().equals(code))
                .map(ReportTemplate::name).findFirst().orElse(code);
        return name + "-" + docNo + (FORMAT_XLSX.equalsIgnoreCase(format) ? ".xlsx" : ".pdf");
    }

    /** 该面板最近一张单据的单号(模板预览取数用;查不到返回 null) */
    public String latestDocNo(String panelCode) {
        PanelRegistry.PanelDef def;
        try {
            def = registry.panel(panelCode);
        } catch (Exception e) {
            return null;
        }
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        List<String> nos = jdbc.queryForList(
                "SELECT TOP 1 [" + def.groupCol() + "] FROM " + table + " WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC",
                String.class);
        return nos.isEmpty() ? null : nos.get(0);
    }

    // ============ 内部 ============

    /**
     * 模板统一视图:DB(yj_report_template,含停用)优先,classpath 注册表兜底(库中同 code 覆盖注册表)。
     * DB 表还没建/查询失败时静默降级为纯注册表(报表是增量能力,不阻断面板)。
     */
    private List<ReportTemplate> resolveTemplates() {
        List<ReportTemplate> out = new ArrayList<>();
        try {
            out.addAll(jdbc.query(
                    "SELECT id, template_code, panel_code, name, jrxml_text, enabled, update_at FROM yj_report_template ORDER BY id",
                    (rs, i) -> new ReportTemplate(rs.getLong("id"), rs.getString("template_code"),
                            rs.getString("panel_code"), rs.getString("name"), null, rs.getString("jrxml_text"),
                            "Y".equals(rs.getString("enabled")), rs.getTimestamp("update_at"))));
        } catch (Exception e) {
            // 表不存在等:忽略,走注册表兜底
        }
        var inDb = out.stream().map(ReportTemplate::code).collect(java.util.stream.Collectors.toSet());
        for (ReportTemplate t : loadRegistry()) {
            if (!inDb.contains(t.code())) out.add(t);
        }
        return List.copyOf(out);
    }

    /** 启动播种:表里没有 so_order 且 classpath 有模板文件时导入(ADR-0002 迁移路径) */
    private void seedFromClasspath() {
        try {
            Integer cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'so_order'", Integer.class);
            if (cnt != null && cnt > 0) return;
            ClassPathResource res = new ClassPathResource(SEED_FILE);
            if (!res.exists()) return;
            String text = new String(res.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            jdbc.update("INSERT INTO yj_report_template (template_code, panel_code, name, jrxml_text, enabled, remark, create_by) "
                            + "VALUES (N'so_order', N'SO_ORDER', N'销售订单', ?, 'Y', N'自 classpath 注册表迁入(ADR-0002)', N'seed')", text);
        } catch (Exception e) {
            // 表还没建/无权限:忽略,下次启动再试(迁移脚本负责建表)
        }
    }

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

    /** 编译(带缓存):库模板按 update_at 失效重编;classpath 模板进程内一次 */
    private JasperReport compile(ReportTemplate tpl) {
        CompiledTemplate c = compiled.get(tpl.code());
        if (c != null && (tpl.updatedAt() == null || tpl.updatedAt().equals(c.updatedAt()))) return c.report();
        try {
            JasperReport report = tpl.jrxmlText() != null
                    ? JasperCompileManager.compileReport(new ByteArrayInputStream(tpl.jrxmlText().getBytes(StandardCharsets.UTF_8)))
                    : compileClasspath(tpl.file());
            compiled.put(tpl.code(), new CompiledTemplate(tpl.updatedAt(), report));
            return report;
        } catch (JRException e) {
            throw new IllegalArgumentException("报表模板编译失败(" + tpl.code() + ")：" + rootMessage(e));
        }
    }

    private JasperReport compileClasspath(String file) {
        try (InputStream in = new ClassPathResource(file).getInputStream()) {
            return JasperCompileManager.compileReport(in);
        } catch (IOException | JRException e) {
            throw new IllegalArgumentException("报表模板编译失败(" + file + ")：" + rootMessage(e));
        }
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
     * 读注册表(兜底)。逐行解析(不用 Properties.load):①保序 ②UTF-8 中文名不乱码。
     * 注册表缺文件/缺键 = 没有可用模板,不阻断启动。
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
            out.add(new ReportTemplate(null, e.getKey(), r[0], r[1], r[2], null, true, null));
        }
        return List.copyOf(out);
    }
}
