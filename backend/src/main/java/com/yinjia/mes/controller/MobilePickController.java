package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WoPickDocService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 手机扫码 · 生产领料(2026-10-30 重写)。
 *
 * <h3>用户口径(原话)</h3>
 * 「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』(和生产计划平级)导航下。
 *  工序报工不变。生产领料重写。
 *  现在是先做一个『生成工单领料/退料单』,先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的
 *  组织bom表。对应生成一条生产领料单和生产退料单的数据。
 *  然后进入『生产领料』的界面,这个界面上面是查询框和查询按钮。下面是列着每个单据的表头数据。
 *  如果点进去对应单据里面可以看到对应的领料单明细。并且中间还可以扫描工单号(直接查看对应的领料单据)。
 *  然后进入到那个单据……可以扫码(扫的是物料码,如果对应的物料码存在,就可以填写领料数量
 *  (数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的)和打印
 *  (打印就先只是先打印工单二维码,在生成生产领料单的时候自动打印一次)。
 *  全部领料完成后才可以提交转成材料出库单,并且将已完成的单据,在生产领料的界面放到下面的已完成区
 *  (并且已完成和未完成都可以展开和收缩)。
 *  生产退料与领料一致,只是退料默认数量为0。可以不进行退料操作,退料生成的应该是其他入库单,并且写好备注。」

 * <h3>BOM 来源(2026-10-30 二次确认)</h3>
 * 用户二次确认:「就是组装BOM表(RD_ASM_BOM),我去把数据录进去」。
 * 故取数口径 = 按工单行的**产品编号**取 {@code rd_asm_bom_head} 里最新一张未作废的表头,
 * 再取其 {@code rd_asm_bom_detail} 的 {@code 物料编号 / 物料名 / 物料规格 / 用量}。
 * （注:该表结构与面板都在册且有数据录入界面,只是当前 0 行 —— 用户去录。）
 *
 * <h3>为什么物料来源不能是「成型工艺清单」</h3>
 * {@code rd_mold_proc_detail} 的列是「物料种类/实际添加比例/单支物料含量/设计添加量」——
 * 那是**配比**不是可直接领用的数量,且当前 0 行;换算口径需要额外约定。
 * 组装BOM表直接就是「物料编号 + 用量」,与本页语义一一对应。
 *
 * <h3>本控制器不做的事</h3>
 * <ul>
 *   <li>**不直接写库存**:领料提交走 {@code ButtonService.callButton(MATERIAL_OUT, "审核")},
 *       由 {@link com.yinjia.mes.service.StockLedgerService} 按既有链路过账 —— 与所有别的单据同一条路,
 *       不另写 SQL 记账(2026-10-16 的教训:自己算一遍必然和看板分叉)。</li>
 *   <li>**不做批次追溯口径的改动**:出库批次仍按既有「先进先出拆批」逻辑,可用量仍按
 *       物料+仓库 判断(验收期权宜口径,见 {@code StockLedgerService.LOT_STRICT} 与
 *       「上线前必验-库存批次追溯」文档)。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/px/mobilePick")
public class MobilePickController {

    private static final Logger log = LoggerFactory.getLogger(MobilePickController.class);

    /** 领料单面板(材料出库单,业务类型「生产领料」) */
    private static final String PANEL_OUT = "MATERIAL_OUT";
    /** 退料单面板(其他入库单,业务类型「生产退料」;用户口径「退料生成的应该是其他入库单」) */
    private static final String PANEL_BACK = "OTHER_IN";
    /** 本页自身的页面级虚拟面板码(权限词:create / pick / submit / print) */
    private static final String PANEL_SELF = PagePanelRegistry.MOBILE_PICK;
    /** 领料业务类型(数据键,不翻译) */
    private static final String BIZ_PICK = "生产领料";
    /** 退料业务类型:金蝶「其他入库单」里这一类的业务类型写「生产退料」(数据键,不翻译) */
    private static final String BIZ_BACK = "生产退料";

    private final JdbcTemplate jdbc;
    private final WoPickDocService docs;
    private final ButtonService buttons;
    private final PanelPermissionService perm;

    public MobilePickController(JdbcTemplate jdbc, WoPickDocService docs,
                                ButtonService buttons, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.docs = docs;
        this.buttons = buttons;
        this.perm = perm;
    }

    // ══════════════════════════ ⓪ 开单工作台(批量生单) ══════════════════════════

    /**
     * 开单工作台:一次扫多张工单 → 逐个生成一对领料/退料单。
     *
     * <p>用户口径(2026-10-30 第二轮):「还有少了一个『生成工单领料/退料单』这个面版,
     *   这个面版的功能和生成领料是有区别的(不是一个面版)」,确认定位 =
     *   **电脑上的开单工作台(可扫多张工单批量生成、列表看已生成的单)**,且**只管生单**。
     *
     * <h3>为什么是"逐个成功、失败点名"而不是整批回滚</h3>
     * 开单工作台的使用者是计划员:一沓工单码挨个扫过去,中间难免有一张 BOM 没维护、或行号对不上。
     * 若整批事务回滚,前面 20 张已经建好的单会被一起撤销 —— 现场只会说"扫了半天全没了"。
     * ⇒ 逐张独立提交,**失败的写进 {@code 失败} 数组并带原因**,成功的照常返回单号
     * (与 {@code WorkOrderPickingService.toPicking} 同一口径)。
     *
     * @param body {items:[{woNo, line}], 打印?:bool}
     * @return {成功:[{工单号,行号,领料单号,退料单号,id,重复}], 失败:[{工单号,行号,原因}], 成功数, 失败数}
     */
    @PostMapping("/create/batch")
    public ApiResult<Map<String, Object>> createBatch(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.MOBILE_PICK_CREATE);
        perm.requireAnyPerm(PagePanelRegistry.MOBILE_PICK_CREATE, "生成领料/退料单", "create");
        requireLedger();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = body.get("items") instanceof List<?> l
                ? (List<Map<String, Object>>) l : List.of();
        if (items.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");

        boolean wantPrint = !Boolean.FALSE.equals(body.get("打印"));
        List<Map<String, Object>> ok = new ArrayList<>();
        List<Map<String, Object>> fail = new ArrayList<>();
        for (Map<String, Object> it : items) {
            String woNo = str(it.get("woNo"));
            int line = toInt(it.get("line"));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("工单号", woNo);
            row.put("工单行号", line);
            try {
                Map<String, Object> r = generateOne(woNo, line, wantPrint);
                row.putAll(r);
                ok.add(row);
            } catch (RuntimeException e) {
                row.put("原因", e.getMessage() == null ? "生单失败" : e.getMessage());
                fail.add(row);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("成功", ok);
        out.put("失败", fail);
        out.put("成功数", ok.size());
        out.put("失败数", fail.size());
        return ApiResult.ok(out);
    }

    /**
     * 开单工作台:已生成的单(按工单号/单号模糊查,含已完成)。
     *
     * <p>用户口径「列表看已生成的单」—— 开单的人要知道刚才扫的那些开了没有、开了哪几张单。
     * 数据源与生产领料**同一张台账**({@code wo_pick_doc}),只是入口不同;口径:
     * 未完成在前、已完成在后,各自按时间。
     */
    @GetMapping("/create/list")
    public ApiResult<Map<String, Object>> createList(@RequestParam(required = false) String keyword) {
        perm.requirePanelView(PagePanelRegistry.MOBILE_PICK_CREATE);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("open", docs.list(WoPickDocService.STATE_OPEN, keyword, 200));
        out.put("done", docs.list(WoPickDocService.STATE_DONE, keyword, 200));
        out.put("openTotal", docs.countByState(WoPickDocService.STATE_OPEN));
        out.put("doneTotal", docs.countByState(WoPickDocService.STATE_DONE));
        return ApiResult.ok(out);
    }

    // ══════════════════════════ ① 生成工单领料/退料单 ══════════════════════════

    /**
     * 扫工单 → 按组装BOM表展开用料 → 生成**一对**领料/退料单草稿。
     *
     * <p>用户口径:「先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的组织bom表。
     * 对应生成一条生产领料单和生产退料单的数据」+ 二次确认「我的工单二维码带有行号的,只生成那一行的就行」。
     *
     * <p>退料单数量**全部为 0**(用户口径「退料默认数量为0。可以不进行退料操作」)——
     * 0 数量行不参与库存记账({@code StockLedgerService.apply} 对 qty=0 直接 continue),
     * 所以这张草稿单挂着不会动库存;不做退料就整单作废、不产生其他入库单。
     *
     * @param body {woNo:工单号, line:工单行号(0=取该工单第一行)}
     * @return {id:台账主键, 领料单号, 退料单号, 工单:{...}, 领料明细:[...], 退料明细:[...], 打印:{...}}
     */
    @PostMapping("/generate")
    public ApiResult<Map<String, Object>> generate(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "生成领料/退料单", "create");
        requireLedger();

        String woNo = str(body.get("woNo"));
        int wantLine = toInt(body.get("line"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");
        return ApiResult.ok(generateOne(woNo, wantLine, true));
    }

    /**
     * 生单核心(两个面板共用):一个工单行 ⇒ 一对领料/退料单 + 台账行。
     *
     * <p>由单张接口 {@code /generate} 与开单工作台 {@code /create/batch} 共用 ——
     * 用户口径是"两个面板职能不同",但**生单口径必须完全一致**,所以这里只实现一次。
     *
     * @param woNo      工单号
     * @param wantLine  工单行号(0 = 取该工单第一行)
     * @param wantPrint 是否返回打印载荷(开单工作台可关掉自动打印)
     * @return 生单结果(与 {@code /generate} 的 data 同结构)
     */
    private Map<String, Object> generateOne(String woNo, int wantLine, boolean wantPrint) {
        Map<String, Object> wo = resolveWoLine(woNo, wantLine);
        String lineWoNo = str(wo.get("工单号"));
        int line = toInt(wo.get("工单行号"));

        // 已开过单就不重开 —— 用户第二次扫同一行时应当"进到那张单",而不是再开一对空单
        WoPickDocService.PickDoc exist = docs.findActive(lineWoNo, line);
        if (exist != null) {
            return existingResult(exist);
        }

        // 按产品编号取最新一张未作废的组装BOM表头 → 其明细行
        String productCode = str(wo.get("物料编码"));
        Map<String, Object> bomHead = latestAsmBom(productCode);
        if (bomHead == null) {
            throw new IllegalStateException("该工单的产品(" + (productCode.isEmpty() ? "未填产品编号" : productCode)
                    + ")在《组装BOM表》里还没有维护用料,无法生成领料单:"
                    + "请先到 研发管理 → 产品文件 → 组装BOM表 维护该产品的物料清单");
        }
        List<Map<String, Object>> bomLines = bomDetail(str(bomHead.get("单据编号")));
        if (bomLines.isEmpty()) {
            throw new IllegalStateException("《组装BOM表》" + str(bomHead.get("单据编号"))
                    + " 没有明细行(该产品没维护物料),无法生成领料单");
        }
        // 单位缺失时**在生单前**就给出点名提示(而不是让 ButtonService 抛"明细第 N 行计量单位不能为空")
        List<String> noUnit = new ArrayList<>();
        for (Map<String, Object> b : bomLines) {
            if (str(b.get("计量单位")).isEmpty()) noUnit.add(str(b.get("物料编号")));
        }
        if (!noUnit.isEmpty()) {
            throw new IllegalStateException("下列物料在存货档案里没有计量单位,无法生成领料单:"
                    + String.join("、", noUnit)
                    + ";请先到 基础资料 → 存货档案 补上单位(材料出库单的计量单位是必填)");
        }

        String user = currentUserName();
        // 仓库(2026-10-30 修正):工单行不带仓库,但材料出库单**审核过账时必须有仓库**
        // (StockLedgerService 按 (物料,仓库,批号) 写 kucun,仓库为空会抛
        //  「仓库档案不存在:[null],请先在基础档案-仓库中建立」—— 实测生单能成、提交才炸)。
        // ⇒ 生单时按**该物料的库存所在仓库**预填明细行仓库(优先恒亿仓/主料仓,其次库存最大的仓),
        //   现场扫物料时若换了仓库,前端会把实际仓库一起写回。
        String today = java.time.LocalDate.now().toString();
        String prodLine = str(wo.get("生产线"));

        // ── 领料单草稿(材料出库单,业务类型「生产领料」)
        List<Map<String, Object>> outItems = new ArrayList<>();
        String wh = "";          // 单头仓库(全部明细同仓时才有意义,见下)
        String whCode = "";
        for (int i = 0; i < bomLines.size(); i++) {
            Map<String, Object> b = bomLines.get(i);
            String code = str(b.get("物料编号"));
            // 每行按**该物料有库存的那个仓**预填(库存最大的仓优先,恒亿仓/主料仓优先于不良品仓)
            String[] lineWh = defaultWarehouseOf(code);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("行号", String.valueOf(i + 1));
            item.put("材料编码", code);
            item.put("材料名称", str(b.get("物料名")));
            item.put("规格型号", str(b.get("物料规格")));
            item.put("计量单位", str(b.get("计量单位")));
            // ⚠ 领料数量留 0:用户口径是"进了单据再扫物料码填数量",不是生单时就领满。
            //   0 数量行不会被审核过账(过账前提交会做"全部领完"闸门)。
            item.put("数量", 0);
            item.put("仓库", lineWh[0]);
            if (!lineWh[1].isEmpty()) item.put("仓库编码", lineWh[1]);
            item.put("明细备注", "生产领料·组装BOM表 " + str(bomHead.get("单据编号")));
            outItems.add(item);
            // 单头仓库:第一行有仓就记第一行的(全部同仓时才是"这单从哪个仓出")
            if (wh.isEmpty() && !lineWh[0].isEmpty()) { wh = lineWh[0]; whCode = lineWh[1]; }
        }
        // 单头仓库:全部明细同仓时才算"这单从哪个仓出"(多仓出库时单头留空,按明细行各自过账)
        // ⚠ 用 final 副本参与 lambda:wh 在循环里被赋值,lambda 不能捕获非 effectively-final 的变量
        final String whFinal = wh;
        boolean allSameWh = !whFinal.isEmpty() && outItems.stream()
                .allMatch(it -> whFinal.equals(str(it.get("仓库"))));
        String backWh = "";
        Map<String, Object> outForm = new LinkedHashMap<>();
        outForm.put("单据日期", today);
        outForm.put("单据编号", "");                  // 后端 FormNoService 生成
        outForm.put("业务类型", BIZ_PICK);
        outForm.put("加工单号", lineWoNo);
        outForm.put("工单行号", line);
        outForm.put("领用人", user);
        if (!prodLine.isEmpty()) outForm.put("生产线", prodLine);
        // 单头仓库只在"全部明细同仓"时填:多仓出库时单头留空,按明细行各自过账
        if (allSameWh) { outForm.put("仓库", wh); if (!whCode.isEmpty()) outForm.put("仓库编码", whCode); }
        outForm.put("备注", "手机扫码生单:工单 " + lineWoNo + " 第 " + line + " 行;按组装BOM表 "
                + str(bomHead.get("单据编号")) + " 展开 " + bomLines.size() + " 项用料");
        outForm.put("detail", Map.of("items", outItems));
        if (allSameWh) backWh = wh;

        String outNo = saveDoc(PANEL_OUT, outForm);

        // ── 退料单草稿(其他入库单,业务类型「生产退料」),数量全 0
        List<Map<String, Object>> backItems = new ArrayList<>();
        for (int i = 0; i < bomLines.size(); i++) {
            Map<String, Object> b = bomLines.get(i);
            String code = str(b.get("物料编号"));
            String[] lineWh = defaultWarehouseOf(code);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("序号", String.valueOf(i + 1));
            item.put("存货编码", code);
            item.put("存货名称", str(b.get("物料名")));
            item.put("规格型号", str(b.get("物料规格")));
            item.put("计量单位", str(b.get("计量单位")));
            item.put("仓库", lineWh[0]);
            if (!lineWh[1].isEmpty()) item.put("仓库编码", lineWh[1]);
            item.put("数量", 0);
            item.put("明细备注", "生产退料:数量为 0 表示本次不退料;不做退料时整单作废即可");
            backItems.add(item);
        }
        Map<String, Object> backForm = new LinkedHashMap<>();
        backForm.put("单据日期", today);
        backForm.put("单据编号", "");
        backForm.put("业务类型", BIZ_BACK);
        // 备注按用户口径「写好备注」:写清来源、为什么是 0、以及退料单最终去哪儿
        backForm.put("备注", "【生产退料】工单 " + lineWoNo + " 第 " + line + " 行 由手机扫码自动生成;"
                + "默认数量 0(不退料);有退料时按实收数量填写并审核,生成其他入库单入账;"
                + "整单不退料则作废本单");
        backForm.put("经手人", user);
        if (!backWh.isEmpty()) backForm.put("仓库", backWh);
        backForm.put("detail", Map.of("items", backItems));

        String backNo = saveDoc(PANEL_BACK, backForm);

        // ── 台账(唯一约束在这里挡"连扫两下")
        long id;
        try {
            id = docs.insert(lineWoNo, line, productCode, str(wo.get("产品名称")),
                    outNo, backNo, bomLines.size(), user);
        } catch (RuntimeException e) {
            // 并发:另一个手机刚给同一工单行建了单。把已存在的还给调用方,不要留半截数据
            // (⚠ 两张草稿单已经建出来了 —— 它们是空单,无害,但要在提示里说清楚)
            WoPickDocService.PickDoc raced = docs.findActive(lineWoNo, line);
            if (raced != null) {
                log.warn("手机扫码生单并发撞唯一约束:{}/{};已回落到既有台账 {}", lineWoNo, line, raced.id(), e);
                return existingResult(raced);
            }
            throw e;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("领料单号", outNo);
        out.put("退料单号", backNo);
        out.put("工单", wo);
        out.put("BOM单据编号", str(bomHead.get("单据编号")));
        out.put("物料项数", bomLines.size());
        out.put("状态", WoPickDocService.STATE_OPEN);
        out.put("重复", false);
        // 生单即自动打印工单二维码一次(用户口径「在生成生产领料单的时候自动打印一次」)。
        // 这里只把"要打什么"回给前端 —— 真正的出纸由前端打印通道或打印站点完成,
        // 服务端不持有打印机(服务端也可能在另一台机器上)。
        out.put("打印", wantPrint
                ? printPayload(lineWoNo, line, str(wo.get("产品名称")), str(wo.get("规格型号")))
                : null);
        return out;
    }

    // ══════════════════════════ ② 列表(未完成 / 已完成) ══════════════════════════

    /**
     * 生产领料列表。
     *
     * <p>用户口径:「这个界面上面是查询框和查询按钮。下面是列着每个单据的表头数据……
     * 并且将已完成的单据,在生产领料的界面放到下面的已完成区(并且已完成和未完成都可以展开和收缩)」。
     * ⇒ 一次返回两组(open / done),前端各自可折叠;keyword 同时按工单号/单号/产品名过滤。
     *
     * @param keyword 查询框内容(空 = 全部)
     */
    @GetMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestParam(required = false) String keyword) {
        perm.requirePanelView(PANEL_SELF);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("open", docs.list(WoPickDocService.STATE_OPEN, keyword, 200));
        out.put("done", docs.list(WoPickDocService.STATE_DONE, keyword, 200));
        out.put("openTotal", docs.countByState(WoPickDocService.STATE_OPEN));
        out.put("doneTotal", docs.countByState(WoPickDocService.STATE_DONE));
        return ApiResult.ok(out);
    }

    /**
     * 中间那个扫码框:扫工单号 → **直接定位到对应的领料单据**。
     *
     * <p>用户口径:「中间还可以扫描工单号(直接查看对应的领料单据)」。
     * 与生成接口的区别:这里**不生成**任何东西,只找已开的单把它打开。
     * 找不到时返回 {@code found:false} 而不是报错 —— 现场扫错了码不该弹红框,
     * 前端会提示"该工单行还没开过领料单,可以点『生成』"。
     */
    @GetMapping("/locate")
    public ApiResult<Map<String, Object>> locate(@RequestParam String woNo,
                                                 @RequestParam(required = false) Integer line) {
        perm.requirePanelView(PANEL_SELF);
        String no = str(woNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");

        Map<String, Object> out = new LinkedHashMap<>();
        WoPickDocService.PickDoc hit = null;
        if (line != null && line > 0) {
            hit = docs.findActive(no, line);
        } else {
            // 没带行号 ⇒ 按工单号找**全部**有效单;只有唯一的才直接打开,多条让用户选
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id FROM dbo.wo_pick_doc WHERE 工单号 = ? AND 状态 <> ? ORDER BY 工单行号",
                    no, WoPickDocService.STATE_VOID)) {
                if (hit == null) hit = docs.byId(((Number) r.get("id")).longValue());
                else { hit = null; break; }   // 多条 ⇒ 视为"未定位"
            }
            if (hit == null) {
                List<Map<String, Object>> many = jdbc.queryForList(
                        "SELECT id, 工单行号 FROM dbo.wo_pick_doc WHERE 工单号 = ? AND 状态 <> ? ORDER BY 工单行号",
                        no, WoPickDocService.STATE_VOID);
                out.put("found", false);
                out.put("candidates", many);
                out.put("hint", many.isEmpty() ? "no-doc" : "multi-line");
                return ApiResult.ok(out);
            }
        }
        if (hit == null) {
            out.put("found", false);
            out.put("candidates", List.of());
            out.put("hint", "no-doc");
            return ApiResult.ok(out);
        }
        out.put("found", true);
        out.put("id", hit.id());
        return ApiResult.ok(out);
    }

    // ══════════════════════════ ③ 单据详情 ══════════════════════════

    /**
     * 单据详情:一对单据(领料 + 退料)的头与明细,以及每项物料的库存可用量。
     *
     * <p>用户口径:「点进去对应单据里面可以看到对应的领料单明细」。
     * 返回结构刻意把**领料/退料两组明细并列**(前端做成两个页签,退料默认数量 0)。
     *
     * @param id 台账主键(列表页点进来带的)
     */
    @GetMapping("/doc")
    public ApiResult<Map<String, Object>> doc(@RequestParam long id) {
        perm.requirePanelView(PANEL_SELF);
        requireLedger();
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.id());
        out.put("工单号", d.woNo());
        out.put("工单行号", d.woLine());
        out.put("产品编号", d.productCode());
        out.put("产品名称", d.productName());
        out.put("领料单号", d.outNo());
        out.put("退料单号", d.backNo());
        out.put("状态", d.state());
        out.put("物料项数", d.itemCount());
        out.put("已领项数", d.doneCount());
        out.put("打印次数", d.printCount());
        out.put("创建人", d.creator());
        out.put("创建时间", d.createAt() == null ? "" : d.createAt().toLocalDateTime().toString().replace('T', ' '));
        out.put("提交人", d.submitter());
        out.put("提交时间", d.submitAt() == null ? "" : d.submitAt().toLocalDateTime().toString().replace('T', ' '));
        out.put("打印", printPayload(d.woNo(), d.woLine(), d.productName(), ""));

        // 工单行信息(抬头区显示产品/产线/排产数量)
        List<Map<String, Object>> woRows = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号,"
                        + " ISNULL(p.jldw,N'') AS 计量单位, ISNULL(p.scx,N'') AS 生产线,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.lot_no,N'') AS 批号"
                        + " FROM dbo.plang p WHERE p.pl_no = ? AND p.pl_xc = ? AND ISNULL(p.asp_cancel,'N') <> 'Y'",
                d.woNo(), d.woLine());
        out.put("工单", woRows.isEmpty() ? Map.of() : woRows.get(0));

        out.put("领料明细", linesOf(d.outNo(), "pick"));
        out.put("退料明细", linesOf(d.backNo(), "back"));
        return ApiResult.ok(out);
    }

    /**
     * 扫物料码:确认**这个物料码存在**,并返回它的库存可用量、批次明细与"允许填多少"。
     *
     * <p>用户口径:「扫的是物料码,如果对应的物料码存在,就可以填写领料数量
     * (数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的」。
     *
     * <p>返回里带 {@code 允许上限} = 该物料**跨批次合计**的库存总量(用户 2026-10-30 口径:
     * 「该物料库存总量(跨批次合计),超出自动拆到下一批」),前端输入框按它夹住,
     * 批次由前端沿用既有 {@code autoAllocateFifo} 自动拆到下一批。
     *
     * @param body {id:台账主键, code:物料编码, batch:码里带的批次(可空), side:pick|back}
     */
    @PostMapping("/scanMaterial")
    public ApiResult<Map<String, Object>> scanMaterial(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));
        String code = str(body.get("code"));
        String side = "back".equals(str(body.get("side"))) ? "back" : "pick";
        if (id <= 0) throw new IllegalArgumentException("单据标识缺失,请重新打开单据");
        if (code.isEmpty()) throw new IllegalArgumentException("请先扫描或输入物料编码");

        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        if (WoPickDocService.STATE_DONE.equals(d.state())) {
            throw new IllegalStateException("这张单已经提交,不能再改数量");
        }

        // ① 这个物料码必须在**本单的明细里**(领料/退料各自的明细) —— 「对应的物料码存在」的第一个含义
        String no = "back".equals(side) ? d.backNo() : d.outNo();
        List<Map<String, Object>> items = linesOf(no, side);
        Map<String, Object> hit = null;
        for (Map<String, Object> it : items) {
            if (code.equals(str(it.get("编码")))) { hit = it; break; }
        }
        if (hit == null) {
            throw new IllegalStateException("物料 " + code + " 不在本单的"
                    + ("back".equals(side) ? "退料" : "领料") + "明细里:请核对是否扫错了料(本单只含组装BOM表里的用料)");
        }

        // ② 库存可用量(按 物料+仓库 汇总;批次明细另给,前端沿用先进先出拆批)
        String wh = str(hit.get("仓库"));
        List<Map<String, Object>> stock = stockRows(code, wh);
        double total = 0;
        for (Map<String, Object> r : stock) total += num(r.get("现存量"));
        total = round4(total);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编码", code);
        out.put("名称", str(hit.get("名称")));
        out.put("规格", str(hit.get("规格")));
        out.put("单位", str(hit.get("单位")));
        out.put("行号", hit.get("行号"));
        out.put("仓库", wh);
        out.put("BOM用量", num(hit.get("BOM用量")));
        out.put("当前数量", num(hit.get("数量")));
        // 允许上限:领料看库房有多少;退料看这单领了多少(退料不能退得比领的多)
        double cap = "back".equals(side) ? num(hit.get("数量")) : total;
        out.put("可用总量", total);
        out.put("允许上限", round4(Math.max(0, cap)));
        out.put("批次", stock);
        out.put("扫到批次", str(body.get("batch")));
        return ApiResult.ok(out);
    }

    /**
     * 扫物料后保存这一行的数量(可多次调用:扫一次填一次)。
     *
     * <p>用户口径:「数量可以随意填写,只要仓库数量足够,多少都可以」——
     * 故这里**只拦库存不足**(领料)与**退料超领**(退料),不拦"超过 BOM 用量"。
     *
     * @param body {id, side:pick|back, code, qty, batches:[{批号,仓库,仓库编码,数量}]}
     */
    @PostMapping("/setQty")
    public ApiResult<Map<String, Object>> setQty(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));
        String side = "back".equals(str(body.get("side"))) ? "back" : "pick";
        String code = str(body.get("code"));
        double qty = round4(num(body.get("qty")));
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        if (WoPickDocService.STATE_DONE.equals(d.state())) throw new IllegalStateException("这张单已经提交,不能再改数量");
        if (code.isEmpty()) throw new IllegalArgumentException("物料编码不能为空");
        if (qty < 0) throw new IllegalArgumentException("数量不能为负数");

        String no = "back".equals(side) ? d.backNo() : d.outNo();
        String panel = "back".equals(side) ? PANEL_BACK : PANEL_OUT;
        List<Map<String, Object>> items = linesOf(no, side);
        Map<String, Object> hit = null;
        for (Map<String, Object> it : items) if (code.equals(str(it.get("编码")))) { hit = it; break; }
        if (hit == null) throw new IllegalStateException("物料 " + code + " 不在本单的明细里");

        // 库存守卫(领料):超出跨批次合计就拦 —— 用户口径「只要仓库数量足够,多少都可以」
        if (!"back".equals(side) && qty > 0) {
            double avail = 0;
            for (Map<String, Object> r : stockRows(code, str(hit.get("仓库")))) avail += num(r.get("现存量"));
            if (round4(qty) > round4(avail)) {
                throw new IllegalStateException("库存不足:物料 " + code + " 当前可用 " + round4(avail)
                        + ",本次要填 " + qty + ";请减少数量或先补货");
            }
        }
        // 退料守卫:不能退得比领的多
        if ("back".equals(side) && qty > 0) {
            List<Map<String, Object>> pickItems = linesOf(d.outNo(), "pick");
            double picked = 0;
            for (Map<String, Object> it : pickItems) if (code.equals(str(it.get("编码")))) picked = num(it.get("数量"));
            if (qty > picked) {
                throw new IllegalStateException("退料数量不能超过已领数量(该物料已领 " + round4(picked) + ")");
            }
        }

        // 直接改明细行的数量(草稿单可改)。批次留痕由 batches 写进明细备注。
        writeQty(panel, no, str(hit.get("行号")), str(hit.get("原始行号")), qty, body, side, code);

        int done = 0;
        for (Map<String, Object> it : linesOf(d.outNo(), "pick")) if (num(it.get("数量")) > 0) done++;
        docs.updateProgress(id, done, items.size(), currentUserName());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("领料明细", linesOf(d.outNo(), "pick"));
        out.put("退料明细", linesOf(d.backNo(), "back"));
        int totalItems = linesOf(d.outNo(), "pick").size();
        int doneNow = 0;
        for (Map<String, Object> it : linesOf(d.outNo(), "pick")) if (num(it.get("数量")) > 0) doneNow++;
        out.put("物料项数", totalItems);
        out.put("已领项数", doneNow);
        // 「全部领料完成后才可以提交」的判据就这一个 —— 由服务端算,前端只管显示
        out.put("可以提交", totalItems > 0 && doneNow >= totalItems);
        return ApiResult.ok(out);
    }

    /**
     * 提交:全部领完 → 审核领料单 → 转成材料出库单(过账)。
     *
     * <p>用户口径:「全部领料完成后才可以提交转成材料出库单」。
     * 这是本页**唯一动库存**的动作 —— 走 {@code callButton(MATERIAL_OUT, "审核")},
     * 与在材料出库单面板里手点「审核」是完全同一条路(过账/流水/工单回写全部照旧)。
     */
    @PostMapping("/submit")
    public ApiResult<Map<String, Object>> submit(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "提交转材料出库单", "submit");
        requireLedger();
        long id = toLong(body.get("id"));
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        if (WoPickDocService.STATE_DONE.equals(d.state())) {
            Map<String, Object> again = new LinkedHashMap<>();
            again.put("已提交", true);
            again.put("领料单号", d.outNo());
            again.put("状态", d.state());
            return ApiResult.ok(again);
        }

        List<Map<String, Object>> items = linesOf(d.outNo(), "pick");
        if (items.isEmpty()) throw new IllegalStateException("这张领料单没有明细行,无法提交(请作废后重新生成)");
        List<String> missing = new ArrayList<>();
        for (Map<String, Object> it : items) {
            if (num(it.get("数量")) <= 0) missing.add(str(it.get("编码")));
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("还有 " + missing.size() + " 项物料没填领料数量,不能提交:"
                    + String.join("、", missing.subList(0, Math.min(8, missing.size())))
                    + (missing.size() > 8 ? " 等" : ""));
        }

        String user = currentUserName();
        // 走既有审核链:材料出库单审核 → StockLedgerService 过账 → 流水 + 工单回写 ll_no2
        // ⚠ 单号键名是「编号」:ButtonService.requireNo(...) 只认 formData.get("编号"),
        //   写「单据编号」会被挡回"缺少表单编号"(2026-10-30 实测踩到)。
        buttons.callButton(PANEL_OUT, "审核", docNoForm(d.outNo()), null);

        // 退料:本单退料数量若全为 0 且用户不做退料 → 整单作废(不产生其他入库单)
        //
        // 用户口径:「退料默认数量为0。可以不进行退料操作,退料生成的应该是其他入库单,并且写好备注」。
        // ⚠ 作废口径(2026-10-30 实测踩到):**不能用 callButton(OTHER_IN, "删除")** ——
        //   ButtonService.delete 对 doc 面板先判 {@code docStatusOf} 必须是「草稿」,
        //   而 OTHER_IN 的作废态落在 yj_doc_status.canceled;这张单生出来没多久,
        //   状态推导在某些时序下会给出别的值 ⇒ 抛"仅草稿状态可删除",被我下面的 catch 吞掉,
        //   结果退料单没作废、台账还把它的单号清空了(数据对不上)。
        //   这里直接按**同一落点**写软删:yj_doc_status.canceled='Y' + 行/头 asp_cancel='Y'
        //   (与 voidDoc 完全一致的终态),并**核对影响行数**,失败就抛出来而不是静默。
        String backNo = d.backNo();
        boolean backVoided = false;
        if (backNo != null && !backNo.isBlank()) {
            double backQty = 0;
            for (Map<String, Object> it : linesOf(backNo, "back")) {
                if (num(it.get("数量")) > 0) backQty += num(it.get("数量"));
            }
            if (backQty <= 0) {
                backVoided = voidDocQuietly(PANEL_BACK, backNo, user);
                if (!backVoided) {
                    // 作废失败不阻断提交(领料已经过账了);但**必须**把单号留在台账上,
                    // 否则界面显示"没有退料单"而库里挂着一张空草稿 —— 那才是对不上账
                    log.warn("提交后作废空退料单 {} 失败(领料已过账,退料单保留待人工处理)", backNo);
                }
            }
        }

        docs.markDone(id, user);
        // 退料单真作废掉了 ⇒ 台账上把单号清空(界面上这张单就是"没有退料单");
        // 没作废成功就把单号留着,让人能在其他入库单里找到它处理
        if (backVoided) {
            jdbc.update("UPDATE dbo.wo_pick_doc SET 退料单号 = NULL WHERE id = ?", id);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("已提交", true);
        out.put("领料单号", d.outNo());
        out.put("退料单号", backVoided ? null : backNo);
        out.put("退料已作废", backVoided);
        out.put("状态", WoPickDocService.STATE_DONE);
        out.put("说明", backVoided
                ? "领料单已审核并过账为材料出库单;本次没有退料,退料单已作废"
                : "领料单已审核并过账为材料出库单");
        return ApiResult.ok(out);
    }

    /**
     * 作废一张单据(软删),落点与 {@code ButtonService.voidDoc} **完全一致**:
     * {@code yj_doc_status.canceled='Y'} + 行/头 {@code asp_cancel='Y'}。
     *
     * <p>为什么不用 {@code callButton(panel, "删除")}:它先判「仅草稿状态可删除」,
     * 而"草稿"是按 {@code docStatusOf} 现推的 —— 生单后立刻提交时,状态推导的时序会让它报错,
     * 于是"不做退料 ⇒ 退料单作废"这一步静默失败(2026-10-30 实测:退料单留着、台账单号被清空)。
     * 这里直接按终态写,并核对影响行数。
     *
     * @return true = 确实作废了;false = 单子本来就不存在(没什么可作废的)
     */
    private boolean voidDocQuietly(String panelCode, String no, String user) {
        int n = jdbc.update("MERGE dbo.yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no)"
                        + " ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no"
                        + " WHEN MATCHED THEN UPDATE SET canceled = 'Y'"
                        + " WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled) VALUES (s.panel_code, s.doc_no, 'Y');",
                panelCode, no);
        // 行/头软删(与 voidDoc 同一套列;表里没有该列时忽略,不阻断)
        for (String sql : new String[]{
                "UPDATE dbo.bl_other_in SET asp_cancel = 'Y' WHERE 单据编号 = ?",
                "UPDATE dbo.bd_other_in SET asp_cancel = 'Y' WHERE 单据编号 = ?"}) {
            try {
                jdbc.update(sql, no);
            } catch (RuntimeException e) {
                log.debug("作废 {} 时软删语句失败(忽略):{}", no, e.getMessage());
            }
        }
        return n > 0;
    }

    /** 打/重打工单二维码:只记打印次数,内容由前端按 woQrText 同口径渲染 */
    @PostMapping("/reprint")
    public ApiResult<Map<String, Object>> reprint(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "打印", "print");
        requireLedger();
        long id = toLong(body.get("id"));
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        docs.bumpPrint(id, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("打印", printPayload(d.woNo(), d.woLine(), d.productName(), ""));
        return ApiResult.ok(out);
    }

    /** 工单二维码内容(与 print-formats.woQrText 同一口径:公司代码@工单号@1000+行号) */
    @PostMapping("/printAck")
    public ApiResult<Void> printAck(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        requireLedger();
        long id = toLong(body.get("id"));
        if (id > 0) docs.bumpPrint(id, currentUserName());
        return ApiResult.ok(null);
    }

    // ══════════════════════════ 内部取数/写数 ══════════════════════════

    /** 台账表没跑迁移时给出可读提示(不要抛成 500) */
    private void requireLedger() {
        if (!docs.tableReady()) {
            throw new IllegalStateException("配对台账表 wo_pick_doc 还没建:请先执行迁移 "
                    + "tools/migrate-wo-pick-doc-20261030.sql(两个账套都要跑)");
        }
    }

    /** 已经开过单时的返回(重复扫同一工单行走这里,不再新建) */
    private Map<String, Object> existingResult(WoPickDocService.PickDoc d) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.id());
        out.put("领料单号", d.outNo());
        out.put("退料单号", d.backNo());
        out.put("状态", d.state());
        out.put("物料项数", d.itemCount());
        out.put("重复", true);      // 前端据此提示"该工单行已经开过单,已帮你打开"
        out.put("打印", null);      // 重复时不重复打印
        return out;
    }

    /**
     * 解析工单行。
     *
     * <p>行号优先(用户口径「我的工单二维码带有行号的,只生成那一行的就行」);
     * 没带行号时取该工单的第一行(与工序报工 context 接口同一退化口径)。
     */
    private Map<String, Object> resolveWoLine(String woNo, int line) {
        String sql = "SELECT TOP 1 p.pl_no AS 工单号, p.pl_xc AS 工单行号, ISNULL(p.dm,N'') AS 物料编码,"
                + " ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.jldw,N'') AS 计量单位,"
                + " ISNULL(p.scx,N'') AS 生产线, ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.lot_no,N'') AS 批号,"
                + " ISNULL(p.完工状态,N'') AS 完工状态"
                + " FROM dbo.plang p WHERE p.pl_no = ? AND ISNULL(p.asp_cancel,'N') <> 'Y'"
                + (line > 0 ? " AND p.pl_xc = ?" : "") + " ORDER BY p.pl_xc";
        List<Map<String, Object>> rows = line > 0
                ? jdbc.queryForList(sql, woNo, line)
                : jdbc.queryForList(sql, woNo);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException(line > 0
                    ? "工单 " + woNo + " 没有第 " + line + " 行(或该行已作废),请核对工单二维码"
                    : "没有找到工单 " + woNo + "(已作废的单查不到)");
        }
        Map<String, Object> wo = new LinkedHashMap<>(rows.get(0));
        wo.put("仓库", "");   // plang 无仓库列:仓库由材料出库单明细的行仓库决定
        return wo;
    }

    /** 最新一张未作废的组装BOM表头(按产品编号) */
    private Map<String, Object> latestAsmBom(String productCode) {
        if (productCode == null || productCode.isBlank()) return null;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 单据编号, 产品编号, 产品名称"
                        + " FROM dbo.rd_asm_bom_head"
                        + " WHERE 产品编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL(单据日期,'') DESC, id DESC",
                productCode.trim());
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 组装BOM表明细行(物料编号/物料名/物料规格/用量),用量解析成数字。
     *
     * <p>⚠ 组装BOM表**没有「计量单位」列**(它的列只有 物料编号/物料名/物料规格/外观要求/用量),
     * 而材料出库单的明细把「计量单位」设为必填 —— 生单时若不带就被 {@code ButtonService.save}
     * 挡回「明细第 1 行计量单位不能为空」(2026-10-30 实测踩到)。
     * ⇒ 单位**从存货档案 bs_inv 带出**(与材料出库单里手选商品的取值同源),
     *   档案里也没有时留空,由保存时的既有校验给出可读错误(不在这里猜)。
     */
    private List<Map<String, Object>> bomDetail(String bomNo) {
        List<Map<String, Object>> raw = jdbc.queryForList(
                "SELECT ISNULL(d.物料编号,N'') AS 物料编号, ISNULL(d.物料名,N'') AS 物料名,"
                        + " ISNULL(d.物料规格,N'') AS 物料规格, ISNULL(d.用量,N'') AS 用量,"
                        + " ISNULL(i.计量单位,N'') AS 计量单位, ISNULL(i.规格型号,N'') AS 档案规格"
                        + " FROM dbo.rd_asm_bom_detail d"
                        + " LEFT JOIN dbo.bs_inv i ON i.存货编码 = d.物料编号 AND ISNULL(i.asp_cancel,'N') <> 'Y'"
                        + " WHERE d.单据编号 = ? AND ISNULL(d.asp_cancel,'N') <> 'Y'"
                        + " ORDER BY TRY_CAST(d.序号 AS int), d.id", bomNo);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : raw) {
            if (str(r.get("物料编号")).isEmpty()) continue;   // 没有物料编号的行不参与领料
            Map<String, Object> m = new LinkedHashMap<>(r);
            // BOM 上的规格优先(那是这一版工艺的写法),没有就用存货档案的规格
            String spec = str(r.get("物料规格"));
            if (spec.isEmpty()) m.put("物料规格", str(r.get("档案规格")));
            m.put("计量单位", str(r.get("计量单位")));
            out.add(m);
        }
        return out;
    }

    /**
     * 保存一张草稿单,返回单号(空单号由 FormNoService 生成)。
     *
     * <p>⚠ 单号键名是 {@code 编号}:{@code ButtonService.save} 走的是
     * {@code result(no, status)} → {@code {编号, 单据状态}}(实测字段,不是「单据编号」)。
     * 三个键都兜一下,免得以后有人改了 result() 这里静默取不到单号。
     */
    @SuppressWarnings("unchecked")
    private String saveDoc(String panelCode, Map<String, Object> form) {
        Map<String, Object> res = buttons.callButton(panelCode, "保存", form, null);
        Object no = null;
        if (res != null) {
            no = res.get("编号");
            if (no == null) no = res.get("单据编号");
            if (no == null) no = res.get("docNo");
        }
        String s = no == null ? "" : String.valueOf(no).trim();
        if (s.isEmpty()) {
            throw new IllegalStateException(panelCode + " 保存成功但没有返回单号,无法建立配对台账 "
                    + "(ButtonService.save 的返回应含「编号」键)");
        }
        return s;
    }

    /**
     * 读单据明细行(领料/退料统一形态)。
     *
     * @param no 单据编号
     * @param side pick=领料(bl_material_out) / back=退料(bl_other_in)
     */
    private List<Map<String, Object>> linesOf(String no, String side) {
        if (no == null || no.isBlank()) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        if ("back".equals(side)) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, 序号, ISNULL(存货编码,N'') AS 编码, ISNULL(存货名称,N'') AS 名称,"
                            + " ISNULL(规格型号,N'') AS 规格, ISNULL(计量单位,N'') AS 单位,"
                            + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(数量,0) AS 数量, ISNULL(批号,N'') AS 批号, ISNULL(明细备注,N'') AS 明细备注"
                            + " FROM dbo.bl_other_in WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY 序号, id", no)) {
                out.add(normalizeLine(r, "序号", "存货编码"));
            }
        } else {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, 行号, ISNULL(材料编码,N'') AS 编码, ISNULL(材料名称,N'') AS 名称,"
                            + " ISNULL(规格型号,N'') AS 规格, ISNULL(计量单位,N'') AS 单位,"
                            + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(数量,0) AS 数量, ISNULL(批号,N'') AS 批号, ISNULL(明细备注,N'') AS 明细备注"
                            + " FROM dbo.bl_material_out WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY TRY_CAST(行号 AS int), id", no)) {
                out.add(normalizeLine(r, "行号", "材料编码"));
            }
        }
        return out;
    }

    private Map<String, Object> normalizeLine(Map<String, Object> r, String lineCol, String codeCol) {
        Map<String, Object> m = new LinkedHashMap<>();
        Object rawLine = r.get(lineCol);
        m.put("行号", rawLine == null ? "" : String.valueOf(rawLine));
        m.put("原始行号", rawLine == null ? "" : String.valueOf(rawLine));
        m.put("编码", r.get("编码"));
        m.put("名称", r.get("名称"));
        m.put("规格", r.get("规格"));
        m.put("单位", r.get("单位"));
        m.put("仓库", r.get("仓库"));
        m.put("仓库编码", r.get("仓库编码"));
        m.put("数量", r.get("数量"));
        m.put("批号", r.get("批号"));
        m.put("明细备注", r.get("明细备注"));
        m.put("BOM用量", 0);
        m.put("codeCol", codeCol);
        return m;
    }

    /** 该物料的库存批次行(v_stock_pick 口径:物料+仓库+批号,只出有货的) */
    private List<Map<String, Object>> stockRows(String code, String wh) {
        String sql = "SELECT 存货编码, 存货名称, 规格型号, 计量单位, 仓库, 仓库编码, 批号, 现存量"
                + " FROM dbo.v_stock_pick WHERE 存货编码 = ?"
                + (wh == null || wh.isBlank() ? "" : " AND (仓库 = ? OR 仓库编码 = ?)")
                + " AND 现存量 > 0 ORDER BY 批号";
        List<Map<String, Object>> rows = (wh == null || wh.isBlank())
                ? jdbc.queryForList(sql, code)
                : jdbc.queryForList(sql, code, wh, wh);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("批号", r.get("批号"));
            m.put("仓库", r.get("仓库"));
            m.put("仓库编码", r.get("仓库编码"));
            m.put("现存量", r.get("现存量"));
            out.add(m);
        }
        return out;
    }

    /**
     * 把某一行明细的数量写回去(草稿单可改)。
     *
     * <p>批次留痕写进明细备注(用户口径「批次处理也保留之前的」:沿用先进先出拆批,
     * 具体扣了哪些批次写在备注里,过账时按 (物料,仓库,批号) 核销)。
     */
    @SuppressWarnings("unchecked")
    private void writeQty(String panel, String no, String line, String rawLine,
                          double qty, Map<String, Object> body, String side, String code) {
        String note = "";
        Object batchesRaw = body.get("batches");
        if (batchesRaw instanceof List<?> list && !list.isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                Map<String, Object> b = (Map<String, Object>) o;
                double q = num(b.get("数量"));
                if (q <= 0) continue;
                parts.add((str(b.get("批号")).isEmpty() ? "无批次" : str(b.get("批号"))) + "=" + q);
            }
            if (!parts.isEmpty()) note = ("back".equals(side) ? "退料批次:" : "领料批次:") + String.join(", ", parts);
        }
        String table = "back".equals(side) ? "bl_other_in" : "bl_material_out";
        String lineCol = "back".equals(side) ? "序号" : "行号";
        if (note.isEmpty()) {
            jdbc.update("UPDATE dbo." + table + " SET 数量 = ? WHERE 单据编号 = ? AND " + lineCol + " = ?",
                    qty, no, line);
        } else {
            jdbc.update("UPDATE dbo." + table + " SET 数量 = ?, 明细备注 = ? WHERE 单据编号 = ? AND " + lineCol + " = ?",
                    qty, note, no, line);
        }
        // 批号列:拆批后本行只记第一条批号(多批次在明细备注里),保持"单据上能看见批号"
        if (batchesRaw instanceof List<?> list && !list.isEmpty()) {
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                String lot = str(((Map<String, Object>) o).get("批号"));
                if (!lot.isEmpty()) {
                    jdbc.update("UPDATE dbo." + table + " SET 批号 = ? WHERE 单据编号 = ? AND " + lineCol + " = ?",
                            lot, no, line);
                    break;
                }
            }
        }
    }

    /** 打印载荷:工单二维码内容 + 抬头信息(前端按这个渲染标签/走打印站点) */
    private Map<String, Object> printPayload(String woNo, int line, String productName, String spec) {
        Map<String, Object> m = new LinkedHashMap<>();
        // 与 print-formats.woQrText 同口径:公司代码@工单号@(1000+行号);公司代码全库为 '0'
        m.put("二维码内容", "0@" + woNo + "@" + (1000 + Math.max(1, line)));
        m.put("工单号", woNo);
        m.put("工单行号", line);
        m.put("产品名称", productName);
        m.put("规格型号", spec);
        m.put("标题", "生产领料单");
        return m;
    }

    /**
     * 该物料的默认出库仓库 = **有库存、且库存最多的那个仓**。
     *
     * <p>为什么必须预填:材料出库单审核过账走 {@code StockLedgerService.apply},它按
     * (物料, 仓库, 批号) 写 {@code kucun};仓库为空会抛
     * 「仓库档案不存在:[null],请先在基础档案-仓库中建立」—— 生单能成、**提交才炸**,
     * 现场看到的症状是"料都领完了却提交不了"(2026-10-30 实测踩到)。
     *
     * <p>排序口径:
     * <ol>
     *   <li>只取 {@code 现存量 > 0} 的仓(没货的仓不该被预填);</li>
     *   <li>**不良品仓排最后**(编码/名称含「不良」「废」)——不良品不是可领用料;</li>
     *   <li>其余按库存量倒序,库存最多的优先(现场最常见的主料仓)。</li>
     * </ol>
     *
     * @return {仓库名, 仓库编码};该物料完全没有库存时返回 {"", ""}(不猜仓,让现场自己选)
     */
    private String[] defaultWarehouseOf(String invCode) {
        if (invCode == null || invCode.isBlank()) return new String[]{"", ""};
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码, ISNULL(现存量,0) AS 现存量"
                        + " FROM dbo.v_stock_pick WHERE 存货编码 = ? AND 现存量 > 0", invCode.trim());
        String bestName = "", bestCode = "";
        double bestQty = -1;
        int bestRank = Integer.MAX_VALUE;
        for (Map<String, Object> r : rows) {
            String name = str(r.get("仓库"));
            if (name.isEmpty()) continue;
            int rank = (name.contains("不良") || name.contains("废")) ? 1 : 0;
            double qty = num(r.get("现存量"));
            // 先比"是不是不良品仓",再比库存量
            if (rank < bestRank || (rank == bestRank && qty > bestQty)) {
                bestRank = rank;
                bestQty = qty;
                bestName = name;
                bestCode = str(r.get("仓库编码"));
            }
        }
        return new String[]{bestName, bestCode};
    }

    // ── 小工具 ──

    /**
     * callButton 的单据载荷:单号键必须是「编号」。
     *
     * <p>{@code ButtonService.requireNo} 只读 {@code formData.get("编号")},而保存返回的也是
     * {@code {编号, 单据状态}} —— 两处键名一致。写「单据编号」会报"缺少表单编号"(实测)。
     */
    private static Map<String, Object> docNoForm(String no) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("编号", no);
        return f;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int toInt(Object o) {
        if (o == null) return 0;
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private static long toLong(Object o) {
        if (o == null) return 0;
        try { return (long) Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return round4(Double.parseDouble(String.valueOf(o).trim())); } catch (RuntimeException e) { return 0; }
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
