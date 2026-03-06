import { Column, Row, Cell, ProjectData } from '../types';

export function createSampleData(): ProjectData {
  const columns: Column[] = [
    { id: 'col-name', name: '組織名', description: '対象組織の正式名称', order: 0, visible: true },
    { id: 'col-biz', name: '事業内容', description: '企業の主要事業・サービス・ミッション', order: 1, visible: true },
    { id: 'col-work', name: '業務内容', description: '求人票の責務・期待役割・プロジェクトタイプを箇条書きで', order: 2, visible: true },
    { id: 'col-time', name: '勤務時間', description: '勤務体系（フレックス・裁量労働等）、出社頻度、リモート制度', order: 3, visible: true },
    { id: 'col-pay', name: '報酬', description: '想定年収レンジ、残業代制度、賞与・インセンティブ', order: 4, visible: true },
    { id: 'col-benefit', name: '福利厚生', description: '社会保険・手当・研修制度・休暇制度等', order: 5, visible: true },
  ];

  const rows: Row[] = [
    { id: 'row-1', name: '株式会社UNCOVER TRUTH', order: 0, memo: '' },
    { id: 'row-2', name: 'ファインディ株式会社', order: 1, memo: '' },
    { id: 'row-3', name: '株式会社電通デジタル', order: 2, memo: '' },
  ];

  const cellData: Record<string, Record<string, string>> = {
    'row-1': {
      'col-name': '株式会社UNCOVER TRUTH',
      'col-biz': 'オンライン/オフラインのデータを統合した顧客データ環境（CDP）構築。統合データを活用し、CRM、LTV向上、顧客体験/ロイヤリティ向上の分析・施策実行支援。',
      'col-work': 'データ統合による事業成長支援のデータ分析。データ取得・統合設計、CDP基盤設計、データ活用コンサル。経営/マーケの意思決定に関わる提案活動。',
      'col-time': '裁量労働制：1日8時間（基本 9:30～18:30）。出社原則週1日（金曜）、他はリモート推奨。',
      'col-pay': '想定年収：500万〜700万（年俸制）。業績インセンティブあり。リモート手当（月1万）。',
      'col-benefit': '社会保険完備、通勤手当（実費）。資格取得/書籍購入/セミナー受講支援。飲食費/部活動費などコミュニケーション制度。',
    },
    'row-2': {
      'col-name': 'ファインディ株式会社',
      'col-biz': 'エンジニア向けHR Tech企業。プロダクト：Findy / Findy Freelance / Findy Team+ など。',
      'col-work': '事業成長の柱として「ビジネス」と「データ」を接続。事業課題特定、サービス改善分析、KPIモニタリング整備、A/Bテスト効果検証。データマート/DWH整備、機械学習・LLM活用。',
      'col-time': '10:00〜19:00（実働8時間）。時差出勤：8:00〜10:00で30分単位選択可。週3日程度出社のハイブリッド。',
      'col-pay': '想定年収：500万〜1,000万。月45時間分のみなし残業代含む。実績に応じた賞与あり。',
      'col-benefit': '社会保険完備、交通費支給（上限あり）。ランチ/ディナー補助。学習費用補助（プログラミング等）。',
    },
    'row-3': {
      'col-name': '株式会社電通デジタル',
      'col-biz': '電通グループのデータを活用したマーケ/事業変革支援。戦略策定〜施策立案〜AI/機械学習の効果検証・実装まで一気通貫のデジタルマーケ/DXコンサル。',
      'col-work': 'マーケ/営業課題に対するデータ利活用ソリューション企画・設計。Python/R/SQLで統計分析・機械学習モデル構築。課題整理とアクション提示。',
      'col-time': 'フレックス（所定7時間、基本 9:30〜17:30）。スーパーフレックス（5:00〜22:00、コアなし）or コアタイム付。出社率10〜20%程度。',
      'col-pay': '想定年収：420万〜1,500万。月30時間相当の固定残業代含む。業績連動賞与：年2回。リモート勤務手当（月4,000円）。',
      'col-benefit': '退職金（確定拠出年金）、各種休暇。育児/生活支援。電通健保の福利厚生、ベネフィット・ワン。研修制度充実。',
    },
  };

  const cells: Cell[] = [];
  for (const row of rows) {
    for (const col of columns) {
      cells.push({
        id: `${row.id}-${col.id}`,
        rowId: row.id,
        columnId: col.id,
        value: cellData[row.id]?.[col.id] || '',
        annotation: '',
      });
    }
  }

  return { columns, rows, cells, threads: [], interests: [] };
}
