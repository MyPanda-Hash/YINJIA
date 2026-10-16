import fs from 'node:fs'

/**
 * _i18n-first-insp-cols.mjs — 把首件检验「测试项目可新增」这一批显示层词条补进 9 个语言包。
 * zh-CN 是源语言(源码里就是中文,不在 locales 里),en 已手写;这里补其余 9 个。
 * 锚点 = 各语言包里首件检验那批的「已按成型工艺清单」行(上一轮已经落好、九语言都在)。
 */
const BLOCKS = {
  'zh-TW': {
    '测试项目': '測試項目', '表单管理人': '表單管理人', '密级': '密級', '使用范围': '使用範圍',
    '新增一个测试项目（即新增一列）': '新增一個測試項目（即新增一欄）',
    '点这里改测试项目名': '點這裡改測試項目名', '删除本列': '刪除本欄',
    '已新增一列': '已新增一欄', '，请在列头改成要测的项目名': '，請在欄首改成要測的項目名',
    '删除本列将连同已填内容一起清空': '刪除本欄會連同已填內容一起清空', '确定删除吗？': '確定刪除嗎？',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': '暫無測試項目，點表頭右上角「＋」新增一欄；也可以用工具列「取成型工藝清單」按產品帶入',
    '暂无测试项目': '暫無測試項目',
    '无粘模（均匀）': '無黏模（均勻）', '轻微粘模（粗糙）': '輕微黏模（粗糙）', '严重粘模（脱皮）': '嚴重黏模（脫皮）',
    '无明显脱粉': '無明顯脫粉', '轻微脱粉': '輕微脫粉', '严重脱粉': '嚴重脫粉',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': '表觀及脫粉項目測試後記錄2支樣品資料，炭棒尺寸及重量相關項目測試後記錄2支樣品資料，炭棒強度測試2支樣品，濁度及壓降測試記錄2支樣品。',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': '鑒於胚棒為初步測量確認，測試資料記錄精度規定如下：炭棒內外徑、長度及重量保留小數點後1位；擠壓強度及壓降按表顯資料記錄。',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': '檢測標準依據炭棒工藝配方管控清單（如產品同時有要求濁度和壓降兩項測試，可先測試初始濁度後再進行壓降測試）。',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': '炭棒表觀出現嚴重黏模或明顯脫粉情況，需馬上停止生產，已生產的產品暫時隔離標示（紅色）。',
    '测试样品需保留至本班次生产完成。': '測試樣品需保留至本班次生產完成。',
    'C-95客户相关产品脱模后立马进行首件检验。': 'C-95客戶相關產品脫模後立馬進行首件檢驗。',
  },
  ja: {
    '测试项目': 'テスト項目', '表单管理人': '帳票管理者', '密级': '機密区分', '使用范围': '使用範囲',
    '新增一个测试项目（即新增一列）': 'テスト項目を追加（＝1列追加）',
    '点这里改测试项目名': 'クリックしてテスト項目名を変更', '删除本列': 'この列を削除',
    '已新增一列': '1列追加しました', '，请在列头改成要测的项目名': '：列見出しで項目名を変更してください',
    '删除本列将连同已填内容一起清空': 'この列を削除すると入力内容も消去されます', '确定删除吗？': '削除しますか？',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'テスト項目がありません。表頭右上の「＋」で列を追加するか、ツールバーの「成形工程票を取得」で製品ごとに取り込んでください',
    '暂无测试项目': 'テスト項目なし',
    '无粘模（均匀）': '型離れ良好（均一）', '轻微粘模（粗糙）': '軽度の型離れ不良（粗い）', '严重粘模（脱皮）': '重度の型離れ不良（剥離）',
    '无明显脱粉': '明らかな粉落ちなし', '轻微脱粉': '軽度の粉落ち', '严重脱粉': '重度の粉落ち',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': '外観・粉落ち項目の試験後は2本のサンプルデータを記録し、炭棒寸法・重量関連項目の試験後も2本記録、炭棒強度は2本、濁度・圧力損失は2本を記録する。',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': '生地棒は暫定測定のため、記録精度は次のとおり：炭棒の内外径・長さ・重量は小数点以下1桁、圧縮強度と圧力損失は表示値を記録する。',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': '試験基準は炭棒配合管理票に従う（濁度と圧力損失の両方が要求される場合は、先に初期濁度を測定してから圧力損失を測定する）。',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': '炭棒外観に重度の型離れ不良または明らかな粉落ちが発生した場合は直ちに生産を停止し、生産済み製品は一時隔離表示（赤）とする。',
    '测试样品需保留至本班次生产完成。': 'テストサンプルは本勤務の生産完了まで保管する。',
    'C-95客户相关产品脱模后立马进行首件检验。': 'C-95顧客向け製品は離型後すぐに初品検査を行う。',
  },
  ko: {
    '测试项目': '시험 항목', '表单管理人': '양식 관리자', '密级': '기밀 등급', '使用范围': '사용 범위',
    '新增一个测试项目（即新增一列）': '시험 항목 추가(열 1개 추가)',
    '点这里改测试项目名': '클릭하여 시험 항목명 변경', '删除本列': '이 열 삭제',
    '已新增一列': '열 1개를 추가했습니다', '，请在列头改成要测的项目名': ': 열 머리글에서 항목명을 변경하세요',
    '删除本列将连同已填内容一起清空': '이 열을 삭제하면 입력한 내용도 함께 지워집니다', '确定删除吗？': '삭제하시겠습니까?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': '시험 항목이 없습니다. 표 머리글 오른쪽 위 “＋”로 열을 추가하거나 도구 모음의 “성형 공정표 가져오기”로 제품별로 불러오세요',
    '暂无测试项目': '시험 항목 없음',
    '无粘模（均匀）': '점착 없음(균일)', '轻微粘模（粗糙）': '경미한 점착(거침)', '严重粘模（脱皮）': '심한 점착(박리)',
    '无明显脱粉': '뚜렷한 분말 탈락 없음', '轻微脱粉': '경미한 분말 탈락', '严重脱粉': '심한 분말 탈락',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': '외관·분말 탈락 시험 후 2개 샘플 데이터를 기록하고, 탄봉 치수·중량 시험 후 2개, 탄봉 강도 2개, 탁도·압력 강하 2개를 기록한다.',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': '생지봉은 예비 측정이므로 기록 정밀도는 다음과 같다: 탄봉 내외경·길이·중량은 소수점 1자리, 압축 강도와 압력 강하는 표시값을 기록한다.',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': '시험 기준은 탄봉 배합 관리표를 따른다(탁도와 압력 강하가 모두 요구되면 초기 탁도를 먼저 측정한 후 압력 강하를 측정한다).',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': '탄봉 외관에 심한 점착이나 뚜렷한 분말 탈락이 발생하면 즉시 생산을 중지하고 생산된 제품은 임시 격리 표시(적색)한다.',
    '测试样品需保留至本班次生产完成。': '시험 샘플은 이번 근무조 생산 완료 시까지 보관한다.',
    'C-95客户相关产品脱模后立马进行首件检验。': 'C-95 고객 제품은 탈형 후 즉시 초품 검사를 실시한다.',
  },
  de: {
    '测试项目': 'Prüfposition', '表单管理人': 'Formularverwalter', '密级': 'Geheimhaltung', '使用范围': 'Geltungsbereich',
    '新增一个测试项目（即新增一列）': 'Prüfposition hinzufügen (fügt eine Spalte hinzu)',
    '点这里改测试项目名': 'Klicken, um die Prüfposition umzubenennen', '删除本列': 'Diese Spalte löschen',
    '已新增一列': 'Eine Spalte hinzugefügt', '，请在列头改成要测的项目名': ': im Spaltenkopf umbenennen',
    '删除本列将连同已填内容一起清空': 'Beim Löschen dieser Spalte werden auch die Eingaben gelöscht', '确定删除吗？': 'Wirklich löschen?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'Keine Prüfpositionen. Oben rechts im Kopf auf „＋“ klicken, um eine Spalte hinzuzufügen, oder im Menüband „Formprozessblatt übernehmen“ verwenden',
    '暂无测试项目': 'Keine Prüfpositionen',
    '无粘模（均匀）': 'Kein Anhaften (gleichmäßig)', '轻微粘模（粗糙）': 'Leichtes Anhaften (rau)', '严重粘模（脱皮）': 'Starkes Anhaften (Abplatzen)',
    '无明显脱粉': 'Kein sichtbarer Pulverabtrag', '轻微脱粉': 'Leichter Pulverabtrag', '严重脱粉': 'Starker Pulverabtrag',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': 'Nach Prüfung von Aussehen und Pulverabtrag zwei Proben dokumentieren, ebenso nach Maß- und Gewichtsprüfungen; Festigkeit an zwei Proben, Trübung und Druckverlust an zwei Proben.',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': 'Da der Grünling vorläufig gemessen wird: Innen-/Außendurchmesser, Länge und Gewicht mit einer Nachkommastelle; Druckfestigkeit und Druckverlust wie angezeigt.',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': 'Prüfstandards richten sich nach dem Rezeptur-Kontrollblatt (sind Trübung und Druckverlust gefordert, zuerst die Anfangstrübung, dann den Druckverlust prüfen).',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': 'Bei starkem Anhaften oder deutlichem Pulverabtrag die Produktion sofort stoppen und gefertigte Produkte vorläufig kennzeichnen (rot).',
    '测试样品需保留至本班次生产完成。': 'Prüfmuster bis zum Ende dieser Schicht aufbewahren.',
    'C-95客户相关产品脱模后立马进行首件检验。': 'Bei C-95-Kundenprodukten direkt nach dem Entformen die Erstmusterprüfung durchführen.',
  },
  es: {
    '测试项目': 'Ítem de prueba', '表单管理人': 'Responsable del formulario', '密级': 'Confidencialidad', '使用范围': 'Ámbito de uso',
    '新增一个测试项目（即新增一列）': 'Añadir un ítem de prueba (añade una columna)',
    '点这里改测试项目名': 'Haga clic para renombrar el ítem', '删除本列': 'Eliminar esta columna',
    '已新增一列': 'Se añadió una columna', '，请在列头改成要测的项目名': ': cambie el nombre en el encabezado',
    '删除本列将连同已填内容一起清空': 'Eliminar esta columna también borra los datos introducidos', '确定删除吗？': '¿Eliminar?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'Sin ítems de prueba. Pulse «＋» arriba a la derecha para añadir una columna o use «Obtener hoja de proceso de moldeo» en la barra',
    '暂无测试项目': 'Sin ítems de prueba',
    '无粘模（均匀）': 'Sin adherencia (uniforme)', '轻微粘模（粗糙）': 'Adherencia leve (rugoso)', '严重粘模（脱皮）': 'Adherencia grave (desprendimiento)',
    '无明显脱粉': 'Sin desprendimiento visible', '轻微脱粉': 'Desprendimiento leve', '严重脱粉': 'Desprendimiento grave',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': 'Tras las pruebas de aspecto y desprendimiento registre dos muestras; también tras las de dimensiones y peso; resistencia en dos muestras; turbidez y caída de presión en dos muestras.',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': 'Al ser una medición preliminar: diámetro interior/exterior, longitud y peso con 1 decimal; resistencia a la compresión y caída de presión según el valor mostrado.',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': 'Los criterios siguen la hoja de control de fórmula (si se exigen turbidez y caída de presión, mida primero la turbidez inicial y luego la caída de presión).',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': 'Ante adherencia grave o desprendimiento evidente, detenga la producción y marque los productos como aislados temporalmente (rojo).',
    '测试样品需保留至本班次生产完成。': 'Conserve las muestras hasta terminar la producción de este turno.',
    'C-95客户相关产品脱模后立马进行首件检验。': 'En productos del cliente C-95, realice la inspección de primera pieza justo tras el desmoldeo.',
  },
  fr: {
    '测试项目': 'Point de test', '表单管理人': 'Gestionnaire du formulaire', '密级': 'Confidentialité', '使用范围': 'Domaine d’application',
    '新增一个测试项目（即新增一列）': 'Ajouter un point de test (ajoute une colonne)',
    '点这里改测试项目名': 'Cliquez pour renommer le point de test', '删除本列': 'Supprimer cette colonne',
    '已新增一列': 'Une colonne ajoutée', '，请在列头改成要测的项目名': ' : renommez-le dans l’en-tête',
    '删除本列将连同已填内容一起清空': 'Supprimer cette colonne efface aussi les données saisies', '确定删除吗？': 'Supprimer ?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'Aucun point de test. Cliquez sur « ＋ » en haut à droite pour ajouter une colonne, ou utilisez « Récupérer la fiche de moulage »',
    '暂无测试项目': 'Aucun point de test',
    '无粘模（均匀）': 'Pas d’adhérence (uniforme)', '轻微粘模（粗糙）': 'Adhérence légère (rugueux)', '严重粘模（脱皮）': 'Adhérence sévère (décollement)',
    '无明显脱粉': 'Pas de perte de poudre visible', '轻微脱粉': 'Légère perte de poudre', '严重脱粉': 'Forte perte de poudre',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': 'Après les essais d’aspect et de perte de poudre, relevez deux échantillons ; idem après les essais de dimensions et de poids ; résistance sur deux échantillons ; turbidité et perte de charge sur deux échantillons.',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': 'Mesure préliminaire : diamètres, longueur et poids à une décimale ; résistance à la compression et perte de charge selon l’affichage.',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': 'Les critères suivent la fiche de contrôle de formule (si turbidité et perte de charge sont exigées, mesurez d’abord la turbidité initiale).',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': 'En cas d’adhérence sévère ou de perte de poudre marquée, arrêtez la production et isolez les produits (rouge).',
    '测试样品需保留至本班次生产完成。': 'Conservez les échantillons jusqu’à la fin de la production de ce poste.',
    'C-95客户相关产品脱模后立马进行首件检验。': 'Pour les produits du client C-95, réalisez le contrôle de première pièce juste après le démoulage.',
  },
  ru: {
    '测试项目': 'Пункт испытания', '表单管理人': 'Ответственный за форму', '密级': 'Уровень секретности', '使用范围': 'Область применения',
    '新增一个测试项目（即新增一列）': 'Добавить пункт испытания (добавляет столбец)',
    '点这里改测试项目名': 'Нажмите, чтобы переименовать пункт', '删除本列': 'Удалить этот столбец',
    '已新增一列': 'Добавлен столбец', '，请在列头改成要测的项目名': ': измените название в заголовке',
    '删除本列将连同已填内容一起清空': 'Удаление столбца также очистит введённые данные', '确定删除吗？': 'Удалить?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'Пунктов нет. Нажмите «＋» справа вверху, чтобы добавить столбец, либо используйте «Загрузить техпроцесс формования»',
    '暂无测试项目': 'Пунктов испытаний нет',
    '无粘模（均匀）': 'Без прилипания (равномерно)', '轻微粘模（粗糙）': 'Небольшое прилипание (шероховато)', '严重粘模（脱皮）': 'Сильное прилипание (отслоение)',
    '无明显脱粉': 'Заметного осыпания нет', '轻微脱粉': 'Небольшое осыпание', '严重脱粉': 'Сильное осыпание',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': 'После испытаний внешнего вида и осыпания записывают 2 образца; после размеров и массы — 2 образца; прочность — 2 образца; мутность и перепад давления — 2 образца.',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': 'Так как заготовка измеряется предварительно: внутренний/наружный диаметр, длина и масса — 1 знак после запятой; прочность и перепад давления — по показаниям.',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': 'Критерии — по листу контроля рецептуры (если нужны и мутность, и перепад давления, сначала измеряют начальную мутность).',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': 'При сильном прилипании или заметном осыпании немедленно остановите производство и пометьте продукцию как временно изолированную (красным).',
    '测试样品需保留至本班次生产完成。': 'Образцы хранят до окончания производства в этой смене.',
    'C-95客户相关产品脱模后立马进行首件检验。': 'Для продукции клиента C-95 первую деталь проверяют сразу после извлечения из формы.',
  },
  vi: {
    '测试项目': 'Hạng mục kiểm tra', '表单管理人': 'Người quản lý biểu mẫu', '密级': 'Mức bảo mật', '使用范围': 'Phạm vi sử dụng',
    '新增一个测试项目（即新增一列）': 'Thêm hạng mục kiểm tra (thêm một cột)',
    '点这里改测试项目名': 'Nhấn để đổi tên hạng mục', '删除本列': 'Xóa cột này',
    '已新增一列': 'Đã thêm một cột', '，请在列头改成要测的项目名': ': hãy đổi tên ở tiêu đề cột',
    '删除本列将连同已填内容一起清空': 'Xóa cột này cũng xóa dữ liệu đã nhập', '确定删除吗？': 'Xóa chứ?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'Chưa có hạng mục. Nhấn “＋” ở góc trên bên phải để thêm cột, hoặc dùng “Lấy phiếu công nghệ tạo hình”',
    '暂无测试项目': 'Chưa có hạng mục kiểm tra',
    '无粘模（均匀）': 'Không dính khuôn (đều)', '轻微粘模（粗糙）': 'Dính khuôn nhẹ (nhám)', '严重粘模（脱皮）': 'Dính khuôn nặng (bong tróc)',
    '无明显脱粉': 'Không thấy bột rơi rõ rệt', '轻微脱粉': 'Bột rơi nhẹ', '严重脱粉': 'Bột rơi nhiều',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': 'Sau khi kiểm tra ngoại quan và bột rơi ghi 2 mẫu; sau kiểm tra kích thước và khối lượng ghi 2 mẫu; độ bền 2 mẫu; độ đục và tổn thất áp suất 2 mẫu.',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': 'Do phôi đo sơ bộ: đường kính trong/ngoài, chiều dài và khối lượng giữ 1 chữ số thập phân; độ bền nén và tổn thất áp suất ghi theo hiển thị.',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': 'Tiêu chuẩn theo phiếu kiểm soát công thức (nếu yêu cầu cả độ đục và tổn thất áp suất, đo độ đục ban đầu trước).',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': 'Khi bề mặt thanh carbon dính khuôn nặng hoặc bột rơi rõ rệt, dừng sản xuất ngay và tạm cách ly sản phẩm (đỏ).',
    '测试样品需保留至本班次生产完成。': 'Mẫu thử phải được lưu đến khi ca sản xuất hoàn thành.',
    'C-95客户相关产品脱模后立马进行首件检验。': 'Sản phẩm cho khách C-95 phải kiểm tra chi tiết đầu tiên ngay sau khi tháo khuôn.',
  },
  th: {
    '测试项目': 'รายการทดสอบ', '表单管理人': 'ผู้ดูแลแบบฟอร์ม', '密级': 'ชั้นความลับ', '使用范围': 'ขอบเขตการใช้งาน',
    '新增一个测试项目（即新增一列）': 'เพิ่มรายการทดสอบ (เพิ่มหนึ่งคอลัมน์)',
    '点这里改测试项目名': 'คลิกเพื่อเปลี่ยนชื่อรายการทดสอบ', '删除本列': 'ลบคอลัมน์นี้',
    '已新增一列': 'เพิ่มหนึ่งคอลัมน์แล้ว', '，请在列头改成要测的项目名': '：กรุณาเปลี่ยนชื่อที่หัวคอลัมน์',
    '删除本列将连同已填内容一起清空': 'การลบคอลัมน์นี้จะล้างข้อมูลที่กรอกไว้ด้วย', '确定删除吗？': 'ยืนยันการลบ?',
    '暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入': 'ยังไม่มีรายการทดสอบ คลิก “＋” มุมขวาบนเพื่อเพิ่มคอลัมน์ หรือใช้ “ดึงใบ工艺流程ขึ้นรูป” ในแถบเครื่องมือ',
    '暂无测试项目': 'ยังไม่มีรายการทดสอบ',
    '无粘模（均匀）': 'ไม่ติดแม่พิมพ์ (สม่ำเสมอ)', '轻微粘模（粗糙）': 'ติดแม่พิมพ์เล็กน้อย (หยาบ)', '严重粘模（脱皮）': 'ติดแม่พิมพ์รุนแรง (ลอก)',
    '无明显脱粉': 'ไม่พบผงหลุดชัดเจน', '轻微脱粉': 'ผงหลุดเล็กน้อย', '严重脱粉': 'ผงหลุดรุนแรง',
    '表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。': 'หลังทดสอบลักษณะภายนอกและการหลุดของผงให้บันทึก 2 ตัวอย่าง หลังทดสอบขนาดและน้ำหนักบันทึก 2 ตัวอย่าง ความแข็งแรง 2 ตัวอย่าง ความขุ่นและแรงดันตก 2 ตัวอย่าง',
    '鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。': 'เนื่องจากการวัดแท่งดิบเป็นการวัดเบื้องต้น: เส้นผ่านศูนย์กลางใน/นอก ความยาว และน้ำหนัก ทศนิยม 1 ตำแหน่ง; ความแข็งแรงอัดและแรงดันตกบันทึกตามที่แสดง',
    '检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。': 'เกณฑ์การทดสอบอ้างอิงใบควบคุมสูตร (หากต้องทดสอบทั้งความขุ่นและแรงดันตก ให้วัดความขุ่นเริ่มต้นก่อน)',
    '炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。': 'หากผิวแท่งคาร์บอนติดแม่พิมพ์รุนแรงหรือผงหลุดชัดเจน ให้หยุดผลิตทันทีและติดป้ายแยกผลิตภัณฑ์ชั่วคราว (สีแดง)',
    '测试样品需保留至本班次生产完成。': 'ต้องเก็บตัวอย่างทดสอบจนกว่ากะนี้ผลิตเสร็จ',
    'C-95客户相关产品脱模后立马进行首件检验。': 'ผลิตภัณฑ์ของลูกค้า C-95 ต้องตรวจชิ้นแรกทันทีหลังถอดแบบ',
  },
}

let files = 0
let keys = 0
for (const [loc, block] of Object.entries(BLOCKS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const anchor = "    \"已按成型工艺清单\":"
  const i = s.indexOf(anchor)
  if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  const add = Object.entries(block)
    .filter(([k]) => !s.includes(`"${k}":`))
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n')
  if (!add) { console.log(`SKIP ${loc}: 已全部存在`); continue }
  s = s.slice(0, i) + add + '\n' + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: +${add.split('\n').length} 条`)
  files++
  keys += add.split('\n').length
}
console.log(`\n共 ${files} 个语言包 / ${keys} 条词条`)
