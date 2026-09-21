package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.panel.PanelRuntimeService;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.DevTaskService;
import com.yinjia.mes.service.PanelConfigService;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.ReportColumnSettingsService;
import com.yinjia.mes.service.UsageLogService;
import com.yinjia.mes.service.VoucherFlowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.LinkedHashMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Map;

/** 通用面板接口(对齐 light-mes:仅依赖 PanelRuntimeService 契约) */
@RestController
@RequestMapping("/api/px")
public class PxController {

    private final PanelRuntimeService service;
    private final PanelConfigService configService;
    private final ReportColumnSettingsService reportColumnSettingsService;
    private final VoucherFlowService voucherFlowService;
    private final PanelRegistry registry;
    private final UsageLogService usageLog;
    private final JdbcTemplate jdbc;
    private final DevTaskService devTaskService;
    private final ButtonService buttons;
    private final PanelPermissionService perm;

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PxController.class);

    public PxController(PanelRuntimeService service, PanelConfigService configService,
                        ReportColumnSettingsService reportColumnSettingsService,
                        VoucherFlowService voucherFlowService,
                        PanelRegistry registry, UsageLogService usageLog, JdbcTemplate jdbc,
                        DevTaskService devTaskService, ButtonService buttons,
                        PanelPermissionService perm) {
        this.service = service;
        this.configService = configService;
        this.reportColumnSettingsService = reportColumnSettingsService;
        this.voucherFlowService = voucherFlowService;
        this.registry = registry;
        this.usageLog = usageLog;
        this.jdbc = jdbc;
        this.devTaskService = devTaskService;
        this.buttons = buttons;
        this.perm = perm;
    }

    /** 产品开发:下游面板元数据(矩阵列头) */
    @GetMapping("/rdDev/meta")
    public ApiResult<List<Map<String, String>>> rdDevMeta() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(DevTaskService.devPanelMeta());
    }

    /** 产品开发:产品信息表侧边栏按钮状态(是否已下发 / 能否分发责任人 / 二级审核人) */
    @GetMapping("/rdDev/buttonState")
    public ApiResult<Map<String, Object>> rdDevButtonState(@RequestParam String docNo) {
        perm.requirePanelView("RD_PROD_INFO");
        String productCode = productCodeOf(docNo);
        Map<String, Object> out = new LinkedHashMap<>(devTaskService.buttonState(productCode));
        // 2026-09-20 两级审批:分发责任人是**二级审核人的动作**,前端据此置灰/显示
        out.put("canAssign", buttons.canAssignDev(docNo));
        out.put("l2Approver", buttons.l2ApproverName(docNo));
        out.put("isL2Approver", buttons.isL2Approver(docNo));
        out.put("assigns", devTaskService.assignsOf(productCode));
        return ApiResult.ok(out);
    }

    /** 产品开发:四文件分工状态(分发责任人弹窗回显) */
    @GetMapping("/rdDev/assignState")
    public ApiResult<Map<String, Object>> rdDevAssignState(@RequestParam String docNo) {
        perm.requirePanelView("RD_PROD_INFO");
        Map<String, Object> out = new LinkedHashMap<>(devTaskService.assignState(productCodeOf(docNo)));
        out.put("docNo", docNo);
        out.put("canAssign", buttons.canAssignDev(docNo));
        out.put("l2Approver", buttons.l2ApproverName(docNo));
        return ApiResult.ok(out);
    }

    /** 产品开发:启用账号清单(一级通过选二级审核人 / 分发责任人选人;非管理员也可读 ⇒ 不能复用管理端接口) */
    @GetMapping("/rdDev/users")
    public ApiResult<List<Map<String, Object>>> rdDevUsers() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.enabledUsers());
    }

    /** 单据编号 → 产品编号(产品信息表侧边栏用;查不到返回空串) */
    private String productCodeOf(String docNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 产品编号 FROM rd_prod_info_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
        if (rows.isEmpty() || rows.get(0).get("产品编号") == null) return "";
        return String.valueOf(rows.get(0).get("产品编号")).trim();
    }

    /** 产品开发:已下发产品的开发矩阵 */
    @GetMapping("/rdDev/board")
    public ApiResult<List<Map<String, Object>>> rdDevBoard() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.board());
    }

    /**
     * 产品文件列表(RD_PROD_DOCLIST)—— 设计《产品开发系统需求汇总》sheet「文件汇总表」那张表。
     *
     * 【不新建业务逻辑】列头与状态推导**直接复用** DevTaskService:
     *   · 4 个文件列 = DEV_PANELS 的 4 个下游面板(成型工艺清单/组装工艺清单/规格书/出货检验计划表)
     *   · 每格状态 = statusOf(产品编号, 面板) ⇒ 未开发/开发中/开发审核中/开发完毕
     * 本端点只做**只读拼装**:为每行补上「是否受控 / 受控日期」
     *   —— 设计流程图 5.1/5.2/5.3/5.4 尾部都是「保存/提交 → 提交后审批 → **审批后自动受控**」,
     *      故受控是**派生值**:该产品的 4 张文件**全部已归档**即为受控,受控日期取最后一份的归档时点。
     *
     * 状态存储查询:4 个面板的产品键字段不同(规格书是「编号」,其余是「产品编号」),
     * 用 DevTaskService.productKeyOf(panel) 取,避免写死。
     */
    @GetMapping("/prodDocList")
    public ApiResult<Map<String, Object>> prodDocList() {
        perm.requirePanelView("RD_PROD_DOCLIST");

        // 列头(顺序即矩阵列顺序):面板编码 + 显示名
        List<Map<String, String>> columns = DevTaskService.devPanelMeta();

        List<Map<String, Object>> rows = devTaskService.board();

        // 各面板"已归档单据的产品键 → 归档时点"。产品键字段各面板不同(规格书是「编号」,其余是「产品编号」),
        // 用 DevTaskService.productKeyOf(panel) 取;单据号列用面板自己的 groupCol。
        Map<String, Map<String, String>> archivedAt = new LinkedHashMap<>();  // 面板 → (产品键 → 归档时点)
        for (String panel : DevTaskService.devPanelCodes()) {
            Map<String, String> m = new LinkedHashMap<>();
            try {
                String table = registry.panel(panel).headTable();
                String keyCol = DevTaskService.productKeyOf(panel);
                String docCol = pickGroupCol(panel);
                jdbc.query("SELECT t.[" + keyCol + "] AS k, MAX(s.archived_at) AS at "
                                + "FROM " + table + " t "
                                + "JOIN yj_doc_status s ON s.panel_code = ? AND s.doc_no = t.[" + docCol + "] "
                                + "WHERE ISNULL(s.archived,'N') = 'Y' AND ISNULL(t.asp_cancel,'N') <> 'Y' "
                                + "GROUP BY t.[" + keyCol + "]",
                        rs -> {
                            String k = rs.getString("k");
                            if (k != null && !k.isBlank()) {
                                Object at = rs.getObject("at");
                                m.put(k, at == null ? "" : String.valueOf(at));
                            }
                        }, panel);
            } catch (Exception e) {
                // 某面板表/列缺失时降级:该面板不参与受控推导,矩阵主体仍可用
                log.warn("[RD_PROD_DOCLIST] 受控推导跳过 panel={}: {}", panel, e.getMessage());
            }
            archivedAt.put(panel, m);
        }

        for (Map<String, Object> row : rows) {
            String productCode = String.valueOf(row.get("产品编号"));
            @SuppressWarnings("unchecked")
            Map<String, String> cells = (Map<String, String>) row.get("cells");
            boolean allDone = cells != null && !cells.isEmpty()
                    && cells.values().stream().allMatch(DevTaskService.STATUS_DONE::equals);
            String lastAt = "";
            for (String panel : DevTaskService.devPanelCodes()) {
                String at = archivedAt.getOrDefault(panel, Map.of()).get(productCode);
                if (at != null && at.compareTo(lastAt) > 0) lastAt = at;
            }
            row.put("是否受控", allDone ? "是" : "否");
            row.put("受控日期", allDone ? lastAt : "");
            row.put("产品负责人", row.get("产品负责人") == null ? "" : row.get("产品负责人"));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("columns", columns);
        out.put("rows", rows);
        return ApiResult.ok(out);
    }

    /** 该面板的单据号列(状态表 doc_no 的对应列):优先 group_col,缺省「单据编号」 */
    private String pickGroupCol(String panelCode) {
        String g = registry.panel(panelCode).groupCol();
        return g == null || g.isBlank() ? "单据编号" : g;
    }

    /** 产品开发:参照标注(某面板下,这批产品是 未开发 / 已开发) */
    @PostMapping("/rdDev/annotate")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, String>> rdDevAnnotate(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("RD_PROD_INFO");
        String panelCode = body.get("panelCode") == null ? "" : String.valueOf(body.get("panelCode"));
        Object codes = body.get("productCodes");
        List<String> list = codes instanceof List<?> l
                ? l.stream().map(v -> v == null ? "" : String.valueOf(v)).toList()
                : List.of();
        return ApiResult.ok(devTaskService.annotateBatch(panelCode, list));
    }

    /** 规格书两级分发:某产品的分配总览(总负责人弹窗用;docs=可分配候选单,2026-09-12 改为绑定已有单据) */
    @GetMapping("/specAssign")
    public ApiResult<Map<String, Object>> specAssignState(@RequestParam String code) {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.specAssignState(code));
    }

    /** 规格书两级分发:单张规格书单的分配(编辑闸门/侧栏展示用;hasAssign=false 不受封锁约束) */
    @GetMapping("/specAssign/doc")
    public ApiResult<Map<String, Object>> specAssignDoc(@RequestParam String no) {
        perm.requirePanelView("RD_SPEC_DOC");
        return ApiResult.ok(devTaskService.specAssignOfDoc(no));
    }

    /**
     * 「自动填充规格书」数据源:按产品编号取对应规格书的表头 + 检验要求明细行。
     *
     * <p>【为什么要专门开一个端点】规格书的 编号(=产品键)在通用查询链路里**看不见**——
     * QueryService.loadDocs 对每个 doc 面板都会执行 doc.put("编号", 单据编号),把真 编号 覆盖成单据号
     * (那个键在纸张右上角被「编号：」占用)。所以 getFormDescriptor / queryFormDataList 都取不到真值,
     * 只能像 prodDocList 一样直接读 head 表。
     *
     * <p>【产品编号 → 规格书单 的解析顺序】
     * <ol>
     *   <li>rd_spec_assign(产品编号=?)—— 分发写下的正式映射,带 责任人/负责人,是权威源;</li>
     *   <li>rd_spec_doc_head.编号 = ? —— 分发时盖在产品键列上的章(ButtonService 分发路径写)。</li>
     * </ol>
     * 两条都按 id 倒序取最新。同一产品可能分发了多张规格书(不同规格书种类),
     * 故用 matched 回报命中数,前端提示「按哪一张填的」,不让用户猜。
     *
     * <p>明细只取 [表区]='检验要求' 的行 —— 与 ButtonService.specTestRowsSnapshot 同款口径,
     * 那是规格书「检验项目及检验标准」页的行;其余表区(修订记录/物料清单…)不参与出货检验。
     */
    @GetMapping("/specByProduct")
    public ApiResult<Map<String, Object>> specByProduct(@RequestParam String code) {
        perm.requirePanelView("RD_INSP_PLAN");
        String productCode = code == null ? "" : code.trim();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("found", false);
        out.put("matched", 0);
        out.put("单据编号", "");
        out.put("编号", "");
        out.put("客户项目名称", "");
        out.put("产品类别", "");
        out.put("整体规格参数", "");
        out.put("items", List.of());
        if (productCode.isEmpty()) return ApiResult.ok(out);

        List<String> nos = specDocNosOfProduct(productCode);
        out.put("matched", nos.size());
        if (nos.isEmpty()) return ApiResult.ok(out);

        // 门禁(2026-09-21 用户口径):出货检验计划表按规格书自动带入检验方法,必须规格书**填写并提交审批完**
        // 才行 —— 未定稿的检验方法填进出货检验计划,等于把没批准的检验口径发到产线。
        // 门禁落在服务端(客户端绕不过);挑不到就把"是哪一张、什么状态"带回去,界面据此把原因说清楚。
        String no = "";
        String blockedNo = "";
        String blockedStatus = "";
        for (String cand : nos) {
            String st = specStatusOf(cand);
            if (specUsable(st)) { no = cand; break; }
            if (blockedNo.isEmpty()) { blockedNo = cand; blockedStatus = st; }
        }
        if (no.isEmpty()) {
            out.put("reason", "not_approved");
            out.put("规格书编号", blockedNo);
            out.put("规格书状态", blockedStatus);
            return ApiResult.ok(out);
        }
        out.put("状态", specStatusOf(no));
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT 单据编号, ISNULL(编号, N'') AS 编号, ISNULL(客户项目名称, N'') AS 客户项目名称,"
                        + " ISNULL(产品类别, N'') AS 产品类别, ISNULL(整体规格参数, N'') AS 整体规格参数"
                        + " FROM rd_spec_doc_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (heads.isEmpty()) return ApiResult.ok(out);

        Map<String, Object> h = heads.get(0);
        out.put("found", true);
        for (String k : List.of("单据编号", "编号", "客户项目名称", "产品类别", "整体规格参数")) {
            Object v = h.get(k);
            out.put(k, v == null ? "" : String.valueOf(v));
        }
        out.put("items", jdbc.queryForList(
                "SELECT ISNULL(序号, N'') AS 序号, ISNULL(检验项目, N'') AS 检验项目,"
                        + " ISNULL(检验要求, N'') AS 检验要求, ISNULL(检验方法, N'') AS 检验方法,"
                        + " ISNULL(检验依据, N'') AS 检验依据"
                        + " FROM rd_spec_doc_detail WHERE 单据编号 = ? AND 表区 = N'检验要求' ORDER BY id", no));
        return ApiResult.ok(out);
    }

    /** 规格书可用状态:填写并提交审批完(审批通过 ⇒ 已归档/已审核)。草稿/审批中/修改中/已作废一律不可用 */
    private static boolean specUsable(String status) {
        return "已审核".equals(status) || "已归档".equals(status);
    }

    /**
     * 规格书单据状态 —— 口径与 DevTaskService 的分发弹窗(CASE 派生)一致:
     * 已作废 &gt; 已中止 &gt; 删除申请中 &gt; 修改申请中 &gt; 审批中 &gt; 修改中 &gt; 已归档 &gt; 已审核 &gt; 草稿。
     * 读不到(表缺失/无状态行)一律按不可用返回"草稿" —— 宁可不带入,也不能拿没审批的口径去填出货检验计划。
     */
    private String specStatusOf(String no) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废' WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'"
                            + " WHEN ISNULL(s.deleting,'N')='Y' THEN N'删除申请中' WHEN ISNULL(s.modify_state,N'')='R' THEN N'修改申请中'"
                            + " WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' WHEN ISNULL(s.modify_state,N'')='Y' THEN N'修改中'"
                            + " WHEN ISNULL(s.archived,'N')='Y' THEN N'已归档'"
                            + " WHEN ISNULL(s.shr,N'') <> N'' THEN N'已审核' ELSE N'草稿' END AS status"
                            + " FROM rd_spec_doc_head h LEFT JOIN yj_doc_status s"
                            + " ON s.panel_code = 'RD_SPEC_DOC' AND s.doc_no = h.单据编号"
                            + " WHERE h.单据编号 = ?", no);
            if (rows.isEmpty() || rows.get(0).get("status") == null) return "草稿";
            return String.valueOf(rows.get(0).get("status"));
        } catch (Exception e) {
            return "草稿";
        }
    }

    /** 产品编号 → 该产品已分发的规格书单号(最新在前,去重);rd_spec_assign 优先,退回 head.编号 盖章 */
    private List<String> specDocNosOfProduct(String productCode) {
        List<String> nos = new java.util.ArrayList<>();
        String[] sqls = {
                "SELECT 单据编号 FROM rd_spec_assign WHERE 产品编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC",
                "SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC",
        };
        for (String sql : sqls) {
            try {
                for (Map<String, Object> r : jdbc.queryForList(sql, productCode)) {
                    Object v = r.get("单据编号");
                    String s = v == null ? "" : String.valueOf(v);
                    if (!s.isBlank() && !nos.contains(s)) nos.add(s);
                }
            } catch (Exception e) {
                // 表缺失时降级:另一条路径仍可用(与 prodDocList 的受控推导同款处理)
                log.warn("[specByProduct] 规格书单解析跳过 product={}: {}", productCode, e.getMessage());
            }
        }
        return nos;
    }

    /** 选单来源查询(已审核 + 占用过滤,对齐 T+ SelectVoucher)。
     *  权限按目标面板校验(选单是为了在目标面板生单,来源数据是选单必需的参照)。 */
    @PostMapping("/voucherFlow/sources")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> voucherFlowSources(@RequestBody Map<String, Object> body) {
        String sourcePanel = String.valueOf(body.getOrDefault("sourcePanel", ""));
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        if (!targetPanel.isBlank()) perm.requirePanelView(targetPanel);
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        return ApiResult.ok(voucherFlowService.sources(sourcePanel, targetPanel, condition, pageNo, pageSize));
    }

    /** 选单生单后写占用(来源行不再出现在选单列表;删除下游草稿自动释放) */
    @PostMapping("/voucherFlow/link")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> voucherFlowLink(@RequestBody Map<String, Object> body) {
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        if (!targetPanel.isBlank()) perm.requireButton(targetPanel, "保存");
        voucherFlowService.link(
                String.valueOf(body.getOrDefault("sourcePanel", "")),
                String.valueOf(body.getOrDefault("sourceNo", "")),
                String.valueOf(body.getOrDefault("sourceKey", "items")),
                String.valueOf(body.getOrDefault("targetPanel", "")),
                String.valueOf(body.getOrDefault("targetNo", "")),
                String.valueOf(body.getOrDefault("targetKey", "items")),
                body.get("targetOffset") == null ? 0 : Integer.parseInt(String.valueOf(body.get("targetOffset"))),
                String.valueOf(body.getOrDefault("businessType", "")));
        return ApiResult.ok(null);
    }

    /** 报表栏目设置读取(报表表头筛选与排序补丁) */
    @GetMapping("/reportColumnSettings")
    public ApiResult<Map<String, Object>> getReportColumnSettings(@RequestParam String panelCode) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(reportColumnSettingsService.load(panelCode));
    }

    /** 报表栏目设置保存(报表表头筛选与排序补丁) */
    @PostMapping("/reportColumnSettings")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveReportColumnSettings(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelView(panelCode);
        Map<String, Object> settings = (Map<String, Object>) body.getOrDefault("settings", Map.of());
        reportColumnSettingsService.save(panelCode, settings);
        return ApiResult.ok(null);
    }

    @GetMapping("/getPanelConfig")
    public ApiResult<Map<String, Object>> getPanelConfig(@RequestParam String panelCode) {
        return ApiResult.ok(service.getPanelConfig(panelCode));
    }

    @GetMapping("/getPermMatrix")
    public ApiResult<Map<String, Object>> getPermMatrix(@RequestParam String panelCode) {
        return ApiResult.ok(service.getPermMatrix(panelCode));
    }

    @GetMapping("/getNewFormPermMatrix")
    public ApiResult<Map<String, Object>> getNewFormPermMatrix(@RequestParam String panelCode,
                                                               @RequestParam(required = false) String operationName) {
        return ApiResult.ok(service.getNewFormPermMatrix(panelCode, operationName));
    }

    @GetMapping("/getFormDescriptor")
    public ApiResult<Map<String, Object>> getFormDescriptor(@RequestParam String panelCode,
                                                            @RequestParam String code) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(service.getFormDescriptor(panelCode, code));
    }

    /** 项目实施计划:终止审批状态查询(申请终止/审批按钮渲染依据;无终止单则 data=null) */
    @GetMapping("/planTerm")
    public ApiResult<Map<String, Object>> planTerm(@RequestParam String code) {
        perm.requirePanelView("RD_PLAN");
        return ApiResult.ok(buttons.termRowOf(code));
    }

    /** 项目进度查询:按项目编号(=立项申请文档编号)取该项目全部数据记录表单据(8 面板,含状态) */
    @GetMapping("/progress/dataSheets")
    public ApiResult<List<Map<String, Object>>> progressDataSheets(@RequestParam String code) {
        perm.requirePanelView("RD_PROGRESS");
        return ApiResult.ok(buttons.progressDataSheets(code));
    }

    @PostMapping("/queryFormDataList")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> queryFormDataList(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelView(panelCode);
        String keyword = body.get("keyword") == null ? null : String.valueOf(body.get("keyword"));
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        return ApiResult.ok(service.queryFormDataList(panelCode, keyword, condition, pageNo, pageSize));
    }

    @GetMapping("/getApprovalHistory")
    public ApiResult<List<Map<String, Object>>> getApprovalHistory(@RequestParam String panelCode,
                                                                   @RequestParam String code) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(service.getApprovalHistory(panelCode, code));
    }

    @PostMapping("/callButton")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> callButton(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        String buttonName = String.valueOf(body.getOrDefault("buttonName", ""));
        // 服务端按钮权限(2026-09-12):按 yj_role_panel.perms 词表映射校验,管理员恒过;
        // 此前仅审批类动作在 ButtonService 内校验,保存/删除/提交等对任何登录用户开放
        // 2026-09-20 例外:产品信息表的二级节点——被一级选定的二级审核人即使没有 audit 词
        //   (如 cp 这类普通账号)也可「审批通过/审批驳回」,否则两级审批第二级无人能点。
        Map<String, Object> formData0 = (Map<String, Object>) body.getOrDefault("formData", Map.of());
        if (!perm.isL2ApproverOf("RD_PROD_INFO", panelCode, buttonName, formData0)) {
            perm.requireButton(panelCode, buttonName);
        }
        Map<String, Object> formData = formData0;
        Map<String, Object> buttonParam = (Map<String, Object>) body.getOrDefault("buttonParam", Map.of());
        ApiResult<Map<String, Object>> result = ApiResult.ok(service.callButton(panelCode, buttonName, formData, buttonParam));
        // 使用记录:业务按钮动作(成功后才记;表单类动作附单据号)
        recordUsage(panelCode, buttonName, docNoOf(panelCode, formData), request);
        return result;
    }

    @PostMapping("/deleteForms")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> deleteForms(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requireButton(panelCode, "删除");
        List<String> rowCodes = (List<String>) body.getOrDefault("rowCodes", List.of());
        service.deleteForms(panelCode, rowCodes);
        // 使用记录:删除动作(单据号为删除清单)
        recordUsage(panelCode, "删除", String.join(",", rowCodes), request);
        return ApiResult.ok(null);
    }

    /** 纯视图类按钮(查询/刷新等),不算「权限使用」,不记录。 */
    private static final java.util.Set<String> VIEW_ONLY_BUTTONS = java.util.Set.of("刷新", "查找");

    /** 使用记录埋点:面板名 + 按钮名 + 单据号 + 当前账号 + IP(查询/刷新类纯浏览动作不记)。 */
    private void recordUsage(String panelCode, String buttonName, String docNo, HttpServletRequest request) {
        try {
            if (buttonName == null || VIEW_ONLY_BUTTONS.contains(buttonName)) return;
            String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                    : SecurityContextHolder.getContext().getAuthentication().getName();
            if (username == null) return;
            List<Map<String, Object>> u = jdbc.queryForList(
                    "SELECT real_name FROM yj_user WHERE username = ?", username);
            String realName = u.isEmpty() ? username : String.valueOf(u.get(0).get("real_name"));
            String panelName = panelCode;
            try {
                PanelRegistry.PanelDef def = registry.panel(panelCode);
                if (def != null) panelName = def.name();
            } catch (Exception ignored) { /* 面板名取不到时回退 panelCode */ }
            usageLog.recordAction(username, realName, panelName, buttonName, docNo, clientIp(request));
        } catch (Exception ignored) { /* 埋点失败不影响业务 */ }
    }

    /** 单据号:优先前端审批动作传的「编号」键,其次面板单号字段(自动编号列)在当前表单数据中的值;取不到返回 null。 */
    private String docNoOf(String panelCode, Map<String, Object> formData) {
        if (formData == null || formData.isEmpty()) return null;
        // 前端提交审批/审批通过/审批驳回的 formData 只带 {编号, 审批意见}(见 PanelxList/PanelxForm)
        for (String key : List.of("编号", "单据编号", "记录编号")) {
            Object v = formData.get(key);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v);
        }
        try {
            PanelRegistry.PanelDef def = registry.panel(panelCode);
            if (def != null) {
                PanelRegistry.FieldDef g = def.byCol(def.groupCol());
                String label = g == null ? "单据编号" : g.label();
                Object v = formData.get(label);
                if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v);
            }
        } catch (Exception e) {
            // 面板名取不到时忽略
        }
        return null;
    }

    /** 客户端 IP(同 AuthController;带代理时取 X-Forwarded-For 首段)。 */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    /** 表格列自定义:保存排序/栏名/显隐 */
    @PostMapping("/saveColumnPrefs")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveColumnPrefs(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        List<Map<String, Object>> columns = (List<Map<String, Object>>) body.getOrDefault("columns", List.of());
        configService.saveColumnPrefs(panelCode, columns);
        return ApiResult.ok(null);
    }

    /** 表头调整:保存表头字段的排序/栏名/显隐(hidden+visible 同开同关) */
    @PostMapping("/saveHeaderPrefs")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveHeaderPrefs(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        List<Map<String, Object>> columns = (List<Map<String, Object>>) body.getOrDefault("columns", List.of());
        configService.saveHeaderPrefs(panelCode, columns);
        return ApiResult.ok(null);
    }
}
