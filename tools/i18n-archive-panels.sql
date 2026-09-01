-- 基础档案面板名译名补录(17 面板 × 9 语言,scope='panel')——EN 走查发现档案面板名全缺(Doc: 部门)
USE HSDZ_MES;
SET NOCOUNT ON;

MERGE yj_translation AS t USING (VALUES
(N'部门',N'en',N'Department'),(N'部门',N'ja',N'部門'),(N'部门',N'ko',N'부서'),(N'部门',N'de',N'Abteilung'),(N'部门',N'es',N'Departamento'),(N'部门',N'fr',N'Département'),(N'部门',N'ru',N'Отдел'),(N'部门',N'th',N'แผนก'),(N'部门',N'vi',N'Phòng ban'),
(N'员工',N'en',N'Employee'),(N'员工',N'ja',N'従業員'),(N'员工',N'ko',N'직원'),(N'员工',N'de',N'Mitarbeiter'),(N'员工',N'es',N'Empleado'),(N'员工',N'fr',N'Employé'),(N'员工',N'ru',N'Сотрудник'),(N'员工',N'th',N'พนักงาน'),(N'员工',N'vi',N'Nhân viên'),
(N'设备',N'en',N'Equipment'),(N'设备',N'ja',N'設備'),(N'设备',N'ko',N'설비'),(N'设备',N'de',N'Anlage'),(N'设备',N'es',N'Equipo'),(N'设备',N'fr',N'Équipement'),(N'设备',N'ru',N'Оборудование'),(N'设备',N'th',N'อุปกรณ์'),(N'设备',N'vi',N'Thiết bị'),
(N'存货',N'en',N'Inventory'),(N'存货',N'ja',N'存貨'),(N'存货',N'ko',N'재고'),(N'存货',N'de',N'Artikel'),(N'存货',N'es',N'Artículo'),(N'存货',N'fr',N'Article'),(N'存货',N'ru',N'Номенклатура'),(N'存货',N'th',N'สินค้า'),(N'存货',N'vi',N'Hàng tồn'),
(N'存货价格本',N'en',N'Inventory price list'),(N'存货价格本',N'ja',N'存貨価格台帳'),(N'存货价格本',N'ko',N'재고 가격대장'),(N'存货价格本',N'de',N'Artikelpreisliste'),(N'存货价格本',N'es',N'Lista de precios'),(N'存货价格本',N'fr',N'Tarif article'),(N'存货价格本',N'ru',N'Прайс-лист'),(N'存货价格本',N'th',N'ทะเบียนราคาสินค้า'),(N'存货价格本',N'vi',N'Bảng giá tồn kho'),
(N'工序',N'en',N'Operation'),(N'工序',N'ja',N'工程'),(N'工序',N'ko',N'공정'),(N'工序',N'de',N'Arbeitsgang'),(N'工序',N'es',N'Operación'),(N'工序',N'fr',N'Opération'),(N'工序',N'ru',N'Операция'),(N'工序',N'th',N'ขั้นตอน'),(N'工序',N'vi',N'Công đoạn'),
(N'往来单位',N'en',N'Business partner'),(N'往来单位',N'ja',N'取引先'),(N'往来单位',N'ko',N'거래처'),(N'往来单位',N'de',N'Geschäftspartner'),(N'往来单位',N'es',N'Socio comercial'),(N'往来单位',N'fr',N'Partenaire'),(N'往来单位',N'ru',N'Контрагент'),(N'往来单位',N'th',N'คู่ค้า'),(N'往来单位',N'vi',N'Đối tác'),
(N'项目',N'en',N'Project'),(N'项目',N'ja',N'プロジェクト'),(N'项目',N'ko',N'프로젝트'),(N'项目',N'de',N'Projekt'),(N'项目',N'es',N'Proyecto'),(N'项目',N'fr',N'Projet'),(N'项目',N'ru',N'Проект'),(N'项目',N'th',N'โครงการ'),(N'项目',N'vi',N'Dự án'),
(N'检验项目',N'en',N'Inspection item'),(N'检验项目',N'ja',N'検査項目'),(N'检验项目',N'ko',N'검사 항목'),(N'检验项目',N'de',N'Prüfmerkmal'),(N'检验项目',N'es',N'Elemento de inspección'),(N'检验项目',N'fr',N'Point de contrôle'),(N'检验项目',N'ru',N'Параметр контроля'),(N'检验项目',N'th',N'รายการตรวจสอบ'),(N'检验项目',N'vi',N'Hạng mục kiểm tra'),
(N'检验方案',N'en',N'Inspection plan'),(N'检验方案',N'ja',N'検査方案'),(N'检验方案',N'ko',N'검사 방안'),(N'检验方案',N'de',N'Prüfplan'),(N'检验方案',N'es',N'Plan de inspección'),(N'检验方案',N'fr',N'Plan de contrôle'),(N'检验方案',N'ru',N'План контроля'),(N'检验方案',N'th',N'แผนตรวจสอบ'),(N'检验方案',N'vi',N'Phương án kiểm tra'),
(N'地区',N'en',N'Region'),(N'地区',N'ja',N'地域'),(N'地区',N'ko',N'지역'),(N'地区',N'de',N'Region'),(N'地区',N'es',N'Región'),(N'地区',N'fr',N'Région'),(N'地区',N'ru',N'Регион'),(N'地区',N'th',N'ภูมิภาค'),(N'地区',N'vi',N'Khu vực'),
(N'不合格原因',N'en',N'Reject reason'),(N'不合格原因',N'ja',N'不合格理由'),(N'不合格原因',N'ko',N'불합격 사유'),(N'不合格原因',N'de',N'Ausschussgrund'),(N'不合格原因',N'es',N'Motivo de rechazo'),(N'不合格原因',N'fr',N'Motif de rejet'),(N'不合格原因',N'ru',N'Причина брака'),(N'不合格原因',N'th',N'เหตุผลที่ไม่ผ่าน'),(N'不合格原因',N'vi',N'Lý do không đạt'),
(N'工艺路线',N'en',N'Routing'),(N'工艺路线',N'ja',N'工程経路'),(N'工艺路线',N'ko',N'공정 라우팅'),(N'工艺路线',N'de',N'Arbeitsplan'),(N'工艺路线',N'es',N'Ruta de proceso'),(N'工艺路线',N'fr',N'Gamme'),(N'工艺路线',N'ru',N'Маршрут'),(N'工艺路线',N'th',N'เส้นทางกระบวนการ'),(N'工艺路线',N'vi',N'Quy trình công nghệ'),
(N'班组',N'en',N'Team'),(N'班组',N'ja',N'班組'),(N'班组',N'ko',N'반'),(N'班组',N'de',N'Team'),(N'班组',N'es',N'Equipo'),(N'班组',N'fr',N'Équipe'),(N'班组',N'ru',N'Бригада'),(N'班组',N'th',N'ทีมงาน'),(N'班组',N'vi',N'Tổ'),
(N'计量单位',N'en',N'UOM'),(N'计量单位',N'ja',N'計量単位'),(N'计量单位',N'ko',N'계량단위'),(N'计量单位',N'de',N'Mengeneinheit'),(N'计量单位',N'es',N'Unidad de medida'),(N'计量单位',N'fr',N'Unité de mesure'),(N'计量单位',N'ru',N'Ед. изм.'),(N'计量单位',N'th',N'หน่วยวัด'),(N'计量单位',N'vi',N'Đơn vị tính'),
(N'工作中心',N'en',N'Work center'),(N'工作中心',N'ja',N'作業センター'),(N'工作中心',N'ko',N'작업장'),(N'工作中心',N'de',N'Arbeitsplatz'),(N'工作中心',N'es',N'Centro de trabajo'),(N'工作中心',N'fr',N'Centre de travail'),(N'工作中心',N'ru',N'Рабочий центр'),(N'工作中心',N'th',N'ศูนย์งาน'),(N'工作中心',N'vi',N'Tâm việc'),
(N'仓库',N'en',N'Warehouse'),(N'仓库',N'ja',N'倉庫'),(N'仓库',N'ko',N'창고'),(N'仓库',N'de',N'Lager'),(N'仓库',N'es',N'Almacén'),(N'仓库',N'fr',N'Entrepôt'),(N'仓库',N'ru',N'Склад'),(N'仓库',N'th',N'คลังสินค้า'),(N'仓库',N'vi',N'Kho')
) AS s(ref_key,locale,text)
ON t.scope = 'panel' AND t.ref_key = s.ref_key AND t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES ('panel', s.ref_key, s.locale, s.text, 'manual');

-- 面板名通道回填
UPDATE p SET p.panel_name_en = s.text
FROM yj_panel p JOIN yj_translation s ON s.scope='panel' AND s.ref_key=p.panel_name AND s.locale='en'
WHERE (p.panel_name_en IS NULL OR p.panel_name_en = N'');

PRINT N'i18n-archive-panels 完成';
