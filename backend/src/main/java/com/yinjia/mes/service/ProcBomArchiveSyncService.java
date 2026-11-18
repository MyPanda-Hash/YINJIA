package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工艺清单归档 → 基础数据清单的同步(2026-11-18)。
 *
 * <h3>用户口径(原话)</h3>
 * <ul>
 *   <li>「帮我将这个组装物料清单的基础数据表能被组装工艺清单中的bom表填入进去。只要已归档状态的
 *       内容即可。参照产品信息表和物料清单的实现模式。」</li>
 *   <li>「烧结工艺也要实现一个混料物料清单能被这里两种烧结工艺清单中的bom表填入进去。」
 *       「就按照当前烧结工艺清单中bom的字段获取就行,然后需要增加一个字段来区分两种烧结,
 *        从那个烧结单中获取就是那个烧结的产品」</li>
 *   <li>追问澄清(2026-11-18):方向是**工艺清单 → 基础数据**,「我填写组装工艺清单的bom表
 *       就能在当前的组装物料清单中看到」;同一产品按**产品编号**定位,重复归档覆盖同一张。</li>
 * </ul>
 *
 * <h3>实现模式(照抄「产品信息表 → 物料清单」)</h3>
 * 产品信息表(RD_PROD_INFO)归档时由 {@code ButtonService.markArchived} →
 * {@code syncProdBomToMaterialList} 把 BOM 明细灌进物料清单(WLBOM/mate)。本服务是同一件事的
 * 两个新链路,挂的也是**同一个归档入口**({@code markArchived},保存即归档/审批通过/再归档
 * 四条路都汇到它),因此天然满足「只要已归档状态的内容」——保存中/审批中的单据不写:
 * <pre>
 *   RD_ASM_PROC     归档  →  bs_asm_bom(组装物料清单 ASM_BOM)        按 产品编号 定位
 *   RD_MOLD_PROC    归档  →  bs_mix_bom(混料物料清单 MIX_BOM)        按 产品编号 + 烧结类型
 *   RD_X_SINTER     归档  →  bs_mix_bom                              (烧结类型 = X烧结工艺清单)
 * </pre>
 *
 * <h3>覆盖语义(用户拍板)</h3>
 * 「产品编号应该是唯一的,按照产品编号填入就行」⇒ 同一产品重复归档**覆盖上一次那一张**,
 * 不再增生单据:
 * <ul>
 *   <li>组装:定位键 = 产品编码。优先找「来源 = 组装工艺清单 …」(本服务上一次写的)那张;
 *       没有才退回该产品当前会被取料端选中的那张(默认BOM=是 → 版本号倒序 → 单据编号倒序);
 *       一张都没有才新建(号池前缀 BOM),且**该产品原本没有任何 BOM 时**才把新单置
 *       「默认BOM=是」(用户口径:不改变现有领料/报工取数口径)。</li>
 *   <li>混料:定位键 = 产品编号 + 烧结类型(同一产品的两种烧结各一张,互不覆盖),
 *       号池前缀 MIX。</li>
 * </ul>
 * ⚠ 刻意**不删**别的来源(金蝶导入)的 BOM 单据:那 3640 行是生产领料/报工在用的标准 BOM,
 * 删掉等于换料。要「完全以工艺清单为准」是另一件事,需用户另行拍板。
 *
 * <h3>失败策略</h3>
 * 归档是业务主流程,同步失败**只记 warning 不抛**(与 {@code syncProdBomToMaterialList} 同口径):
 * 单据卡在未归档比"基础数据没同步"更糟;而同步可随时靠重新归档重算 —— 幂等。
 */
@Service
public class ProcBomArchiveSyncService {

    private static final Logger log = LoggerFactory.getLogger(ProcBomArchiveSyncService.class);

    /** 组装工艺清单(单) */
    public static final String PANEL_ASM_PROC = "RD_ASM_PROC";
    /** 组装物料清单(基础数据,表 bs_asm_bom) */
    public static final String PANEL_ASM_BOM = "ASM_BOM";
    /** 烧结工艺清单(单) */
    public static final String PANEL_MOLD_PROC = "RD_MOLD_PROC";
    /** X烧结工艺清单(单) */
    public static final String PANEL_X_SINTER = "RD_X_SINTER";
    /** 混料物料清单(基础数据,表 bs_mix_bom) */
    public static final String PANEL_MIX_BOM = "MIX_BOM";

    /** 组装工艺清单里 BOM 表的「表区」值(见 recordSheetConfigs.RD_ASM_PROC_DT_BOM.filterVal) */
    private static final String ASM_BOM_AREA = "物料清单";
    /** 两张烧结工艺清单里配方表的「表区」值 */
    private static final String SINTER_RECIPE_AREA = "配方表";

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;
    private final FormNoService formNoService;

    public ProcBomArchiveSyncService(JdbcTemplate jdbc, PanelRegistry registry, FormNoService formNoService) {
        this.jdbc = jdbc;
        this.registry = registry;
        this.formNoService = formNoService;
    }

    // ================================================================ 组装侧

    /**
     * 组装工艺清单归档 → 组装物料清单(ASM_BOM / bs_asm_bom)。
     *
     * <p>字段映射(工艺清单 BOM 表 → 组装物料清单子件行):
     * <pre>
     *   物料编号 → 子件编码      物料名 → 子件名称      物料规格 → 子件规格
     *   用量     → 标准用量(文本解析成小数;写不出数值的按 0,文本仍留在工艺清单里)
     *   计量单位/子件名称/子件规格 为空时回落商品档案(bs_inv),与 WorkOrderBomService 同口径
     * </pre>
     *
     * @param docNo 组装工艺清单单据编号(必须是已归档的那张)
     * @param user  操作人(写 asp_user1)
     * @return 结果摘要(面板/单据编号/写入行数/目标清单号/结果),失败时「结果」= 失败 + 原因
     */
    public Map<String, Object> syncAsmProc(String docNo, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("面板", PANEL_ASM_PROC);
        out.put("单据编号", docNo == null ? "" : docNo);
        try {
            PanelRegistry.PanelDef proc = registry.panel(PANEL_ASM_PROC);
            if (docNo == null || docNo.isBlank()) throw new IllegalArgumentException("缺少单据编号");

            String headTbl = proc.headTable();
            String lineTbl = proc.lineTable();
            if (headTbl == null || headTbl.isBlank() || lineTbl == null || lineTbl.isBlank()) {
                throw new IllegalStateException("组装工艺清单未登记头/行表");
            }
            String groupCol = proc.groupCol();
            String prodLabel = "产品编号";

            List<Map<String, Object>> heads = jdbc.queryForList(
                    "SELECT TOP 1 [" + col(proc, prodLabel) + "] AS prod, [" + col(proc, "产品名称") + "] AS pname,"
                            + " ISNULL([" + col(proc, "版本号") + "], N'') AS ver"
                            + " FROM [" + headTbl + "] WHERE [" + groupCol + "] = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
            if (heads.isEmpty()) throw new IllegalStateException("单据不存在:" + docNo);
            String prod = str(heads.get(0).get("prod"));
            String pname = str(heads.get(0).get("pname"));
            String ver = str(heads.get(0).get("ver"));
            if (prod.isEmpty()) throw new IllegalStateException("表头「产品编号」为空,无法定位组装物料清单");

            List<Map<String, Object>> lines = jdbc.queryForList(
                    "SELECT [" + col(proc, "序号") + "] AS seq, [" + col(proc, "物料编号") + "] AS code,"
                            + " [" + col(proc, "物料名") + "] AS name, [" + col(proc, "物料规格") + "] AS spec,"
                            + " [" + col(proc, "用量") + "] AS qty"
                            + " FROM [" + lineTbl + "]"
                            + " WHERE [" + groupCol + "] = ? AND [" + col(proc, "表区") + "] = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY TRY_CAST([" + col(proc, "序号") + "] AS int), id",
                    docNo, ASM_BOM_AREA);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Map<String, Object> r : lines) {
                String code = str(r.get("code"));
                if (code.isEmpty()) continue;      // 没有物料编号的行不进 BOM(与领料同口径)
                rows.add(r);
            }
            if (rows.isEmpty()) {
                out.put("结果", "跳过");
                out.put("原因", "该单 BOM 表没有有效明细行");
                log.info("[工艺清单→组装物料清单] {} (产品 {}) 无 BOM 行,跳过", docNo, prod);
                return out;
            }

            Map<String, String[]> inv = loadInv(rows.stream().map(r -> str(r.get("code"))).toList());

            // 目标单:优先上一次同步写的那张(来源=组装工艺清单…),否则退回取料端会选中的那张
            // ⚠ 2026-11-18:已用「删除单据」作废的清单(yj_doc_status.canceled='Y')**不参与定位** ——
            //   作废只写状态不删行,若把它当目标会"往废单里写",界面永远看不到;正确做法是另建一张新号单。
            List<Map<String, Object>> targets = jdbc.queryForList(
                    "SELECT TOP 1 b.[单据编号] AS no, MAX(ISNULL(b.[默认BOM], N'')) AS dft,"
                            + " MAX(ISNULL(b.[版本号], N'')) AS ver"
                            + " FROM [bs_asm_bom] b WHERE b.[产品编码] = ? AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                            + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'ASM_BOM'"
                            + "     AND s.doc_no = b.[单据编号] AND s.canceled = 'Y')"
                            + " GROUP BY b.[单据编号]"
                            + " ORDER BY MAX(CASE WHEN b.[来源] LIKE N'组装工艺清单%' THEN 1 ELSE 0 END) DESC,"
                            + " CASE WHEN MAX(b.[默认BOM]) = N'是' THEN 0 ELSE 1 END,"
                            + " MAX(b.[版本号]) DESC, b.[单据编号] DESC",
                    prod);
            String bomNo;
            String defaultBom;
            if (!targets.isEmpty()) {
                bomNo = str(targets.get(0).get("no"));
                defaultBom = str(targets.get(0).get("dft"));
                String tver = str(targets.get(0).get("ver"));
                if (ver.isEmpty()) ver = tver;
                int del = jdbc.update("DELETE FROM [bs_asm_bom] WHERE [单据编号] = ?", bomNo);
                log.info("[工艺清单→组装物料清单] {} → 覆盖 {}:删旧行 {} 行", docNo, bomNo, del);
            } else {
                bomNo = formNoService.next("BOM", user);
                defaultBom = hasAnyBom(prod) ? "否" : "是";
                log.info("[工艺清单→组装物料清单] {} (产品 {}) → 新建 {} (默认BOM={})", docNo, prod, bomNo, defaultBom);
            }
            if (defaultBom.isEmpty()) defaultBom = "否";

            // 规格型号:该产品在商品档案里的规格(取不到留空,不编造)
            String[] prodInv = inv.get(prod);
            String prodSpec = prodInv != null && prodInv.length > 1 ? str(prodInv[1]) : "";

            int i = 0;
            for (Map<String, Object> r : rows) {
                i++;
                String code = str(r.get("code"));
                String[] ii = inv.get(code);
                // 目标列长度比来源短(工艺清单「物料规格」nvarchar(500) → 组装物料清单「子件规格」nvarchar(200)),
                // 不截断会 8152 截断报错,而这时旧行已经删了。统一按目标列宽截断(宁短勿炸)。
                String name = cut(firstNonBlank(str(r.get("name")), ii != null ? str(ii[0]) : ""), 200);
                String spec = cut(firstNonBlank(str(r.get("spec")), ii != null ? str(ii[1]) : ""), 200);
                String unit = cut(ii != null ? str(ii[2]) : "", 20);
                BigDecimal qty = parseNum(r.get("qty"));
                jdbc.update("INSERT INTO [bs_asm_bom] ([单据编号],[产品编码],[产品名称],[规格型号],[工序],[版本号],"
                                + "[默认BOM],[来源],[状态],[行序],[子件编码],[子件名称],[子件规格],[计量单位],"
                                + "[标准用量],[用量分子],[用量分母],[损耗量],[行备注],[asp_user1],[asp_time1],[asp_cancel])"
                                + " VALUES (?,?,?,?,N'组装',?,?,?,N'启用',?,?,?,?,?,?,?,1,0,N'',?,GETDATE(),'N')",
                        bomNo, cut(prod, 100), cut(pname, 200), cut(prodSpec, 200), cut(ver, 20), defaultBom,
                        "组装工艺清单 " + docNo,
                        i, cut(code, 100), name, spec, unit, qty, qty, user);
            }
            out.put("结果", "成功");
            out.put("目标清单号", bomNo);
            out.put("写入行数", i);
            out.put("产品编号", prod);
            log.info("[工艺清单→组装物料清单] {} 完成:{} 行 → {}", docNo, i, bomNo);
        } catch (Exception e) {
            out.put("结果", "失败");
            out.put("原因", e.getMessage());
            log.warn("[工艺清单→组装物料清单] {} 同步失败(归档照常完成):{}", docNo, e.toString());
        }
        return out;
    }

    // ================================================================ 烧结侧

    /**
     * 烧结工艺清单 / X烧结工艺清单归档 → 混料物料清单(MIX_BOM / bs_mix_bom)。
     *
     * <p>字段映射(两张烧结单「配方表」→ 混料物料清单):
     * <pre>
     *   RD_MOLD_PROC: 实际添加比例 → 添加比例   单支物料含量 → 单支含量g   设计添加量 → 设计添加量
     *   RD_X_SINTER : 添加比例     → 添加比例   单支含量g    → 单支含量g   设计添加量 → 设计添加量
     *   两张单的 物料种类/物料编号/物料名称 同名直取; 表头 产品编号/产品名称/版本号 一起带过来
     * </pre>
     * 定位键 = 产品编号 + 烧结类型(烧结工艺清单 / X烧结工艺清单)⇒ 同一产品的两种烧结各一张。
     *
     * @param panelCode 只能传 RD_MOLD_PROC / RD_X_SINTER(其它值直接跳过,防误接线)
     * @param docNo     单据编号(必须是已归档的那张)
     * @param user      操作人(写 asp_user1)
     * @return 结果摘要
     */
    public Map<String, Object> syncSinterProc(String panelCode, String docNo, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("面板", panelCode);
        out.put("单据编号", docNo == null ? "" : docNo);
        if (!PANEL_MOLD_PROC.equals(panelCode) && !PANEL_X_SINTER.equals(panelCode)) {
            out.put("结果", "跳过");
            out.put("原因", "不是烧结工艺清单面板");
            return out;
        }
        boolean xsinter = PANEL_X_SINTER.equals(panelCode);
        String sinterType = xsinter ? "X烧结工艺清单" : "烧结工艺清单";
        try {
            PanelRegistry.PanelDef proc = registry.panel(panelCode);
            String headTbl = proc.headTable();
            String lineTbl = proc.lineTable();
            if (headTbl == null || headTbl.isBlank() || lineTbl == null || lineTbl.isBlank()) {
                throw new IllegalStateException(panelCode + " 未登记头/行表");
            }
            String groupCol = proc.groupCol();

            List<Map<String, Object>> heads = jdbc.queryForList(
                    "SELECT TOP 1 [" + col(proc, "产品编号") + "] AS prod, [" + col(proc, "产品名称") + "] AS pname,"
                            + " ISNULL([" + col(proc, "版本号") + "], N'') AS ver"
                            + " FROM [" + headTbl + "] WHERE [" + groupCol + "] = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
            if (heads.isEmpty()) throw new IllegalStateException("单据不存在:" + docNo);
            String prodRaw = str(heads.get(0).get("prod"));
            String pname = str(heads.get(0).get("pname"));
            String ver = str(heads.get(0).get("ver"));
            if (prodRaw.isEmpty()) throw new IllegalStateException("表头「产品编号」为空,无法定位混料物料清单");
            // 2026-11-18 用户口径:「混料产品编码需要把末尾的 -tb 过滤了」——
            // 烧结工艺清单/ X烧结工艺清单的「产品编号」按前端口径带 -tb 后缀(见 core/panel/productCodeSuffix.js),
            // 那是**单据上的产品键写法**;混料物料清单是基础数据,产品编号必须是原始产品编码(不带 -tb),
            // 否则跟产品信息表/组装物料清单对不上。
            // 复用 DevTaskService.baseProductCode 的同一套规则(仅剥结尾那一层、大小写不敏感、去空格),
            // 不另写一份正则 —— 前后端对"什么算 -tb"必须一致。
            String prod = DevTaskService.baseProductCode(prodRaw);
            if (prod.isEmpty()) throw new IllegalStateException("表头「产品编号」去掉 -tb 后为空,无法定位混料物料清单");
            if (!prod.equals(prodRaw)) log.info("[混料物料清单] 产品编号去掉 -tb 后缀:{} → {}", prodRaw, prod);

            String ratioLabel = xsinter ? "添加比例" : "实际添加比例";
            String contentLabel = xsinter ? "单支含量g" : "单支物料含量";
            List<Map<String, Object>> lines = jdbc.queryForList(
                    "SELECT [" + col(proc, "序号") + "] AS seq, [" + col(proc, "物料种类") + "] AS kind,"
                            + " [" + col(proc, "物料编号") + "] AS code, [" + col(proc, "物料名称") + "] AS name,"
                            + " [" + col(proc, ratioLabel) + "] AS ratio,"
                            + " [" + col(proc, contentLabel) + "] AS content,"
                            + " [" + col(proc, "设计添加量") + "] AS design"
                            + " FROM [" + lineTbl + "]"
                            + " WHERE [" + groupCol + "] = ? AND [" + col(proc, "表区") + "] = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY TRY_CAST([" + col(proc, "序号") + "] AS int), id",
                    docNo, SINTER_RECIPE_AREA);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Map<String, Object> r : lines) {
                // 整行空(编号/名称都空)的占位行不进基础数据;只有名称没编号的仍保留(现场有手填名称的情形)
                if (str(r.get("code")).isEmpty() && str(r.get("name")).isEmpty()) continue;
                rows.add(r);
            }
            if (rows.isEmpty()) {
                out.put("结果", "跳过");
                out.put("原因", "该单配方表没有有效明细行");
                log.info("[烧结工艺清单→混料物料清单] {}/{} 无配方行,跳过", sinterType, docNo);
                return out;
            }

            List<Map<String, Object>> targets = jdbc.queryForList(
                    "SELECT TOP 1 b.[单据编号] AS no FROM [bs_mix_bom] b"
                            + " WHERE b.[产品编号] = ? AND b.[烧结类型] = ? AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                            + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'MIX_BOM'"
                            + "     AND s.doc_no = b.[单据编号] AND s.canceled = 'Y')"
                            + " GROUP BY b.[单据编号]"
                            + " ORDER BY MAX(ISNULL(b.[版本号], N'')) DESC, b.[单据编号] DESC",
                    prod, sinterType);
            String docNoOut;
            if (!targets.isEmpty()) {
                docNoOut = str(targets.get(0).get("no"));
                int del = jdbc.update("DELETE FROM [bs_mix_bom] WHERE [单据编号] = ?", docNoOut);
                log.info("[烧结工艺清单→混料物料清单] {}/{} → 覆盖 {}:删旧行 {} 行", sinterType, docNo, docNoOut, del);
            } else {
                docNoOut = formNoService.next("MIX", user);
                log.info("[烧结工艺清单→混料物料清单] {}/{} (产品 {}) → 新建 {}", sinterType, docNo, prod, docNoOut);
            }

            int i = 0;
            for (Map<String, Object> r : rows) {
                i++;
                jdbc.update("INSERT INTO [bs_mix_bom] ([单据编号],[产品编号],[产品名称],[烧结类型],[来源单号],[版本号],"
                                + "[状态],[行序],[物料种类],[物料编号],[物料名称],[添加比例],[单支含量g],[设计添加量],"
                                + "[行备注],[asp_user1],[asp_time1],[asp_cancel])"
                                + " VALUES (?,?,?,?,?,?,N'启用',?,?,?,?,?,?,?,N'',?,GETDATE(),'N')",
                        docNoOut, cut(prod, 100), cut(pname, 200), sinterType, cut(docNo, 60), cut(ver, 60),
                        i, cut(str(r.get("kind")), 60), cut(str(r.get("code")), 100), cut(str(r.get("name")), 200),
                        cut(str(r.get("ratio")), 50), cut(str(r.get("content")), 50), cut(str(r.get("design")), 50), user);
            }
            out.put("结果", "成功");
            out.put("目标清单号", docNoOut);
            out.put("写入行数", i);
            out.put("产品编号", prod);
            out.put("烧结类型", sinterType);
            log.info("[烧结工艺清单→混料物料清单] {}/{} 完成:{} 行 → {}", sinterType, docNo, i, docNoOut);
        } catch (Exception e) {
            out.put("结果", "失败");
            out.put("原因", e.getMessage());
            log.warn("[烧结工艺清单→混料物料清单] {}/{} 同步失败(归档照常完成):{}", sinterType, docNo, e.toString());
        }
        return out;
    }

    // ================================================================ 存量回填

    /**
     * 存量回填:把**当前已归档**的工艺清单逐张同步一次(幂等)。
     *
     * <p>用途:功能上线前已归档的单据不会自动补(同步只在归档那一刻发生),由管理端手工触发一次;
     * 也可在怀疑数据不一致时重复调用(按产品编号覆盖,不会增生)。
     *
     * @return {@code {组装: [每单结果], 烧结: [每单结果]}}
     */
    public Map<String, Object> backfillArchived(String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> asm = new ArrayList<>();
        for (String no : archivedDocs(PANEL_ASM_PROC)) asm.add(syncAsmProc(no, user));
        List<Map<String, Object>> sinter = new ArrayList<>();
        for (String no : archivedDocs(PANEL_MOLD_PROC)) sinter.add(syncSinterProc(PANEL_MOLD_PROC, no, user));
        for (String no : archivedDocs(PANEL_X_SINTER)) sinter.add(syncSinterProc(PANEL_X_SINTER, no, user));
        out.put("组装", asm);
        out.put("烧结", sinter);
        return out;
    }

    /** 某面板当前已归档、未作废的单据号(归档入口写的 archived='Y';canceled='N') */
    private List<String> archivedDocs(String panelCode) {
        return jdbc.queryForList(
                "SELECT s.doc_no FROM yj_doc_status s"
                        + " WHERE s.panel_code = ? AND ISNULL(s.archived,'N') = 'Y'"
                        + " AND ISNULL(s.canceled,'N') <> 'Y' ORDER BY s.doc_no",
                String.class, panelCode);
    }

    // ================================================================ 工具

    /** 标签 → 物理列名(AGENTS §5①:写库一律按 yj_field 的 col_name,不按 label 拼列) */
    private static String col(PanelRegistry.PanelDef def, String label) {
        PanelRegistry.FieldDef f = def.byLabel(label);
        if (f == null) throw new IllegalStateException("面板 " + def.code() + " 缺少字段「" + label + "」");
        return f.col();
    }

    /** 该产品是否已存在任何 BOM 单据(决定新单要不要置「默认BOM=是」) */
    private boolean hasAnyBom(String productCode) {
        // 已作废(删除单据)的清单不算"该产品已有 BOM":否则删掉唯一那张后重新归档会建出默认BOM=否 的新单
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT b.[单据编号]) FROM [bs_asm_bom] b"
                        + " WHERE b.[产品编码] = ? AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'ASM_BOM'"
                        + "     AND s.doc_no = b.[单据编号] AND s.canceled = 'Y')",
                Integer.class, productCode);
        return n != null && n > 0;
    }

    /**
     * 批量取商品档案的 名称/规格型号/计量单位(键 = 存货编码)。
     * 取不到的编码不在 map 里 —— 调用方回落工艺清单里手填的值,不编造。
     */
    private Map<String, String[]> loadInv(List<String> codes) {
        Map<String, String[]> out = new LinkedHashMap<>();
        List<String> uniq = codes.stream().filter(c -> c != null && !c.isBlank()).distinct().toList();
        if (uniq.isEmpty()) return out;
        // 逐条查(单张 BOM 通常 ≤ 50 行;拼 IN 列表反而要处理参数上限与注入面)
        for (String code : uniq) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL([存货名称],N'') AS nm, ISNULL([规格型号],N'') AS sp,"
                            + " ISNULL([计量单位],N'') AS un FROM [bs_inv]"
                            + " WHERE [存货编码] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", code);
            if (!r.isEmpty()) {
                out.put(code, new String[]{str(r.get(0).get("nm")), str(r.get(0).get("sp")), str(r.get(0).get("un"))});
            }
        }
        return out;
    }

    /** 文本用量 → 小数:支持 "1"、"0.026"、"1/124"、" 2 "、"2%"(按 2 处理);解析不出按 0 */
    static BigDecimal parseNum(Object raw) {
        String s = str(raw).replace(",", "").replace(" ", "").replace("%", "");
        if (s.isEmpty()) return BigDecimal.ZERO;
        try {
            int slash = s.indexOf('/');
            if (slash > 0 && slash < s.length() - 1) {
                BigDecimal a = new BigDecimal(s.substring(0, slash));
                BigDecimal b = new BigDecimal(s.substring(slash + 1));
                if (b.compareTo(BigDecimal.ZERO) != 0) return a.divide(b, 4, java.math.RoundingMode.HALF_UP);
                return BigDecimal.ZERO;
            }
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    /** 按目标列宽截断(只用于写库前的兜底,防 nvarchar 长度越界导致 8152 截断) */
    private static String cut(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : (b == null ? "" : b);
    }
}
