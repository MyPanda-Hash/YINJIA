package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.MixScanService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 手机扫码 · **扫码混料**的接口(2026-11-18)。
 *
 * <h3>用户口径(原话)</h3>
 * 「然后在手机扫码里面加一个扫码混料的面版。逻辑:扫工单码,带出一级BOM(就是物料清单,
 *  之前生产领料的是组装物料清单),逐项扫物料码,自动获取电子秤的数量……提交保存一笔,
 *  全部扫完,整单保存。保存后自动打印,并且保留单据,重新扫码后进入可以补打印。」
 *
 * <h3>端点一览</h3>
 * <pre>
 *   GET  /api/px/mix/lines      扫工单码 → 工单行(plang)
 *   GET  /api/px/mix/bom        工单行的产品 → 一级BOM(物料清单 mate)
 *   GET  /api/px/mix/draft      本工单行还没整单保存的已扫料(重进页面恢复)
 *   GET  /api/px/mix/docs       本工单已保存的混料单(补打印入口)
 *   GET  /api/px/mix/doc?docNo= 一张混料单的抬头 + 明细(打印/明细页)
 *   POST /api/px/mix/scan       提交保存一笔(落 wo_mixing_list,标记 N)
 *   POST /api/px/mix/undo       撤回一笔(只删未保存的行)
 *   POST /api/px/mix/save       整单保存(取混料单号 + 标记 Y)
 *   POST /api/px/mix/printed    记一次打印(asp_print + 1,补打印也算)
 * </pre>
 *
 * <h3>权限</h3>
 * 页面级虚拟面板 {@link PagePanelRegistry#MIX_SCAN}:
 * 读接口要 {@code view}({@code requirePanelView}),写接口要 {@code save}/{@code print} 词
 * ({@code requireAnyPerm}) —— 与 {@code MOBILE_PICK} 的 view/pick/submit/print 同一套做法,
 * 让现场可以按岗位只给"能扫"或"能打印"。
 *
 * <p>为什么不用通用面板引擎:混料记录({@code wo_mixing_list})是报表型 flat 表,
 * 没有单据头/审批链,{@code /px/callButton} 那套(保存 = 提交流程)套不上去;
 * 而扫码是"一笔一笔即时落库"的作业流,需要自己的窄接口。
 */
@RestController
@RequestMapping("/api/px/mix")
public class MixScanController {

    /** 写操作权限词(与 PagePanelRegistry.MIX_SCAN 的动作集一致) */
    private static final String PERM_SAVE = "save";
    private static final String PERM_PRINT = "print";

    private final MixScanService mix;
    private final PanelPermissionService perm;

    public MixScanController(MixScanService mix, PanelPermissionService perm) {
        this.mix = mix;
        this.perm = perm;
    }

    /**
     * 扫工单码 → 工单行(工单号 + 行号;行号不传 = 整单全部行,页面取第一行)。
     *
     * @param orderNo 工单号(必填)
     * @param lineNo  工单行号(可选;{@code plang.pl_xc})
     */
    @GetMapping("/lines")
    public Map<String, Object> lines(@RequestParam String orderNo,
                                     @RequestParam(required = false) Integer lineNo) {
        perm.requirePanelView(PagePanelRegistry.MIX_SCAN);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", mix.workOrderLines(orderNo, lineNo == null ? 0 : lineNo));
        return out;
    }

    /**
     * 按产品编码取**一级BOM(物料清单)** —— 该工单该投哪些料、各投多少。
     *
     * @param productCode 产品编码
     */
    @GetMapping("/bom")
    public Map<String, Object> bom(@RequestParam String productCode) {
        perm.requirePanelView(PagePanelRegistry.MIX_SCAN);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", mix.bomOf(productCode));
        return out;
    }

    /**
     * 重进页面时恢复「扫了一半」的清单(标记 N 的行)。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号
     */
    @GetMapping("/draft")
    public Map<String, Object> draft(@RequestParam String orderNo,
                                     @RequestParam(required = false, defaultValue = "0") int lineNo) {
        perm.requirePanelView(PagePanelRegistry.MIX_SCAN);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", mix.draftRows(orderNo, lineNo));
        return out;
    }

    /**
     * 重新扫同一张工单码后,列出它已保存的混料单(补打印入口)。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号(可选;不传 = 该工单全部行)
     */
    @GetMapping("/docs")
    public Map<String, Object> docs(@RequestParam String orderNo,
                                    @RequestParam(required = false, defaultValue = "0") int lineNo) {
        perm.requirePanelView(PagePanelRegistry.MIX_SCAN);
        List<Map<String, Object>> list = mix.docsOf(orderNo, lineNo);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", list);
        out.put("条数", list.size());
        return out;
    }

    /**
     * 一张混料单的抬头 + 明细(打印代理与明细页共用;前端 {@code /px/slip/rows} 的同位接口)。
     *
     * @param docNo 混料单号(PL…)
     */
    @GetMapping("/doc")
    public ApiResult<Map<String, Object>> doc(@RequestParam String docNo) {
        perm.requirePanelView(PagePanelRegistry.MIX_SCAN);
        return ApiResult.ok(mix.docRows(docNo));
    }

    /**
     * **提交保存一笔**:扫一次物料 + 电子秤实际用量 → 落一行混料记录(标记 N)。
     *
     * @param body {工单号, 工单行id?, 工单行号?, 物料编号, 物料名称?, 计划用量?, 实际用量}
     */
    @PostMapping("/scan")
    public ApiResult<Map<String, Object>> scan(@RequestBody Map<String, Object> body) {
        perm.requireAnyPerm(PagePanelRegistry.MIX_SCAN, "扫码保存", PERM_SAVE);
        return ApiResult.ok(mix.saveScan(body, currentUser()));
    }

    /**
     * 撤回一笔(扫错料/秤取错):只删**未保存**的行。
     *
     * @param body {行id}
     */
    @PostMapping("/undo")
    public ApiResult<Map<String, Object>> undo(@RequestBody Map<String, Object> body) {
        perm.requireAnyPerm(PagePanelRegistry.MIX_SCAN, "扫码保存", PERM_SAVE);
        Object raw = body.get("行id");
        long id = raw instanceof Number n ? n.longValue() : 0L;
        if (id <= 0) throw new IllegalArgumentException("请提供要撤回的记录行");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("删除行数", mix.undoScan(id, currentUser()));
        return ApiResult.ok(out);
    }

    /**
     * **整单保存**:取混料单号 + 本单各行标记置 Y。
     *
     * @param body {工单号, 工单行号}
     */
    @PostMapping("/save")
    public ApiResult<Map<String, Object>> save(@RequestBody Map<String, Object> body) {
        perm.requireAnyPerm(PagePanelRegistry.MIX_SCAN, "扫码保存", PERM_SAVE);
        return ApiResult.ok(mix.saveDoc(body, currentUser()));
    }

    /**
     * 记一次打印(保存后自动打印 / 补打印都走这里):{@code asp_print + 1}。
     *
     * @param body {单据编号}
     */
    @PostMapping("/printed")
    public ApiResult<Map<String, Object>> printed(@RequestBody Map<String, Object> body) {
        perm.requireAnyPerm(PagePanelRegistry.MIX_SCAN, "打印", PERM_PRINT);
        Object raw = body.get("单据编号");
        String no = raw == null ? "" : String.valueOf(raw).trim();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", no);
        out.put("打印次数", mix.markPrinted(no));
        return ApiResult.ok(out);
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "" : auth.getName();
    }
}
