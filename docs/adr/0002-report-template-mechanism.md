# ADR-0002: 报表模板机制(Jasper 引擎 + DB 存储 + 面板自选)

- 状态：已接受（2026-09-12）
- 背景：原机制只有 1 张模板（so_order.jrxml）写死在 classpath 的 report-templates.properties，
  改模板要重新打包发版；业务希望「自选报表模板导出」，并提到 FastReportDesigner。
- 决策：
  1. **引擎保持 JasperReports**——不引入 FastReport .NET（需 Windows 侧车服务，架构复杂度翻倍、商用授权），
     不引入国产 Web 设计器（UReport 停更/积木授权边界）。设计器用免费的 Jaspersoft Studio 编 .jrxml。
  2. **模板存数据库** `yj_report_template(template_code 唯一/panel_code/name/jrxml_text/enabled)`，
     管理员上传即生效免重启；上传时服务端 JasperCompileManager 编译校验，编译不过拒绝入库。
  3. **管理入口长在「导出报表」弹窗里**（不做独立管理页）：模板下拉选择 + [模板管理]（仅 admin）二级弹窗
     （列表/上传/启用停用/预览/删除）。
  4. 现有 so_order 模板随迁移入库；report-templates.properties 保留一个版本兜底后废弃。
- 后果：
  - 部署形态不变（纯 Java 单体），新增报表零前端改动（入口按面板有无模板自动显隐）。
  - jrxml 内字段名/参数名必须等于 yj_field.label 中文——取数契约与 ADR-0001 同源，永不翻译。
  - 导出权限=面板 view（不变）；模板管理权限=仅 admin。
  - 代价：jrxml 为文本存储，模板质量依赖 Jaspersoft Studio 编写规范；无网页拖拽设计体验（明确放弃）。
