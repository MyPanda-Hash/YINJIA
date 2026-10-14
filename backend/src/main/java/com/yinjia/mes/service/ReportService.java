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
import java.sql.Timestamp;
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

    /**
     * 通用模板编码。注册表里**没有**登记精细模板的单据面板,一律回退到它 ——
     * 版式由 reports/report-generic.jrxml + GenericReportSupport(按 yj_field 动态生成明细表)决定。
     * 带这张单的精细模板(如 SO_ORDER → so_order)优先级更高:登记过就用登记的(能精细化就单独出模板覆盖)。
     */
    public static final String GENERIC_CODE = "generic";
    private static final String GENERIC_TEMPLATE_NAME = "通用单据版式";
    private static final String GENERIC_FILE = "reports/report-generic.jrxml";
    /** 研发管理:本面板群不做对外报表交付(用户口径 2026-09-12),按模块分组 + 面板前缀双口径排除 */
    private static final String RD_MODULE = "研发管理";
    private static final String RD_PREFIX = "RD_";

    /**
     * 模块分组归并(2026-10-10):yj_panel.module_group 的历史碎值(基础资料/采购管理/生产管理/
     * 订单管理/委外加工/库存核算…)**同时**保留在原列用于读权限放行(PanelPermissionService.readablePanels
     * 按同模块放行),但对外展示(权限矩阵分组、报表口径)统一归并到**导航一级模块名**。
     * 只做单向投影:不改库、不改原列语义,故读放行与报表排除口径均不受影响。
     */
    private static final Map<String, String> NAV_GROUP = Map.ofEntries(
            Map.entry("智能供应链", "智能供应链"),
            Map.entry("库存核算", "智能供应链"),
            Map.entry("库存报表", "智能供应链"),
            Map.entry("采购管理", "智能供应链"),
            Map.entry("订单管理", "智能供应链"),
            Map.entry("销售管理", "智能供应链"),
            Map.entry("生产制造", "生产制造"),
            Map.entry("生产管理", "生产制造"),
            Map.entry("委外加工", "生产制造"),
            Map.entry("品质管理", "品质管理"),
            Map.entry("研发管理", "研发管理"),
            Map.entry("基础档案", "基础档案"),
            Map.entry("基础资料", "基础档案"),
            Map.entry("基础数据", "基础档案"),
            Map.entry("物料及价格", "基础档案"),
            Map.entry("设备管理", "设备管理"),
            Map.entry("财务管理", "财务管理"),
            Map.entry("我的桌面", "我的桌面"),
            Map.entry("其他", "其他"));
    /**
     * 物料二维码标签(存货档案勾选即打,2026-09-16):80×80mm 一码一页,二维码内容=存货编码。
     * 不走 /export 的单据链路(无 docNo/头参数),由 qrLabelPdf 直查 bs_inv 明细喂模板。
     */
    private static final String QR_LABEL_CODE = "inv_qr_label";
    private static final String QR_LABEL_FILE = "reports/inv-qr-label.jrxml";
    private static final ReportTemplate QR_LABEL_TPL =
            new ReportTemplate(null, QR_LABEL_CODE, "INV", "物料二维码标签", QR_LABEL_FILE, null, true, null);
    /** 一次最多打多少张:IN 占位符防打爆(SQL Server 单语句参数上限 2100) */
    private static final int QR_LABEL_MAX = 1000;

    /** 模板一行(DB 行含 id/jrxml_text/enabled/update_at;classpath 注册表行仅四键) */
    public record ReportTemplate(Long id, String code, String panelCode, String name,
                                 String file, String jrxmlText, boolean enabled, Timestamp updatedAt) {}

    private static final String REGISTRY = "reports/report-templates.properties";
    private static final String SEED_FILE = "reports/so_order.jrxml";

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final JdbcTemplate jdbc;
    private final Map<String, CompiledTemplate> compiled = new ConcurrentHashMap<>();

    /** 编译缓存条目:DB 模板 update_at 变了即自动重编译(上传即生效免重启) */
    private record CompiledTemplate(Timestamp updatedAt, JasperReport report) {}

    public ReportService(PanelRegistry registry, QueryService queryService, JdbcTemplate jdbc) {
        this.registry = registry;
        this.queryService = queryService;
        this.jdbc = jdbc;
        seedFromClasspath();
    }

    // ============ 模板解析:DB(yj_report_template)优先 → classpath 注册表兜底(ADR-0002) ============

    /** DB 内模板(includeDisabled=false 仅启用);表未建/查询失败返回空列表(不阻断) */
    private List<ReportTemplate> dbTemplates(boolean includeDisabled) {
        try {
            String sql = includeDisabled
                    ? "SELECT id, template_code, panel_code, name, jrxml_text, enabled, update_at FROM yj_report_template ORDER BY id"
                    : "SELECT id, template_code, panel_code, name, jrxml_text, enabled, update_at FROM yj_report_template WHERE enabled = 'Y' ORDER BY id";
            return jdbc.query(sql, (rs, i) -> new ReportTemplate(rs.getLong("id"), rs.getString("template_code"),
                    rs.getString("panel_code"), rs.getString("name"), null, rs.getString("jrxml_text"),
                    "Y".equals(rs.getString("enabled")), rs.getTimestamp("update_at")));
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 统一视图:DB 启用模板优先,注册表条目(库中无同 code)兜底 */
    private List<ReportTemplate> resolveTemplates() {
        List<ReportTemplate> out = new ArrayList<>(dbTemplates(false));
        var inDb = out.stream().map(ReportTemplate::code).collect(java.util.stream.Collectors.toSet());
        for (ReportTemplate t : loadRegistry()) {
            if (!inDb.contains(t.code())) out.add(t);
        }
        return List.copyOf(out);
    }

    /** 启动播种:表里没有 so_order 且 classpath 有模板文件时导入一次 */
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
            // 表还没建:忽略,迁移脚本建表后下次启动再播种
        }
    }

    /** 某面板可用的报表模板(前端入口按它显隐;不给 panelCode 就返回全部启用+注册表) */
    public List<ReportTemplate> templatesOf(String panelCode) {
        if (panelCode == null || panelCode.isBlank()) return resolveTemplates();
        List<ReportTemplate> db = dbTemplates(false).stream()
                .filter(t -> t.panelCode().equals(panelCode)).toList();
        if (!db.isEmpty()) return db;                                // DB 登记过 → 优先(上传即生效)
        List<ReportTemplate> explicit = loadRegistry().stream()
                .filter(t -> t.panelCode().equals(panelCode)).toList();
        if (!explicit.isEmpty()) return explicit;                    // 注册表登记过精细模板 → 次之
        return reportablePanels().contains(panelCode) ? List.of(genericTemplate(panelCode)) : List.of();
    }

    /**
     * 该面板有没有对外报表能力:注册表登记过,或「单据面板(mode='doc')且不属研发管理」→ 走通用模板。
     * 研发管理面板是内部研发记录,不做对外正式报表,因此前端在它们身上看不到入口。
     */
    public boolean hasReport(String panelCode) {
        if (panelCode == null || panelCode.isBlank()) return false;
        if (dbTemplates(false).stream().anyMatch(t -> t.panelCode().equals(panelCode))) return true;
        if (loadRegistry().stream().anyMatch(t -> t.panelCode().equals(panelCode))) return true;
        return reportablePanels().contains(panelCode);
    }

    /** 铺开范围(用同一口径给前端做自检/排查用):mode='doc' 且非研发管理的面板编码 */
    public List<String> reportablePanels() {
        List<String> out = new ArrayList<>();
        for (PanelRegistry.PanelDef def : registry.all()) {
            if (!def.isDoc()) continue;                              // 档案/报表/平铺面板:不是对外单据
            if (isRdManagement(def)) continue;                       // 研发管理:整体排除
            out.add(def.code());
        }
        return out;
    }

    /**
     * 研发管理口径(2026-09-12 实测):yj_panel.module_group='研发管理' 的 22 张单据面板,
     * 与 panel_code LIKE 'RD_%' 的面板集合**完全一致**(22 = 22,交集 22,双向无差)。
     * 两口径取或:任一命中即排除 —— 新增面板只填了其中一个字段时也不会漏。
     */
    private static boolean isRdManagement(PanelRegistry.PanelDef def) {
        return RD_MODULE.equals(ReportService.navGroup(def.moduleName())) || def.code().startsWith(RD_PREFIX);
    }

    /** 模块分组归并到导航一级模块名;未登记的值原样返回(保证不会凭空吞掉面板)。 */
    public static String navGroup(String moduleGroup) {
        if (moduleGroup == null) return "其他";
        String g = moduleGroup.trim();
        if (g.isEmpty()) return "其他";
        // 乱码兜底(2026-10-10):历史上经非 UTF-8 通道写入,module_group 被写成一串半角问号
        // (实测 STOCK_BALANCE/STOCK_LEDGER/STOCK_STATUS/STOCK_SUMMARY 四行的值即 "????",
        //  原始字节 3F003F003F003F00)。这类值不是合法模块名,归到「其他」而不是自成一组,
        // 避免权限矩阵里冒出一个叫 "????" 的组。库侧已同批修正,此处是二次防线。
        if (g.chars().allMatch(c -> c == '?' || c == '\uFFFD')) return "其他";
        return NAV_GROUP.getOrDefault(g, g);
    }

    /** 导航一级模块展示顺序(权限矩阵按此排序,未登记模块排在末尾)。 */
    public static final List<String> NAV_GROUP_ORDER = List.of(
            "我的桌面", "研发管理", "智能供应链", "生产制造", "品质管理", "财务管理", "设备管理", "基础档案", "其他");

    /** 通用模板条目(面板名做报表名,文件名也更可读) */
    private ReportTemplate genericTemplate(String panelCode) {
        PanelRegistry.PanelDef def = panelDefOrNull(panelCode);
        String name = def == null || def.name() == null || def.name().isBlank() ? GENERIC_TEMPLATE_NAME : def.name();
        return new ReportTemplate(null, GENERIC_CODE, panelCode, name, GENERIC_FILE, null, true, null);
    }

    /** 面板定义(不抛异常版:未知面板按「不可报」处理,避免把 500 抛给前端) */
    private PanelRegistry.PanelDef panelDefOrNull(String panelCode) {
        try {
            return registry.panel(panelCode);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 明细列(中文标签 + 数据类型):动态明细表的列来源,与取数同源(yj_field.place='detail') */
    private static List<GenericReportSupport.Col> detailCols(PanelRegistry.PanelDef def) {
        List<GenericReportSupport.Col> cols = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("detail")) {
            if (f.hidden()) continue;                                // 隐藏列不进报表
            cols.add(new GenericReportSupport.Col(f.label(), f.dataType()));
        }
        return cols;
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
            if (GENERIC_CODE.equals(t.code())) {
                // 前端据此提示「该单据没有明细列,报表只有头字段」,避免业务以为导出缺内容
                PanelRegistry.PanelDef p = panelDefOrNull(t.panelCode());
                m.put("detailColumns", p == null ? 0 : detailCols(p).size());
            }
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
        ReportTemplate tpl;
        String panel;
        if (GENERIC_CODE.equals(code)) {
            // 通用模板不在注册表(对「除研发管理外的全部单据面板」自动生效),必须显式指定面板
            if (panelCode == null || panelCode.isBlank()) {
                throw new IllegalArgumentException("通用模板必须指定面板(panelCode)");
            }
            tpl = null;
            panel = panelCode;
        } else {
            tpl = dbTemplates(false).stream().filter(t -> t.code().equals(code)).findFirst().orElse(null);
            if (tpl == null) tpl = loadRegistry().stream().filter(t -> t.code().equals(code)).findFirst().orElse(null);
            if (tpl == null) throw new IllegalArgumentException("报表模板不存在：" + code);
            panel = (panelCode == null || panelCode.isBlank()) ? tpl.panelCode() : panelCode;
            if (!tpl.panelCode().equals(panel)) {
                throw new IllegalArgumentException("报表模板 " + code + " 不属于面板 " + panel);
            }
        }
        // 通用模板按面板解析:登记过精细模板的面板仍优先精细模板(注册表里 code=generic 的预留位不覆盖)。
        if (tpl == null) {
            tpl = templatesOf(panel).stream().filter(t -> GENERIC_CODE.equals(t.code())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "该面板不支持通用报表(仅 mode='doc' 且非研发管理的单据面板)：" + panel));
        }
        if (docNo == null || docNo.isBlank()) throw new IllegalArgumentException("单据编号不能为空");
        String fmt = (format == null || format.isBlank()) ? FORMAT_PDF : format.trim().toLowerCase();
        if (!FORMAT_PDF.equals(fmt) && !FORMAT_XLSX.equals(fmt)) {
            throw new IllegalArgumentException("不支持的报表格式：" + format + "(只支持 pdf / xlsx)");
        }

        PanelRegistry.PanelDef def = registry.panel(panel);
        Map<String, Object> doc = queryService.loadOneDoc(def, docNo);

        List<Map<String, ?>> rows = detailRows(def, doc);
        // 单号在库里不存在时,QueryService 会返回一张只有「编号」的空壳单(头表查不到行、明细为空)。
        // 报表不能把空壳当单据打出去 —— 按面板元数据判空后直接报错,避免"导出一张空白正式单据"。
        if (rows.isEmpty() && !hasAnyHeadValue(def, doc)) {
            throw new IllegalArgumentException("单据不存在：" + docNo);
        }

        JasperPrint print;
        try {
            if (GENERIC_CODE.equals(tpl.code())) {
                print = fillGeneric(def, doc, docNo, rows);
            } else {
                // 主数据源=明细全量。制程检验记录表是**矩阵版式**(外观/尺寸/重量三格由
                // headParams 按「表区」归并后下发成参数),模板里没有 detail band ⇒ 数据源不参与渲染;
                // 其余精细模板(so_order/sl_recv/出厂检验报告)照旧用明细行逐行渲染。
                print = JasperFillManager.fillReport(compile(tpl), headParams(doc, docNo, rows),
                        new JRMapCollectionDataSource(rows));
            }
        } catch (JRException e) {
            throw new IllegalArgumentException("报表填充失败：" + rootMessage(e));
        }

        try {
            return FORMAT_PDF.equals(fmt) ? JasperExportManager.exportReportToPdf(print) : toXlsx(print);
        } catch (JRException e) {
            throw new IllegalArgumentException("报表导出失败：" + rootMessage(e));
        }
    }

    /**
     * 物料二维码标签 PDF:勾选的存货编码 → 80×80mm 标签(物料编码/物料名称/规格 + 二维码=存货编码)。
     * 一码一页,按编码排序输出;取数与面板同源(bs_inv 现存行,作废过滤口径一致)。
     */
    public byte[] qrLabelPdf(List<String> codes) {
        List<String> clean = codes == null ? List.of() : codes.stream()
                .filter(c -> c != null && !c.isBlank()).map(String::trim).distinct().toList();
        if (clean.isEmpty()) throw new IllegalArgumentException("请先勾选要导出的商品");
        if (clean.size() > QR_LABEL_MAX) {
            throw new IllegalArgumentException(
                    "一次最多导出 " + QR_LABEL_MAX + " 个商品的二维码标签(当前 " + clean.size() + " 个),请分批勾选");
        }
        String in = String.join(",", java.util.Collections.nCopies(clean.size(), "?"));
        // 重复编码守卫:bs_inv.存货编码无唯一约束,同码多行=同一二维码可能贴出两种货 → 报错列出,先清数据再打标
        List<String> dup = jdbc.queryForList(
                "SELECT a.[存货编码] FROM bs_inv a WHERE a.[存货编码] IN (" + in + ") "
                        + "AND ISNULL(a.asp_cancel,'N')<>'Y' GROUP BY a.[存货编码] HAVING COUNT(*) > 1",
                clean.toArray()).stream().map(String::valueOf).sorted().toList();
        if (!dup.isEmpty()) {
            throw new IllegalArgumentException("存货编码在档案中重复,无法生成二维码标签(请先清理重复数据)：" + String.join("、", dup));
        }
        // List 泛型不变:queryForList 的 List<Map<String,Object>> 不能直填 Collection<Map<String,?>>,拷贝定型
        List<Map<String, ?>> rows = new ArrayList<>(jdbc.queryForList(
                "SELECT t.[存货编码], t.[存货名称], t.[规格型号] FROM bs_inv t "
                        + "WHERE t.[存货编码] IN (" + in + ") AND ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.[存货编码]",
                clean.toArray()));
        // 勾选后行被他人删除/作废:选不中的自然少一张;全部失效时不出空 PDF
        if (rows.isEmpty()) throw new IllegalArgumentException("勾选的存货在档案中均不存在(可能已被删除)");
        try {
            JasperPrint print = JasperFillManager.fillReport(
                    compile(QR_LABEL_TPL), new LinkedHashMap<>(), new JRMapCollectionDataSource(rows));
            return JasperExportManager.exportReportToPdf(print);
        } catch (JRException e) {
            throw new IllegalArgumentException("二维码标签生成失败：" + rootMessage(e));
        }
    }

    /** 标签文件名(浏览器另存用):物料二维码标签-yyyyMMdd-HHmm.pdf */
    public String qrLabelFileName() {
        return "物料二维码标签-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm")) + ".pdf";
    }

    /**
     * 通用模板填充(版式细节见 GenericReportSupport):
     *   ① 头字段 → 参数列表(头字段网格 3×5,值统一格式化);
     *   ② 明细列(0~22 列)→ 按页宽分块,每块一份子报表版式 + 一个数据源;
     *   ③ 主数据源每行 = 一个列块(块数据/块标识/行高),主版式里每块一条 detail 带。
     * 明细 0 行(或面板没有明细列)→ 块数为 0 → 主数据源不传行 → 只出页眉(头字段),不出空表。
     */
    private JasperPrint fillGeneric(PanelRegistry.PanelDef def, Map<String, Object> doc,
                                    String docNo, List<Map<String, ?>> rows) throws JRException {
        List<GenericReportSupport.Col> cols = detailCols(def);
        List<GenericReportSupport.Block> blocks = GenericReportSupport.layout(cols);
        String signature = def.code() + "|" + columnSignature(cols);

        Map<String, Object> params = headParams(doc, docNo);
        params.put("报表名称", def.name());
        // 通用版式把 单据编号/单据日期/单据状态/制单人 等声明为 String —— headParams 下发的是
        // loadOneDoc 的原始值(java.sql.Date 等),直接填会 ClassCastException;在这里统一定型。
        // 精细模板仍走 headParams 原始值,不受影响。
        for (Map.Entry<String, Object> e : new LinkedHashMap<>(params).entrySet()) {
            Object v = e.getValue();
            if (v == null || v instanceof String || v instanceof Number || v instanceof Boolean) continue;
            params.put(e.getKey(), GenericReportSupport.text(v));
        }
        // 头字段网格:标签 / 值 一一对应(值统一成字符串,日期与数字在这里定型)
        List<String> labels = new ArrayList<>();
        List<String> values = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            if (f.hidden()) continue;
            labels.add(f.label());
            values.add(GenericReportSupport.text(doc.get(f.label())));
        }
        while (labels.size() < GenericReportSupport.HEAD_GRID_CELLS) {
            labels.add("");
            values.add("");
        }
        params.put("头字段标签", labels);
        params.put("头字段值", values);

        List<Map<String, ?>> masterRows = new ArrayList<>();
        for (int i = 0; i < blocks.size(); i++) {
            GenericReportSupport.Block b = blocks.get(i);
            List<Map<String, ?>> flat = flatBlockRows(cols, b, rows);
            Map<String, Object> masterRow = new LinkedHashMap<>();
            masterRow.put("块数据", new JRMapCollectionDataSource(flat));
            masterRow.put("块标识", caption(blocks, b, rows.isEmpty()));
            masterRow.put("行高", GenericReportSupport.rowHeight(b, flat));
            masterRows.add(masterRow);
            params.put(i == 0 ? "子报表" : "子报表" + i,
                    GenericReportSupport.detailSubreport(signature + "|b" + i, cols, b));
        }
        return JasperFillManager.fillReport(
                GenericReportSupport.masterReport(signature, blocks.size()), params,
                new JRMapCollectionDataSource(masterRows));
    }

    /** 一个列块的扁平行:{SEQ: 块内行号, C1..Cn: 该块第 i 列的值} */
    private static List<Map<String, ?>> flatBlockRows(List<GenericReportSupport.Col> cols,
                                                      GenericReportSupport.Block block,
                                                      List<Map<String, ?>> rows) {
        List<Map<String, ?>> out = new ArrayList<>();
        int seq = 0;
        for (Map<String, ?> row : rows) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("SEQ", ++seq);
            for (int ci = 0; ci < block.cols().size(); ci++) {
                r.put("C" + (ci + 1), GenericReportSupport.text(row.get(cols.get(block.cols().get(ci)).label())));
            }
            out.add(r);
        }
        return out;
    }

    /** 块标题:单块写「明细」,多块写「明细（第 a-b 列 / 共 M 列）」;无明细数据时补一句提示 */
    private static String caption(List<GenericReportSupport.Block> blocks,
                                  GenericReportSupport.Block b, boolean noRows) {
        String cap = blocks.size() <= 1 ? "明细" : b.caption();
        return noRows ? cap + "（本单据无明细数据）" : cap;
    }

    /** 通用模板的编译缓存键(与精细模板共用 compile() 的缓存,键 = 模板编码) */
    private static final ReportTemplate GENERIC_TPL =
            new ReportTemplate(null, GENERIC_CODE, "", GENERIC_TEMPLATE_NAME, GENERIC_FILE, null, true, null);

    private JasperReport compileGeneric() {
        return compile(GENERIC_TPL);
    }

    /** 列签名:同面板列不变则复用同一份编译结果(列名 + 数据类型) */
    private static String columnSignature(List<GenericReportSupport.Col> cols) {
        StringBuilder sb = new StringBuilder();
        for (GenericReportSupport.Col c : cols) sb.append(c.label()).append('\u0001').append(c.dataType()).append('\u0002');
        return Integer.toHexString(sb.toString().hashCode()) + "-" + cols.size();
    }

    /** 头字段网格固定 15 格(与 report-generic.jrxml 一致),不足补空串 */
    private static final int HEAD_GRID_CELLS = 15;

    /** 头字段(标量)+ 单据编号/打印时间:精细模板与通用模板共用 */
    private static Map<String, Object> headParams(Map<String, Object> doc, String docNo) {
        return headParams(doc, docNo, List.of());
    }

    /**
     * 头参数 + 按「表区」归并的汇总结果(制程检验记录表用)。
     *
     * <p>背景:制程检验单(qc_proc_insp_detail)的明细按「表区」分成 外观/尺寸/重量/功能性测试 四组,
     * 报表上半部是三组各占一格的**矩阵版式**(照用户截图),不是一个检验项一行 ——
     * 因此需要把同表区的明细归并成一个字符串下发成参数。
     *
     * <p>归并口径:同表区多行时,取「检验项目:实测数值(判定)」逐行拼接,用 " · " 分隔;
     * 无值则留空(模板 isBlankWhenNull)。模板缺失这些参数时不受影响(只是多几个键)。
     */
    private static Map<String, Object> headParams(Map<String, Object> doc, String docNo, List<Map<String, ?>> rows) {
        Map<String, Object> params = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : doc.entrySet()) {
            // 头字段(标量)一律下发为报表参数:模板要用哪个用哪个,加字段不必改 Java
            Object v = e.getValue();
            if (v == null || v instanceof Map || v instanceof Iterable) continue;
            params.put(e.getKey(), v);
        }
        params.put("单据编号", docNo);
        params.put("打印时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        // 制程检验记录表:按表区归并(其他面板的明细没有「表区」列,归并结果为空,不影响既有模板)
        for (Map.Entry<String, String> e : SECTOR_PARAMS.entrySet()) {
            params.put(e.getValue(), joinSector(rows, e.getKey()));
        }
        // 尺寸/重量各 5 格:把该表区的多值串按 "/" 拆成 5 个参数(照截图 5 格=5 个抽样值)
        for (Map.Entry<String, String> e : SPLIT_PARAMS.entrySet()) {
            List<String> parts = splitParts(rows, e.getKey());
            for (int i = 0; i < 5; i++) {
                params.put(e.getValue() + "_" + (i + 1), i < parts.size() ? parts.get(i) : "");
            }
        }
        return params;
    }

    /** 需拆成 5 格的表区 → 参数名前缀 */
    private static final Map<String, String> SPLIT_PARAMS = Map.of(
            "尺寸", "尺寸",
            "重量", "重量");

    /**
     * 取某表区的「实测值」,摊平成一个列表(最多 5 个,对应截图的 5 格)。
     *
     * <p>取值优先级(2026-10-12 加「测量值1..5」列后):
     * <ol>
     *   <li>优先读结构化列 {@code 测量值1..5}(面板上就是 5 个录入格),
     *       同一行有多个值时全部摊平(如尺寸行 外径 填了 5 个格 ⇒ 5 个值);</li>
     *   <li>取不到再回退到旧文本列 {@code 实测数值},按 "/" 拆(兼容历史数据)。</li>
     * </ol>
     */
    private static List<String> splitParts(List<Map<String, ?>> rows, String sector) {
        List<String> out = new ArrayList<>();
        if (rows == null) return out;
        // ① 结构化列优先:同表区每行的 测量值1..5 依次摊平
        for (Map<String, ?> r : rows) {
            if (!sector.equals(str(r.get("表区")))) continue;
            for (int i = 1; i <= 5; i++) {
                Object v = r.get("测量值" + i);
                if (v == null) continue;
                String t = num(v);
                if (!t.isEmpty()) out.add(t);
                if (out.size() >= 5) return out;
            }
        }
        if (!out.isEmpty()) return out;
        // ② 回退:旧文本列按 / 拆
        for (Map<String, ?> r : rows) {
            if (!sector.equals(str(r.get("表区")))) continue;
            String v = str(r.get("实测数值"));
            if (v.isEmpty()) continue;
            for (String p : v.split("[/、,，\\s]+")) {
                String t = p.trim();
                if (!t.isEmpty()) out.add(t);
                if (out.size() >= 5) return out;
            }
        }
        return out;
    }

    /** 数值转显示串:去尾零(44.5000 → 44.5),null/0 视为未填 */
    private static String num(Object o) {
        if (o == null) return "";
        if (o instanceof java.math.BigDecimal bd) {
            if (bd.signum() == 0) return "";                       // 0 = 未填
            return bd.stripTrailingZeros().toPlainString();
        }
        if (o instanceof Number n) {
            double d = n.doubleValue();
            if (d == 0d) return "";
            return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
        }
        String t = String.valueOf(o).trim();
        return "0".equals(t) ? "" : t;
    }

    /** 明细「表区」→ 报表参数名(制程检验记录表的三个矩阵格) */
    private static final Map<String, String> SECTOR_PARAMS = Map.of(
            "外观", "外观结果",
            "尺寸", "尺寸结果",
            "重量", "重量结果");

    /** 取同表区明细,按「检验项目:实测值(判定)」拼接;无该表区则返回空串 */
    private static String joinSector(List<Map<String, ?>> rows, String sector) {
        if (rows == null || rows.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (Map<String, ?> r : rows) {
            Object sec = r.get("表区");
            if (sec == null || !sector.equals(String.valueOf(sec).trim())) continue;
            String item = str(r.get("检验项目"));
            String val = firstMeasure(r);           // 优先结构化测量值,回退旧文本列
            String judge = str(r.get("单项判定"));
            String one = item;
            if (!val.isEmpty()) one = one.isEmpty() ? val : one + ":" + val;
            if (!judge.isEmpty()) one = one.isEmpty() ? judge : one + "(" + judge + ")";
            if (one.isEmpty()) continue;
            if (sb.length() > 0) sb.append(" · ");
            sb.append(one);
        }
        return sb.toString();
    }

    /** 单个明细行的实测值:优先 测量值1..5(取首个非空非零),回退 实测数值 文本 */
    private static String firstMeasure(Map<String, ?> r) {
        for (int i = 1; i <= 5; i++) {
            Object v = r.get("测量值" + i);
            if (v == null) continue;
            String t = num(v);
            if (!t.isEmpty()) return t;
        }
        return str(r.get("实测数值"));
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /** 报表文件名(浏览器另存用):面板名-单据号.pdf;登记过精细模板的用模板名(销售订单-xxx.pdf) */
    public String fileName(String code, String docNo, String format) {
        return fileName(code, null, docNo, format);
    }

    public String fileName(String code, String panelCode, String docNo, String format) {
        String name;
        if (GENERIC_CODE.equals(code)) {
            PanelRegistry.PanelDef def = panelDefOrNull(panelCode);
            name = def == null || def.name() == null || def.name().isBlank() ? GENERIC_TEMPLATE_NAME : def.name();
        } else {
            name = dbTemplates(true).stream().filter(t -> t.code().equals(code)).map(ReportTemplate::name)
                    .findFirst()
                    .orElseGet(() -> loadRegistry().stream().filter(t -> t.code().equals(code))
                            .map(ReportTemplate::name).findFirst().orElse(code));
        }
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

    /** 编译(带缓存):DB 模板按 update_at 失效重编(上传即生效);classpath 模板进程内一次 */
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
            throw new IllegalStateException("报表模板编译失败(" + file + ")：" + rootMessage(e));
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

    // ============ 模板管理(上传/启停/删除;调用方先 requireAdmin,ADR-0002) ============

    /** 管理清单:DB 全部行(含停用);classpath 注册表条目无 id 不入列 */
    public List<Map<String, Object>> templateManageList() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ReportTemplate t : dbTemplates(true)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.id());
            m.put("code", t.code());
            m.put("panelCode", t.panelCode());
            m.put("name", t.name());
            m.put("enabled", t.enabled());
            m.put("updateBy", t.updatedAt() == null ? null : t.updatedAt().toLocalDateTime()
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            out.add(m);
        }
        return out;
    }

    /** 上传/覆盖模板:编译校验失败抛 400;同 code 覆盖并启用 */
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
        if (panelDefOrNull(panelCode) == null) throw new IllegalArgumentException("面板不存在：" + panelCode);
        jdbc.update(
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
        return out;
    }

    /** 启用/停用 */
    public void setEnabled(Long id, boolean enabled, String user) {
        int n = jdbc.update("UPDATE yj_report_template SET enabled = ?, update_by = ?, update_at = SYSDATETIME() WHERE id = ?",
                enabled ? "Y" : "N", user, id);
        if (n == 0) throw new IllegalArgumentException("模板不存在：id=" + id);
    }

    /** 删除(仅库内模板;classpath 注册表条目无 id 不可删) */
    public void delete(Long id) {
        List<String> codes = jdbc.queryForList("SELECT template_code FROM yj_report_template WHERE id = ?", String.class, id);
        if (codes.isEmpty()) throw new IllegalArgumentException("模板不存在：id=" + id);
        jdbc.update("DELETE FROM yj_report_template WHERE id = ?", id);
        compiled.remove(codes.get(0));
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
            out.add(new ReportTemplate(null, e.getKey(), r[0], r[1], r[2], null, true, null));
        }
        return List.copyOf(out);
    }
}
