package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.OqcReportService;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 出厂检验报告(QC_OQC_REPORT)专用入口 —— 2026-10-30。
 *
 * <p>用户口径:「这个页面制作为和当前三个检验单一样的实现,在我销售出库勾选货物的时候
 * 跳转到这个页面实现,然后就能走正常的审批形式」。</p>
 *
 * <p>为什么不做通用「选单」:销售出库单明细({@code bl_sale_out})**没有工单号/工单行号/入库单号**,
 * 出库批号 1112 行里 758 行是金蝶默认批号 {@code PC0000}、333 行为空,和检验单的批次号(完工日
 * 日期标签)完全没有交集 —— 通用选单拿不到可用的锚。故走专用入口:前端把勾选行的 id 传上来,
 * 后端逐行(一个产品一张)建报告草稿,明细由 {@link OqcReportService} 按三张检验单并集取数。</p>
 *
 * <p>权限:锚 QC_OQC_REPORT 可见性(与制程检验单同款,避免建出调用者自己都打不开的单)。</p>
 */
@RestController
@RequestMapping("/api/oqc")
public class OqcReportController {

    private static final String PANEL = "QC_OQC_REPORT";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final OqcReportService service;

    public OqcReportController(JdbcTemplate jdbc, PanelPermissionService perm, OqcReportService service) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.service = service;
    }

    /**
     * 由销售出库单勾选的明细行生成出厂检验报告。
     *
     * <p>请求体:{@code { "出库单号": "XSCK-2026-10-0001", "明细id": [1,2,3] }};
     * 明细 id 可省略(省略 = 该出库单全部未作废明细行)。</p>
     *
     * <p>返回:{@code { 单据编号: [...], gotoPanel: 'QC_OQC_REPORT', 提示: '...' }} ——
     * 前端按既有 gotoPanel 分支跳转到第一张。</p>
     *
     * <p>⚠ **不能**在这里标 {@code @Transactional}(2026-11-01 修):事务边界在
     * {@link OqcReportService#generateFromSaleOut} 那一层。以前这里也标了,服务层抛
     * {@code IllegalArgumentException} 后内层事务已被标记 rollback-only,外层提交时抛
     * {@code UnexpectedRollbackException} ⇒ 前端拿到的是 HTTP 500「服务异常:Transaction rolled back…」,
     * 而不是下面 catch 里设计的 400 中文原因(实测:出库单没有可生成行时提示不可读)。</p>
     */
    @PostMapping("/generate")
    public ApiResult<Map<String, Object>> generate(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL);
        String outNo = str(body.get("出库单号"));
        if (outNo.isEmpty()) return ApiResult.error(400, "请先选择销售出库单");
        List<Long> ids = new ArrayList<>();
        Object raw = body.get("明细id");
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                Long v = longOf(o);
                if (v != null) ids.add(v);
            }
        }
        String user = str(body.get("操作人"));
        try {
            List<String> created = service.generateFromSaleOut(outNo, ids, user.isEmpty() ? "admin" : user);
            if (created.isEmpty()) return ApiResult.error(400, "该出库单的明细行没有产品编码,无法生成报告");
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("单据编号", created);
            out.put("gotoPanel", PANEL);
            out.put("提示", created.size() > 1
                    ? "已按「一份报告=一个产品」生成 " + created.size() + " 张,跳转到第一张"
                    : "已生成 1 张出厂检验报告草稿");
            return ApiResult.ok(out);
        } catch (IllegalArgumentException e) {
            return ApiResult.error(400, e.getMessage());
        }
    }

    /** 预检:该出库单每行能定位到哪张成品检验单(前端提示用,不建单) */
    @PostMapping("/preview")
    public ApiResult<Map<String, Object>> preview(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL);
        String outNo = str(body.get("出库单号"));
        if (outNo.isEmpty()) return ApiResult.error(400, "请先选择销售出库单");
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT l.id, l.存货编码, l.存货名称, l.规格型号, l.批号, l.数量,"
                        + "  CASE WHEN l.批号 IS NULL OR LTRIM(RTRIM(l.批号)) = ''"
                        + "            OR UPPER(LTRIM(RTRIM(l.批号))) = 'PC0000' THEN NULL ELSE LTRIM(RTRIM(l.批号)) END AS 真实批号"
                        + " FROM bl_sale_out l WHERE l.单据编号 = ? AND ISNULL(l.asp_cancel,'N') <> 'Y' ORDER BY l.id", outNo);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> ln : lines) {
            Map<String, Object> row = new LinkedHashMap<>(ln);
            String prod = str(ln.get("存货编码")).replace("\t", "").replace("\n", "").replace("\r", "").trim();
            row.put("标准行数", jdbc.queryForObject(
                    "SELECT COUNT(*) FROM v_oqc_std WHERE 产品编号 = ?", Integer.class, prod));
            row.put("批次可用", str(ln.get("真实批号")).isEmpty() ? "否(出库未填真实批次)" : "是");
            out.add(row);
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("出库单号", outNo);
        res.put("明细", out);
        res.put("提示", "标准行数=0 的产品会被拦下(出货检验计划表还没录它);出库批号为 PC0000/空时按该产品最近一张已审核成品检验单带入");
        return ApiResult.ok(res);
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private Long longOf(Object o) {
        if (o == null) return null;
        try {
            return Long.valueOf(String.valueOf(o).trim());
        } catch (Exception e) {
            return null;
        }
    }
}
