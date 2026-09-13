/* 批量将 27 个菜单项翻译追加到 8 个语言文件 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'locales');

const translations = {
  ja: {
    '研发管理': '研究開発管理', '立项申请': 'プロジェクト立案申請', '项目实施计划': 'プロジェクト実施計画',
    '数据记录表': '試験データ記録', '项目进度查询': 'プロジェクト進捗照会', '产品文件': '製品ドキュメント',
    '实验室使用记录表': '実験室使用記録', '功能性滤效': 'ろ過効率', '碱性': 'アルカリ性',
    '矿化': 'ミネラル化', '抑菌': '抗菌', '阻垢性能': 'スケール防止性能', 'RO保护': 'RO保護',
    '浸泡安全': '浸漬安全性', '压降、精度': '圧力損失・精度', '产品信息表': '製品情報表',
    '成型工艺清单': '成形工程リスト', '成型配方': '成形処方', '规格书': '仕様書',
    '组装BOM表': '組立BOM表', '组装工艺清单': '組立工程リスト', '出货检验计划表': '出荷検査計画表',
    '加标水配置记录表': '標準水調製記録', '国内部委托测试申请单': '国内部委託試験申請',
    '设备使用登记表': '設備使用登録', '仪器使用记录表': '機器使用記録',
    '基础档案': '基礎マスタ', '基础设置': '基本設定', '生产制造': '生産製造',
  },
  ko: {
    '研发管理': 'R&D 관리', '立项申请': '프로젝트立案 신청', '项目实施计划': '프로젝트 실시 계획',
    '数据记录表': '시험 데이터 기록', '项目进度查询': '프로젝트 진도 조회', '产品文件': '제품 문서',
    '实验室使用记录表': '실험실 사용 기록', '功能性滤效': '여과 효율', '碱性': '알칼리성',
    '矿化': '미네랄화', '抑菌': '항균', '阻垢性能': '스케일 방지 성능', 'RO保护': 'RO 보호',
    '浸泡安全': '침지 안전성', '压降、精度': '압력 강하·정밀도', '产品信息表': '제품 정보표',
    '成型工艺清单': '성형 공정 목록', '成型配方': '성형 배합', '规格书': '규격서',
    '组装BOM表': '조립 BOM표', '组装工艺清单': '조립 공정 목록', '出货检验计划表': '출하 검사 계획표',
    '加标水配置记录表': '표준수 조제 기록', '国内部委托测试申请单': '국내부 의뢰 시험 신청',
    '设备使用登记表': '설비 사용 등록', '仪器使用记录表': '기기 사용 기록',
    '基础档案': '기본 마스터', '基础设置': '기본 설정', '生产制造': '생산 제조',
  },
  de: {
    '研发管理': 'F&E-Verwaltung', '立项申请': 'Projektantrag', '项目实施计划': 'Projektimplementierungsplan',
    '数据记录表': 'Prüfdaten', '项目进度查询': 'Projektfortschritt', '产品文件': 'Produktdokumente',
    '实验室使用记录表': 'Labornutzungsprotokoll', '功能性滤效': 'Filtrationseffizienz', '碱性': 'Alkalinität',
    '矿化': 'Mineralisierung', '抑菌': 'Antibakteriell', '阻垢性能': 'Kalkschutz', 'RO保护': 'RO-Schutz',
    '浸泡安全': 'Einweichsicherheit', '压降、精度': 'Druckverlust & Präzision', '产品信息表': 'Produktinformationen',
    '成型工艺清单': 'Formprozessliste', '成型配方': 'Formrezeptur', '规格书': 'Spezifikation',
    '组装BOM表': 'Montage-Stückliste', '组装工艺清单': 'Montageprozessliste', '出货检验计划表': 'Warenprüfplan',
    '加标水配置记录表': 'Standardwasser-Herstellung', '国内部委托测试申请单': 'Inländischer Prüfantrag',
    '设备使用登记表': 'Gerätenutzung', '仪器使用记录表': 'Instrumentennutzung',
    '基础档案': 'Stammdaten', '基础设置': 'Grundeinstellungen', '生产制造': 'Fertigung',
  },
  es: {
    '研发管理': 'Gestión de I+D', '立项申请': 'Solicitud de Proyecto', '项目实施计划': 'Plan de Implementación',
    '数据记录表': 'Registros de Pruebas', '项目进度查询': 'Progreso del Proyecto', '产品文件': 'Documentos del Producto',
    '实验室使用记录表': 'Registro de Uso de Laboratorio', '功能性滤效': 'Eficiencia de Filtración', '碱性': 'Alcalinidad',
    '矿化': 'Mineralización', '抑菌': 'Antibacteriano', '阻垢性能': 'Antisarro', 'RO保护': 'Protección RO',
    '浸泡安全': 'Seguridad de Remojo', '压降、精度': 'Caída de Presión y Precisión', '产品信息表': 'Información del Producto',
    '成型工艺清单': 'Lista de Procesos de Moldeo', '成型配方': 'Fórmula de Moldeo', '规格书': 'Especificación',
    '组装BOM表': 'BOM de Ensamblaje', '组装工艺清单': 'Lista de Procesos de Ensamblaje', '出货检验计划表': 'Plan de Inspección de Salida',
    '加标水配置记录表': 'Preparación de Agua Patrón', '国内部委托测试申请单': 'Solicitud de Prueba Interna',
    '设备使用登记表': 'Registro de Uso de Equipo', '仪器使用记录表': 'Registro de Uso de Instrumento',
    '基础档案': 'Datos Maestros', '基础设置': 'Configuración Básica', '生产制造': 'Fabricación',
  },
  fr: {
    '研发管理': 'Gestion R&D', '立项申请': 'Demande de Projet', '项目实施计划': "Plan d'Implémentation",
    '数据记录表': "Enregistrements d'Essais", '项目进度查询': 'Avancement du Projet', '产品文件': 'Documents Produit',
    '实验室使用记录表': "Registre d'Utilisation Labo", '功能性滤效': 'Efficacité de Filtration', '碱性': 'Alcalinité',
    '矿化': 'Minéralisation', '抑菌': 'Antibactérien', '阻垢性能': 'Anti-tartre', 'RO保护': 'Protection RO',
    '浸泡安全': 'Sécurité de Trempage', '压降、精度': 'Perte de Charge & Précision', '产品信息表': 'Informations Produit',
    '成型工艺清单': 'Liste des Procédés de Moulage', '成型配方': 'Formule de Moulage', '规格书': 'Spécification',
    '组装BOM表': 'Nomenclature Assemblage', '组装工艺清单': "Liste des Procédés d'Assemblage", '出货检验计划表': "Plan d'Inspection Expédition",
    '加标水配置记录表': "Préparation d'Eau Étalon", '国内部委托测试申请单': 'Demande de Test Interne',
    '设备使用登记表': "Registre d'Utilisation Équipement", '仪器使用记录表': "Registre d'Utilisation Instrument",
    '基础档案': 'Données de Base', '基础设置': 'Paramètres de Base', '生产制造': 'Fabrication',
  },
  ru: {
    '研发管理': 'Управление НИОКР', '立项申请': 'Заявка на проект', '项目实施计划': 'План реализации проекта',
    '数据记录表': 'Записи испытаний', '项目进度查询': 'Прогресс проекта', '产品文件': 'Документация продукта',
    '实验室使用记录表': 'Журнал использования лаборатории', '功能性滤效': 'Эффективность фильтрации', '碱性': 'Щёлочность',
    '矿化': 'Минерализация', '抑菌': 'Антибактериальный', '阻垢性能': 'Противонакипный', 'RO保护': 'Защита RO',
    '浸泡安全': 'Безопасность замачивания', '压降、精度': 'Перепад давления и точность', '产品信息表': 'Информация о продукте',
    '成型工艺清单': 'Список процессов формовки', '成型配方': 'Рецептура формовки', '规格书': 'Спецификация',
    '组装BOM表': 'Спецификация сборки', '组装工艺清单': 'Список процессов сборки', '出货检验计划表': 'План выходного контроля',
    '加标水配置记录表': 'Приготовление стандартной воды', '国内部委托测试申请单': 'Заявка на внутреннее испытание',
    '设备使用登记表': 'Журнал использования оборудования', '仪器使用记录表': 'Журнал использования приборов',
    '基础档案': 'Основные данные', '基础设置': 'Базовые настройки', '生产制造': 'Производство',
  },
  th: {
    '研发管理': 'การจัดการ R&D', '立项申请': 'คำขอเริ่มโครงการ', '项目实施计划': 'แผนดำเนินโครงการ',
    '数据记录表': 'บันทึกข้อมูลทดสอบ', '项目进度查询': 'ความคืบหน้าโครงการ', '产品文件': 'เอกสารผลิตภัณฑ์',
    '实验室使用记录表': 'บันทึกการใช้ห้องปฏิบัติการ', '功能性滤效': 'ประสิทธิภาพการกรอง', '碱性': 'ความเป็นด่าง',
    '矿化': 'แร่ธาตุ', '抑菌': 'ต้านเชื้อแบคทีเรีย', '阻垢性能': 'ป้องกันตะกอน', 'RO保护': 'การป้องกัน RO',
    '浸泡安全': 'ความปลอดภัยการแช่', '压降、精度': 'แรงดันตกและความแม่นยำ', '产品信息表': 'ข้อมูลผลิตภัณฑ์',
    '成型工艺清单': 'รายการกระบวนการขึ้นรูป', '成型配方': 'สูตรขึ้นรูป', '规格书': 'สเปกสินค้า',
    '组装BOM表': 'BOM ประกอบ', '组装工艺清单': 'รายการกระบวนการประกอบ', '出货检验计划表': 'แผนตรวจสอบก่อนส่งออก',
    '加标水配置记录表': 'บันทึกเตรียมน้ำมาตรฐาน', '国内部委托测试申请单': 'คำขอทดสอบภายใน',
    '设备使用登记表': 'ทะเบียนการใช้อุปกรณ์', '仪器使用记录表': 'บันทึกการใช้เครื่องมือ',
    '基础档案': 'ข้อมูลหลัก', '基础设置': 'การตั้งค่าพื้นฐาน', '生产制造': 'การผลิต',
  },
  vi: {
    '研发管理': 'Quản lý R&D', '立项申请': 'Đơn đề xuất dự án', '项目实施计划': 'Kế hoạch triển khai',
    '数据记录表': 'Hồ sơ dữ liệu kiểm nghiệm', '项目进度查询': 'Tiến độ dự án', '产品文件': 'Tài liệu sản phẩm',
    '实验室使用记录表': 'Sổ sử dụng phòng thí nghiệm', '功能性滤效': 'Hiệu suất lọc', '碱性': 'Độ kiềm',
    '矿化': 'Khoáng hóa', '抑菌': 'Kháng khuẩn', '阻垢性能': 'Chống cặn', 'RO保护': 'Bảo vệ RO',
    '浸泡安全': 'An toàn ngâm', '压降、精度': 'Sụt áp & độ chính xác', '产品信息表': 'Bảng thông tin sản phẩm',
    '成型工艺清单': 'Danh sách công nghệ ép khuôn', '成型配方': 'Công thức ép khuôn', '规格书': 'Quy cách kỹ thuật',
    '组装BOM表': 'BOM lắp ráp', '组装工艺清单': 'Danh sách công nghệ lắp ráp', '出货检验计划表': 'Kế hoạch kiểm tra xuất hàng',
    '加标水配置记录表': 'Sổ pha nước chuẩn', '国内部委托测试申请单': 'Đơn yêu cầu kiểm tra nội bộ',
    '设备使用登记表': 'Sổ đăng ký sử dụng thiết bị', '仪器使用记录表': 'Sổ sử dụng dụng cụ',
    '基础档案': 'Dữ liệu nền', '基础设置': 'Cài đặt cơ bản', '生产制造': 'Sản xuất',
  },
};

let total = 0;
for (const [loc, entries] of Object.entries(translations)) {
  const file = path.join(dir, `${loc}.js`);
  let content = fs.readFileSync(file, 'utf8');
  // Find last closing of biz block: "  },"  before the final "}"
  const bizClose = content.lastIndexOf('  },');
  if (bizClose < 0) { console.error(`${loc}: biz close not found`); continue; }
  let lines = [];
  lines.push(`    // R&D Management menu (${new Date().toISOString().slice(0,10)})`);
  for (const [zh, text] of Object.entries(entries)) {
    if (content.includes(`'${zh}'`)) continue; // already present
    lines.push(`    '${zh}': '${text.replace(/'/g, "\\'")}',`);
    total++;
  }
  if (lines.length <= 1) { console.log(`${loc}: all present, skip`); continue; }
  content = content.slice(0, bizClose) + '\n' + lines.join('\n') + '\n' + content.slice(bizClose);
  fs.writeFileSync(file, content, 'utf8');
  console.log(`${loc}: +${lines.length - 1} entries`);
}
console.log(`\nTotal: ${total} translations added across 8 languages`);
