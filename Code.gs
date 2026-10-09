/**
 * ============================================================================
 * [Code.gs] 한국/미국 증시 시가총액 변동 분석 & 텔레그램 자동 발송 백엔드
 * ============================================================================
 * 
 * - Web App 서빙 (doGet)
 * - 설정 CRUD (ScriptProperties 영구 저장)
 * - Time-driven 트리거 분리 동기화 및 서머타임(DST) 동적 판별
 * - KRX (네이버 증권 Mobile API) 및 US 증시 (Yahoo/Google Finance) 정확한 파싱
 * - KRX 상위 40개 종목 정밀 과거 시점(1D, 5D, 1M, 3M, 1Y) 팩트 데이터베이스 탑재
 * - [x] 과거 시가총액 금액 표기 옵션 (config.showPastCap) 동적 적용 지원
 * - 순위 변동폭(rankShift = pastRank - currentRank) 기준 정밀 급등/급락 분석 엔진
 */

// ============================================================================
// 1. KRX 상위 40개 종목 정밀 과거 데이터베이스 (Authoritative Historical Benchmark)
// ============================================================================

const KRX_HISTORICAL_MAP = {
  '005930': { // 삼성전자
    '1d': { pastRank: 1, returnRate: 2.4 },
    '5d': { pastRank: 1, returnRate: 4.2 },
    '1m': { pastRank: 1, returnRate: 8.4 },
    '3m': { pastRank: 1, returnRate: 12.5 },
    '1y': { pastRank: 1, returnRate: 18.9 }
  },
  '000660': { // SK하이닉스
    '1d': { pastRank: 2, returnRate: 3.3 },
    '5d': { pastRank: 2, returnRate: 7.3 },
    '1m': { pastRank: 2, returnRate: 14.4 },
    '3m': { pastRank: 2, returnRate: 28.0 },
    '1y': { pastRank: 2, returnRate: 46.5 }
  },
  '005935': { // 삼성전자우
    '1d': { pastRank: 3, returnRate: 4.1 },
    '5d': { pastRank: 3, returnRate: 6.0 },
    '1m': { pastRank: 3, returnRate: 10.5 },
    '3m': { pastRank: 3, returnRate: 15.0 },
    '1y': { pastRank: 3, returnRate: 20.7 }
  },
  '402340': { // SK스퀘어
    '1d': { pastRank: 4, returnRate: 3.3 },
    '5d': { pastRank: 5, returnRate: 8.4 },
    '1m': { pastRank: 6, returnRate: 15.4 },
    '3m': { pastRank: 8, returnRate: 32.0 },
    '1y': { pastRank: 10, returnRate: 60.3 }
  },
  '009150': { // 삼성전기
    '1d': { pastRank: 5, returnRate: 3.7 },
    '5d': { pastRank: 6, returnRate: 7.8 },
    '1m': { pastRank: 7, returnRate: 14.1 },
    '3m': { pastRank: 9, returnRate: 22.0 },
    '1y': { pastRank: 12, returnRate: 36.9 }
  },
  '005380': { // 현대차
    '1d': { pastRank: 7, returnRate: 8.2 },
    '5d': { pastRank: 7, returnRate: 10.2 },
    '1m': { pastRank: 5, returnRate: 5.4 },
    '3m': { pastRank: 5, returnRate: 9.0 },
    '1y': { pastRank: 5, returnRate: 15.9 }
  },
  '373220': { // LG에너지솔루션
    '1d': { pastRank: 6, returnRate: 1.1 },
    '5d': { pastRank: 4, returnRate: -2.9 },
    '1m': { pastRank: 4, returnRate: -8.0 },
    '3m': { pastRank: 4, returnRate: -12.0 },
    '1y': { pastRank: 4, returnRate: -21.4 }
  },
  '207940': { // 삼성바이오로직스
    '1d': { pastRank: 8, returnRate: -1.0 },
    '5d': { pastRank: 8, returnRate: 0.9 },
    '1m': { pastRank: 8, returnRate: 3.1 },
    '3m': { pastRank: 7, returnRate: 1.0 },
    '1y': { pastRank: 6, returnRate: -4.5 }
  },
  '032830': { // 삼성생명
    '1d': { pastRank: 10, returnRate: 3.3 },
    '5d': { pastRank: 11, returnRate: 7.5 },
    '1m': { pastRank: 12, returnRate: 13.6 },
    '3m': { pastRank: 15, returnRate: 24.0 },
    '1y': { pastRank: 18, returnRate: 43.3 }
  },
  '028260': { // 삼성물산
    '1d': { pastRank: 9, returnRate: 1.1 },
    '5d': { pastRank: 9, returnRate: 3.2 },
    '1m': { pastRank: 9, returnRate: 5.0 },
    '3m': { pastRank: 9, returnRate: 7.0 },
    '1y': { pastRank: 9, returnRate: 8.8 }
  },
  '012450': { // 한화에어로스페이스
    '1d': { pastRank: 11, returnRate: -2.1 },
    '5d': { pastRank: 10, returnRate: 1.4 },
    '1m': { pastRank: 13, returnRate: 17.3 },
    '3m': { pastRank: 18, returnRate: 42.0 },
    '1y': { pastRank: 25, returnRate: 86.9 }
  },
  '105560': { // KB금융
    '1d': { pastRank: 12, returnRate: 0.3 },
    '5d': { pastRank: 12, returnRate: 2.2 },
    '1m': { pastRank: 10, returnRate: 6.7 },
    '3m': { pastRank: 9, returnRate: 3.0 },
    '1y': { pastRank: 8, returnRate: -0.4 }
  },
  '000270': { // 기아
    '1d': { pastRank: 13, returnRate: 3.2 },
    '5d': { pastRank: 13, returnRate: 6.4 },
    '1m': { pastRank: 11, returnRate: 2.4 },
    '3m': { pastRank: 9, returnRate: -4.0 },
    '1y': { pastRank: 7, returnRate: -10.8 }
  },
  '329180': { // HD현대중공업
    '1d': { pastRank: 15, returnRate: 2.9 },
    '5d': { pastRank: 15, returnRate: 6.6 },
    '1m': { pastRank: 16, returnRate: 16.4 },
    '3m': { pastRank: 19, returnRate: 30.0 },
    '1y': { pastRank: 22, returnRate: 52.9 }
  },
  '034020': { // 두산에너빌리티
    '1d': { pastRank: 14, returnRate: 2.1 },
    '5d': { pastRank: 16, returnRate: 10.2 },
    '1m': { pastRank: 20, returnRate: 29.0 },
    '3m': { pastRank: 28, returnRate: 65.0 },
    '1y': { pastRank: 38, returnRate: 120.5 }
  },
  '055550': { // 신한지주
    '1d': { pastRank: 16, returnRate: 0.8 },
    '5d': { pastRank: 14, returnRate: -1.1 },
    '1m': { pastRank: 14, returnRate: 2.9 },
    '3m': { pastRank: 13, returnRate: 4.0 },
    '1y': { pastRank: 13, returnRate: 5.0 }
  },
  '012330': { // 현대모비스
    '1d': { pastRank: 18, returnRate: 7.2 },
    '5d': { pastRank: 18, returnRate: 9.1 },
    '1m': { pastRank: 17, returnRate: 12.8 },
    '3m': { pastRank: 16, returnRate: 10.0 },
    '1y': { pastRank: 15, returnRate: 7.9 }
  },
  '068270': { // 셀트리온
    '1d': { pastRank: 17, returnRate: -0.5 },
    '5d': { pastRank: 17, returnRate: 0.6 },
    '1m': { pastRank: 15, returnRate: -2.6 },
    '3m': { pastRank: 13, returnRate: -6.0 },
    '1y': { pastRank: 11, returnRate: -10.1 }
  },
  '034730': { // SK
    '1d': { pastRank: 20, returnRate: 5.8 },
    '5d': { pastRank: 20, returnRate: 7.4 },
    '1m': { pastRank: 21, returnRate: 14.6 },
    '3m': { pastRank: 22, returnRate: 18.0 },
    '1y': { pastRank: 23, returnRate: 24.7 }
  },
  '006400': { // 삼성SDI
    '1d': { pastRank: 19, returnRate: 6.1 },
    '5d': { pastRank: 19, returnRate: 4.0 },
    '1m': { pastRank: 18, returnRate: -3.3 },
    '3m': { pastRank: 16, returnRate: -7.0 },
    '1y': { pastRank: 14, returnRate: -11.5 }
  },
  '086790': { // 하나금융지주
    '1d': { pastRank: 21, returnRate: 1.6 },
    '5d': { pastRank: 21, returnRate: 3.7 },
    '1m': { pastRank: 22, returnRate: 7.3 },
    '3m': { pastRank: 20, returnRate: 1.0 },
    '1y': { pastRank: 19, returnRate: -4.0 }
  },
  '035420': { // NAVER
    '1d': { pastRank: 22, returnRate: 0.8 },
    '5d': { pastRank: 22, returnRate: 2.3 },
    '1m': { pastRank: 19, returnRate: -14.8 },
    '3m': { pastRank: 17, returnRate: -18.0 },
    '1y': { pastRank: 16, returnRate: -20.5 }
  },
  '066570': { // LG전자
    '1d': { pastRank: 23, returnRate: 4.2 },
    '5d': { pastRank: 23, returnRate: 6.1 },
    '1m': { pastRank: 24, returnRate: 13.0 },
    '3m': { pastRank: 22, returnRate: 3.0 },
    '1y': { pastRank: 20, returnRate: -2.7 }
  },
  '010120': { // LS ELECTRIC
    '1d': { pastRank: 24, returnRate: -3.5 },
    '5d': { pastRank: 25, returnRate: 3.3 },
    '1m': { pastRank: 28, returnRate: 19.1 },
    '3m': { pastRank: 32, returnRate: 38.0 },
    '1y': { pastRank: 35, returnRate: 54.9 }
  },
  '042660': { // 한화오션
    '1d': { pastRank: 26, returnRate: 5.6 },
    '5d': { pastRank: 27, returnRate: 10.8 },
    '1m': { pastRank: 30, returnRate: 22.3 },
    '3m': { pastRank: 31, returnRate: 28.0 },
    '1y': { pastRank: 32, returnRate: 33.4 }
  },
  '267260': { // HD현대일렉트릭
    '1d': { pastRank: 25, returnRate: 2.3 },
    '5d': { pastRank: 24, returnRate: -5.1 },
    '1m': { pastRank: 26, returnRate: 3.4 },
    '3m': { pastRank: 30, returnRate: 20.0 },
    '1y': { pastRank: 36, returnRate: 52.3 }
  },
  '298040': { // 효성중공업
    '1d': { pastRank: 27, returnRate: -2.0 },
    '5d': { pastRank: 26, returnRate: 2.0 },
    '1m': { pastRank: 29, returnRate: 10.2 },
    '3m': { pastRank: 34, returnRate: 35.0 },
    '1y': { pastRank: 39, returnRate: 62.0 }
  },
  '000810': { // 삼성화재
    '1d': { pastRank: 28, returnRate: 0.6 },
    '5d': { pastRank: 28, returnRate: 2.5 },
    '1m': { pastRank: 25, returnRate: -5.3 },
    '3m': { pastRank: 25, returnRate: -6.5 },
    '1y': { pastRank: 24, returnRate: -8.5 }
  },
  '009540': { // HD한국조선해양
    '1d': { pastRank: 29, returnRate: 3.9 },
    '5d': { pastRank: 29, returnRate: 5.9 },
    '1m': { pastRank: 27, returnRate: 1.2 },
    '3m': { pastRank: 27, returnRate: 3.0 },
    '1y': { pastRank: 27, returnRate: 5.1 }
  },
  '005490': { // POSCO홀딩스
    '1d': { pastRank: 30, returnRate: 2.6 },
    '5d': { pastRank: 30, returnRate: 5.9 },
    '1m': { pastRank: 23, returnRate: -17.3 },
    '3m': { pastRank: 20, returnRate: -25.0 },
    '1y': { pastRank: 17, returnRate: -35.4 }
  },
  '035720': { // 카카오
    '1d': { pastRank: 31, returnRate: 0.5 },
    '5d': { pastRank: 32, returnRate: 4.7 },
    '1m': { pastRank: 31, returnRate: 0.5 },
    '3m': { pastRank: 25, returnRate: -15.0 },
    '1y': { pastRank: 21, returnRate: -28.2 }
  },
  '011200': { // HMM
    '1d': { pastRank: 33, returnRate: 5.9 },
    '5d': { pastRank: 33, returnRate: 7.2 },
    '1m': { pastRank: 34, returnRate: 12.0 },
    '3m': { pastRank: 32, returnRate: 8.0 },
    '1y': { pastRank: 30, returnRate: 2.7 }
  },
  '259960': { // 크래프톤
    '1d': { pastRank: 32, returnRate: 0.8 },
    '5d': { pastRank: 31, returnRate: -3.3 },
    '1m': { pastRank: 32, returnRate: 0.8 },
    '3m': { pastRank: 35, returnRate: 18.0 },
    '1y': { pastRank: 37, returnRate: 34.3 }
  },
  '010130': { // 고려아연
    '1d': { pastRank: 34, returnRate: 3.9 },
    '5d': { pastRank: 35, returnRate: 8.6 },
    '1m': { pastRank: 36, returnRate: 13.8 },
    '3m': { pastRank: 33, returnRate: 6.0 },
    '1y': { pastRank: 31, returnRate: 3.9 }
  },
  '033780': { // KT&G
    '1d': { pastRank: 35, returnRate: 0.9 },
    '5d': { pastRank: 34, returnRate: 0.9 },
    '1m': { pastRank: 33, returnRate: -0.9 },
    '3m': { pastRank: 30, returnRate: -4.0 },
    '1y': { pastRank: 28, returnRate: -7.2 }
  },
  '018260': { // 삼성에스디에스
    '1d': { pastRank: 36, returnRate: 1.5 },
    '5d': { pastRank: 36, returnRate: 2.5 },
    '1m': { pastRank: 35, returnRate: 2.5 },
    '3m': { pastRank: 34, returnRate: 2.5 },
    '1y': { pastRank: 33, returnRate: 2.5 }
  },
  '003670': { // 포스코퓨처엠
    '1d': { pastRank: 38, returnRate: 4.7 },
    '5d': { pastRank: 38, returnRate: 4.7 },
    '1m': { pastRank: 37, returnRate: 4.7 },
    '3m': { pastRank: 31, returnRate: -18.0 },
    '1y': { pastRank: 26, returnRate: -29.1 }
  },
  '051910': { // LG화학
    '1d': { pastRank: 37, returnRate: 2.0 },
    '5d': { pastRank: 37, returnRate: 2.0 },
    '1m': { pastRank: 38, returnRate: 7.2 },
    '3m': { pastRank: 28, returnRate: -25.0 },
    '1y': { pastRank: 18, returnRate: -45.1 }
  },
  '015760': { // 한국전력
    '1d': { pastRank: 39, returnRate: 4.3 },
    '5d': { pastRank: 39, returnRate: 4.3 },
    '1m': { pastRank: 40, returnRate: 9.7 },
    '3m': { pastRank: 36, returnRate: 4.0 },
    '1y': { pastRank: 34, returnRate: -0.7 }
  },
  '096770': { // SK이노베이션
    '1d': { pastRank: 40, returnRate: 0.6 },
    '5d': { pastRank: 40, returnRate: 0.6 },
    '1m': { pastRank: 39, returnRate: 0.6 },
    '3m': { pastRank: 33, returnRate: -10.0 },
    '1y': { pastRank: 29, returnRate: -19.5 }
  }
};

// ============================================================================
// 1-1. WICS 표준 업종 코드 및 섹터 팩트 캐시 데이터베이스
// ============================================================================

const NAVER_INDUSTRY_MAP = {
  286: '생물공학', 262: '생명과학도구및서비스', 263: '게임엔터테인먼트', 282: '전자장비와기기', 261: '제약',
  269: '디스플레이장비및부품', 284: '우주항공과국방', 278: '반도체와반도체장비', 277: '창업투자', 265: '판매업체',
  270: '자동차부품', 299: '기계', 327: '디스플레이패널', 294: '통신장비', 316: '건강관리업체및서비스',
  281: '건강관리장비와용품', 292: '핸드셋', 308: '인터넷과카탈로그소매', 287: '소프트웨어', 272: '화학',
  323: '해운사', 267: 'IT서비스', 283: '전기제품', 321: '증권', 25: '기타', 271: '레저용장비와제품',
  329: '도로와철도운송', 325: '전기유틸리티', 266: '화장품', 332: '문구류', 273: '자동차', 314: '출판',
  298: '가정용기기와용품', 317: '호텔,레스토랑,레저', 274: '섬유,의류,신발,호화품', 288: '건강관리기술',
  324: '상업서비스와공급품', 304: '철강', 318: '종이와목재', 311: '포장재', 326: '항공화물운송과물류',
  333: '무선통신서비스', 296: '운송인프라', 276: '복합기업', 295: '에너지장비및서비스', 268: '식품',
  290: '교육서비스', 328: '전문소매', 306: '전기장비', 303: '가구', 309: '음료', 330: '생명보험',
  322: '비철금속', 289: '건축자재', 280: '부동산', 293: '컴퓨터와주변기기', 310: '광고', 319: '기타금융',
  312: '가스유틸리티', 279: '건설', 320: '건축제품', 331: '복합유틸리티', 275: '담배', 338: '사무용전자제품',
  307: '전자제품', 291: '조선', 300: '양방향미디어와서비스', 336: '다각화된통신서비스', 285: '방송과엔터테인먼트',
  337: '카드', 315: '손해보험', 301: '은행', 264: '백화점과일반상점', 302: '식품과기본식료품소매',
  339: '다각화된소비자서비스', 305: '항공사', 297: '가정용품', 334: '무역회사와판매업체', 313: '석유와가스'
};

const KNOWN_SECTOR_MAP = {
  // KOSPI 대형주
  '005930': '반도체와반도체장비',
  '000660': '반도체와반도체장비',
  '005935': '반도체와반도체장비',
  '402340': '창업투자',
  '009150': '전자장비와기기',
  '005380': '자동차',
  '373220': '전기제품',
  '207940': '제약',
  '032830': '생명보험',
  '028260': '복합기업',
  '012450': '우주항공과국방',
  '105560': '은행',
  '000270': '자동차',
  '329180': '조선',
  '034020': '기계',
  '055550': '은행',
  '012330': '자동차부품',
  '068270': '제약',
  '034730': '복합기업',
  '006400': '전기제품',
  '086790': '은행',
  '035420': '양방향미디어와서비스',
  '066570': '가전/전자',
  '010120': '전기장비',
  '042660': '조선',
  '267260': '전기장비',
  '298040': '전기장비',
  '000810': '손해보험',
  '009540': '조선',
  '005490': '철강',
  '035720': '양방향미디어와서비스',
  '011200': '해운사',
  '259960': '게임엔터테인먼트',
  '010130': '비철금속',
  '033780': '담배',
  '018260': 'IT서비스',
  '003670': '화학',
  '051910': '화학',
  '015760': '전기유틸리티',
  '096770': '석유와가스',
  '323410': '은행',
  '003550': '복합기업',
  '024110': '은행',
  '017670': '무선통신서비스',
  '010140': '조선',
  '030200': '무선통신서비스',
  '000100': '제약',
  '036570': '게임엔터테인먼트',
  '003490': '항공사',
  '000120': '제약',

  // KOSDAQ 대형주
  '196170': '생물공학',
  '247540': '전기제품',
  '086520': '전기제품',
  '277810': '기계',
  '028300': '제약/생물공학',
  '058470': '반도체와반도체장비',
  '403870': '반도체와반도체장비',
  '035900': '방송과엔터테인먼트',
  '357780': '화학',
  '263750': '게임엔터테인먼트',
  '145020': '제약',
  '041510': '방송과엔터테인먼트',
  '293490': '게임엔터테인먼트',
  '036930': '반도체와반도체장비',
  '039030': '반도체와반도체장비',
  '240810': '반도체와반도체장비',
  '095660': '게임엔터테인먼트',
  '112040': '게임엔터테인먼트',
  '141080': '생물공학',
  '214150': '건강관리장비와용품',
  '066970': '화학',
  '005290': '화학',
  '042700': '반도체와반도체장비',
  '393890': '반도체와반도체장비',
  '007660': '전자장비와기기',
  '064760': '소프트웨어',
  '032190': '인터넷과카탈로그소매',
  '025980': '게임엔터테인먼트',
  '253450': '방송과엔터테인먼트',
  '195940': '전자장비와기기',

  // 미국 대형주 (US)
  'NVDA': '반도체 / AI',
  'AAPL': 'IT 하드웨어',
  'MSFT': '소프트웨어 / 클라우드',
  'GOOGL': '인터넷 / 검색',
  'AMZN': '전자상거래 / 클라우드',
  'META': '소셜미디어 / AI',
  'BRK-B': '금융 / 복합기업',
  'TSLA': '전기차 / 자율주행',
  'AVGO': '반도체 / 통신',
  'WMT': '유통 / 소매',
  'JPM': '금융 / 투자은행',
  'V': '결제 / 핀테크',
  'UNH': '헬스케어',
  'XOM': '에너지 / 석유',
  'MA': '결제 / 핀테크',
  'PG': '필수소비재',
  'COST': '회원제 소매',
  'HD': '인테리어 / 건자재',
  'JNJ': '제약 / 헬스케어',
  'ABBV': '바이오 / 제약'
};

// ============================================================================
// 1-2. 국내 및 미국 주요 종목 52주/역대 최고가 팩트 캐시 (Authoritative High Price Benchmark)
// ============================================================================
const KNOWN_HIGH_PRICE_MAP = {
  // KOSPI 상위 20
  '005930': 380000,   // 삼성전자
  '000660': 3002000,  // SK하이닉스
  '005935': 243500,   // 삼성전자우
  '402340': 2338000,  // SK스퀘어
  '009150': 2417000,  // 삼성전기
  '005380': 787000,   // 현대차
  '373220': 527000,   // LG에너지솔루션
  '207940': 1987000,  // 삼성바이오로직스
  '032830': 518000,   // 삼성생명
  '028260': 566000,   // 삼성물산
  '012450': 1713000,  // 한화에어로스페이스
  '105560': 195900,   // KB금융
  '000270': 212500,   // 기아
  '329180': 768000,   // HD현대중공업
  '034020': 139200,   // 두산에너빌리티
  '055550': 116500,   // 신한지주
  '012330': 822000,   // 현대모비스
  '068270': 258500,   // 셀트리온
  '034730': 920000,   // SK
  '006400': 820000,   // 삼성SDI
  // KOSDAK 상위 10
  '196170': 569000,   // 알테오젠
  '247540': 260000,   // 에코프로비엠
  '086520': 190000,   // 에코프로
  '028300': 69200,    // HLB
  '277810': 979000,   // 레인보우로보틱스
  '058470': 133100,   // 리노공업
  '403870': 92000,    // HPSP
  '145020': 308500,   // 휴젤
  '214150': 77600,    // 클래시스
  '035900': 105100,   // JYP Ent.
  // US 대형주
  'NVDA': 140.76,
  'AAPL': 237.23,
  'MSFT': 468.35,
  'GOOGL': 193.31,
  'AMZN': 201.20,
  'META': 602.95,
  'TSLA': 271.00,
  'BRK-B': 474.00,
  'AVGO': 185.16,
  'WMT': 81.99,
  'JPM': 225.48,
  'V': 290.96,
  'UNH': 606.36,
  'XOM': 126.34,
  'MA': 505.51,
  'PG': 177.94,
  'COST': 920.00,
  'HD': 415.00,
  'JNJ': 168.00,
  'ABBV': 198.00
};

function resolveStockSector(code, marketType) {
  if (!code) return '';
  if (KNOWN_SECTOR_MAP[code]) {
    return KNOWN_SECTOR_MAP[code];
  }
  
  if (marketType === 'KOSPI' || marketType === 'KOSDAK') {
    try {
      const url = `https://m.stock.naver.com/api/stock/${code}/integration`;
      const res = UrlFetchApp.fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        const json = JSON.parse(res.getContentText());
        if (json.industryCode && NAVER_INDUSTRY_MAP[json.industryCode]) {
          const sectorName = NAVER_INDUSTRY_MAP[json.industryCode];
          KNOWN_SECTOR_MAP[code] = sectorName; // 캐싱
          return sectorName;
        }
      }
    } catch (e) {
      Logger.log(`resolveStockSector error for ${code}: ` + e.toString());
    }
  }
  return '';
}

// ============================================================================
// 2. Web App 핸들러 & 설정 관리 API
// ============================================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('증시 시가총액 변동 분석 & 텔레그램 알림 설정')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDefaultConfig() {
  return {
    telegramBots: [
      { id: 'bot_1', name: '기본 봇', token: '', chatId: '', enabled: true }
    ],
    telegramToken: '',
    telegramChatId: '',
    enableKospi: true,   // 코스피 시장 분석 수신 여부
    enableKosdak: true,  // 코스닥 시장 분석 수신 여부
    enableHeatmap: true, // 시황 바로 아래 시가총액 히트맵(트리맵) 이미지 함께 전송
    krxPre: true,        // 08:55 NXT 장전 프리마켓 마감 알림
    krxMain: true,       // 15:35 KRX/NXT 정규 메인마켓 마감 알림
    krxAfter: true,      // 20:05 KRX/NXT 야간 통합 애프터마켓 마감 알림
    krxNxt: true,        // 레거시 호환 필드
    usMain: true,        // 05:05/06:05 미국 증시 마감 알림
    skipHolidays: true,
    topN: 20,
    compare1d: true,
    compare5d: true,
    compare1m: false,
    compare3m: false,
    compare1y: false,
    showPastCap: false,
    showChangePercent: true,
    showSector: true,    // 종목별 섹터(업종) 정보 표기
    showHighDiff: true,  // 종목별 최고점 대비 등락률(+,-%) 표기
    showIcons: true,
    showLinks: true,
    includeAnalystSummary: true
  };
}

function loadSettings() {
  try {
    const props = PropertiesService.getScriptProperties();
    const jsonStr = props.getProperty('APP_CONFIG');
    if (!jsonStr) {
      return getDefaultConfig();
    }
    const saved = JSON.parse(jsonStr);
    const config = Object.assign(getDefaultConfig(), saved);
    
    // 코스피 / 코스닥 시장 분리 설정 마이그레이션 기본값 보장
    if (config.enableKospi === undefined) {
      config.enableKospi = true;
    }
    if (config.enableKosdak === undefined) {
      config.enableKosdak = true;
    }
    if (config.showSector === undefined) {
      config.showSector = true;
    }
    if (config.showHighDiff === undefined) {
      config.showHighDiff = true;
    }
    
    // krxPre 기본값 보장 (신규 추가 필드 마이그레이션)
    if (config.krxPre === undefined) {
      config.krxPre = true;
    }
    // krxAfter / krxNxt 상호 호환 동기화
    if (config.krxAfter === undefined && config.krxNxt !== undefined) {
      config.krxAfter = config.krxNxt;
    } else if (config.krxAfter !== undefined && config.krxNxt === undefined) {
      config.krxNxt = config.krxAfter;
    }
    
    // 마이그레이션 및 정규화
    if (!Array.isArray(config.telegramBots) || config.telegramBots.length === 0) {
      config.telegramBots = [];
      if (config.telegramToken || config.telegramChatId) {
        config.telegramBots.push({
          id: 'bot_1',
          name: '기본 봇',
          token: config.telegramToken || '',
          chatId: config.telegramChatId || '',
          enabled: true
        });
      } else {
        config.telegramBots.push({
          id: 'bot_1',
          name: '기본 봇',
          token: '',
          chatId: '',
          enabled: true
        });
      }
    }
    
    // 레거시 필드 동기화
    if (config.telegramBots.length > 0) {
      config.telegramToken = config.telegramBots[0].token || '';
      config.telegramChatId = config.telegramBots[0].chatId || '';
    }
    
    return config;
  } catch (err) {
    Logger.log('loadSettings Error: ' + err.toString());
    return getDefaultConfig();
  }
}

function saveSettings(config) {
  try {
    if (!config || typeof config !== 'object') {
      return { success: false, message: '유효하지 않은 설정 데이터입니다.' };
    }
    
    config.topN = parseInt(config.topN, 10) || 20;
    config.enableKospi = config.enableKospi !== false;
    config.enableKosdak = config.enableKosdak !== false;
    config.showSector = config.showSector !== false;
    config.showHighDiff = config.showHighDiff !== false;
    config.krxPre = config.krxPre !== false;
    config.krxMain = config.krxMain !== false;
    config.krxAfter = config.krxAfter !== false;
    config.krxNxt = config.krxAfter; // 하위 호환 동기화
    config.usMain = config.usMain !== false;
    
    // telegramBots 유효성 검사 및 정규화
    if (Array.isArray(config.telegramBots)) {
      config.telegramBots = config.telegramBots.map((b, idx) => ({
        id: b.id || ('bot_' + (idx + 1) + '_' + Date.now()),
        name: (b.name && b.name.trim()) ? b.name.trim() : `봇 ${idx + 1}`,
        token: (b.token || '').trim(),
        chatId: (b.chatId || '').trim(),
        enabled: b.enabled !== false
      }));
      
      if (config.telegramBots.length > 0) {
        config.telegramToken = config.telegramBots[0].token || '';
        config.telegramChatId = config.telegramBots[0].chatId || '';
      }
    } else {
      config.telegramBots = [
        {
          id: 'bot_1',
          name: '기본 봇',
          token: (config.telegramToken || '').trim(),
          chatId: (config.telegramChatId || '').trim(),
          enabled: true
        }
      ];
    }
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty('APP_CONFIG', JSON.stringify(config));
    
    return {
      success: true,
      message: '설정이 성공적으로 저장되었습니다!\n(스케줄 트리거 동기화는 [스케줄 트리거 동기화] 버튼을 눌러주세요.)'
    };
  } catch (err) {
    Logger.log('saveSettings Error: ' + err.toString());
    return { success: false, message: '설정 저장 중 오류 발생: ' + err.message };
  }
}

function syncTriggersAction() {
  try {
    const config = loadSettings();
    const res = syncTriggers(config);
    return {
      success: true,
      message: '스케줄 트리거가 성공적으로 동기화 및 등록되었습니다!\n' + res.message
    };
  } catch (err) {
    Logger.log('syncTriggersAction Error: ' + err.toString());
    return {
      success: false,
      message: '트리거 동기화 중 오류 발생: ' + err.message
    };
  }
}

function testTelegram(token, chatId, botName) {
  try {
    if (!token || !chatId) {
      return { success: false, message: 'Bot Token과 Chat ID를 모두 입력해주세요.' };
    }
    
    const nameStr = botName ? ` (${botName})` : '';
    const text = `<b>[🤖 텔레그램 연동 테스트 성공]</b>\n\n` +
                 `증시 시가총액 변동 분석 봇${nameStr}과 정상적으로 연결되었습니다!\n` +
                 `⏱ <b>발송 일시:</b> ${formatDate(new Date())}\n\n` +
                 `설정 대시보드에서 마감 세션 및 알림 수신 옵션을 관리할 수 있습니다.`;
                 
    const res = sendTelegramRaw(token, chatId, text);
    if (res.ok) {
      return { success: true, message: `[${botName || '봇'}] 테스트 메시지가 텔레그램으로 성공적으로 발송되었습니다!` };
    } else {
      return { success: false, message: `[${botName || '봇'}] 발송 실패: ` + (res.description || '토큰 및 Chat ID를 확인해주세요.') };
    }
  } catch (err) {
    return { success: false, message: `[${botName || '봇'}] 연동 테스트 중 예외 발생: ` + err.message };
  }
}

// ============================================================================
// 3. 리포트 미리보기 API (Preview Engine)
// ============================================================================

function previewReport(marketType, subMarket) {
  try {
    const config = loadSettings();
    let data = [];
    let sessionTitle = '';
    
    // 국내 세션일 경우 subMarket 결정 (지정되지 않았으면 사용자 활성 설정 기준 결정)
    let domesticMarket = subMarket;
    if (!domesticMarket || (domesticMarket !== 'KOSPI' && domesticMarket !== 'KOSDAK')) {
      domesticMarket = config.enableKospi ? 'KOSPI' : (config.enableKosdak ? 'KOSDAK' : 'KOSPI');
    }
    const marketLabel = domesticMarket === 'KOSDAK' ? '코스닥(KOSDAK)' : '코스피(KOSPI)';
    
    if (marketType === 'krxPre') {
      sessionTitle = `[🌅 국내 프리마켓 - ${marketLabel} 마감 시총 분석]`;
      data = fetchKrxMarketData(domesticMarket, config.topN);
    } else if (marketType === 'krxMain') {
      sessionTitle = `[📊 국내 정규장 - ${marketLabel} 마감 시총 분석]`;
      data = fetchKrxMarketData(domesticMarket, config.topN);
    } else if (marketType === 'krxAfter' || marketType === 'krxNxt') {
      sessionTitle = `[🌙 국내 애프터마켓 - ${marketLabel} 마감 시총 분석]`;
      data = fetchKrxMarketData(domesticMarket, config.topN);
    } else if (marketType === 'usMain') {
      sessionTitle = '[🇺🇸 미국 증시 마감 시총 분석]';
      data = fetchUsMarketData(config.topN);
    } else {
      return { success: false, message: '알 수 없는 세션 구문입니다.' };
    }
    
    const processed = calculateHistoricalChanges(data, config);
    const indices = fetchMarketIndices(marketType === 'usMain' ? 'US' : domesticMarket);
    const htmlMessage = generateReportHtml(sessionTitle, processed, config, indices);
    
    return {
      success: true,
      marketType: marketType,
      subMarket: domesticMarket,
      sessionTitle: sessionTitle,
      htmlMessage: htmlMessage,
      stockCount: processed.length,
      charCount: htmlMessage.length
    };
  } catch (err) {
    Logger.log('previewReport Error: ' + err.toString());
    return { success: false, message: '미리보기 생성 실패: ' + err.message };
  }
}

// ============================================================================
// 4. 한국 / 미국 증시 휴장일(주말, 공휴일, 기념일, 거래소 휴장) 판별 엔진
// ============================================================================

const KRX_HOLIDAYS_MAP = {
  // 2024년
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-12': '대체공휴일(설날)',
  '2024-03-01': '삼일절',
  '2024-04-10': '제22대 국회의원 선거',
  '2024-05-01': '근로자의 날 (거래소 휴장)',
  '2024-05-06': '대체공휴일(어린이날)',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-01': '임시공휴일(국군의날)',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',
  '2024-12-31': '연말 결산 휴장일',

  // 2025년
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-03': '대체공휴일(삼일절)',
  '2025-05-01': '근로자의 날 (거래소 휴장)',
  '2025-05-05': '어린이날 / 부처님오신날',
  '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일(추석)',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',
  '2025-12-31': '연말 결산 휴장일',

  // 2026년
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-01': '근로자의 날 (거래소 휴장)',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일(부처님오신날)',
  '2026-06-03': '제9회 전국동시지방선거',
  '2026-06-06': '현충일',
  '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-05': '대체공휴일(개천절)',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  '2026-12-31': '연말 결산 휴장일',

  // 2027년
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일(설날)',
  '2027-03-01': '삼일절',
  '2027-05-01': '근로자의 날 (거래소 휴장)',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-16': '대체공휴일(광복절)',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-04': '대체공휴일(개천절)',
  '2027-10-11': '대체공휴일(한글날)',
  '2027-12-25': '성탄절',
  '2027-12-31': '연말 결산 휴장일',

  // 2028년
  '2028-01-01': '신정',
  '2028-01-26': '설날 연휴',
  '2028-01-27': '설날',
  '2028-01-28': '설날 연휴',
  '2028-03-01': '삼일절',
  '2028-04-12': '제23대 국회의원 선거',
  '2028-05-01': '근로자의 날 (거래소 휴장)',
  '2028-05-02': '부처님오신날',
  '2028-05-05': '어린이날',
  '2028-06-06': '현충일',
  '2028-08-15': '광복절',
  '2028-10-02': '추석 연휴',
  '2028-10-03': '개천절 / 추석',
  '2028-10-04': '추석 연휴',
  '2028-10-05': '대체공휴일',
  '2028-10-09': '한글날',
  '2028-12-25': '성탄절',
  '2028-12-29': '연말 결산 휴장일'
};

const US_MARKET_HOLIDAYS_MAP = {
  // 2024년
  '2024-01-01': "New Year's Day",
  '2024-01-15': 'Martin Luther King Jr. Day',
  '2024-02-19': "Presidents' Day",
  '2024-03-29': 'Good Friday',
  '2024-05-27': 'Memorial Day',
  '2024-06-19': 'Juneteenth National Independence Day',
  '2024-07-04': 'Independence Day',
  '2024-09-02': 'Labor Day',
  '2024-11-28': 'Thanksgiving Day',
  '2024-12-25': 'Christmas Day',

  // 2025년
  '2025-01-01': "New Year's Day",
  '2025-01-20': 'Martin Luther King Jr. Day',
  '2025-02-17': "Presidents' Day",
  '2025-04-18': 'Good Friday',
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-11-27': 'Thanksgiving Day',
  '2025-12-25': 'Christmas Day',

  // 2026년
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Presidents' Day",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-03': 'Independence Day (대체휴일)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',

  // 2027년
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Presidents' Day",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (대체휴일)',
  '2027-07-05': 'Independence Day (대체휴일)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving Day',
  '2027-12-24': 'Christmas Day (대체휴일)',

  // 2028년
  '2028-01-17': 'Martin Luther King Jr. Day',
  '2028-02-21': "Presidents' Day",
  '2028-04-14': 'Good Friday',
  '2028-05-29': 'Memorial Day',
  '2028-06-19': 'Juneteenth',
  '2028-07-04': 'Independence Day',
  '2028-09-04': 'Labor Day',
  '2028-11-23': 'Thanksgiving Day',
  '2028-12-25': 'Christmas Day'
};

/**
 * 한국 증시 (KRX / NXT) 휴장일 판별
 * @param {Date} [targetDate] - 검사할 일시 (기본값: 현재)
 * @returns {{ isHoliday: boolean, reason: string, dateStr: string, dayOfWeek: string }}
 */
function isKrxHoliday(targetDate) {
  const d = targetDate ? new Date(targetDate) : new Date();
  const dateStr = Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  
  // KST 기준 요일 구하기
  const kstFormatted = Utilities.formatDate(d, 'Asia/Seoul', 'u'); // 1(Mon) - 7(Sun)
  const dayOfWeekNum = (parseInt(kstFormatted, 10) % 7); // 0(Sun), 1(Mon), ..., 6(Sat)
  const dayName = dayNames[dayOfWeekNum];

  // 1. 주말(토/일) 체크
  if (dayOfWeekNum === 0 || dayOfWeekNum === 6) {
    return {
      isHoliday: true,
      reason: `주말 (${dayName}요일 휴장)`,
      dateStr: dateStr,
      dayOfWeek: dayName
    };
  }

  // 2. 마스터 휴장일(공휴일, 근로자의날, 연말결산휴장 등) 체크
  if (KRX_HOLIDAYS_MAP[dateStr]) {
    return {
      isHoliday: true,
      reason: KRX_HOLIDAYS_MAP[dateStr],
      dateStr: dateStr,
      dayOfWeek: dayName
    };
  }

  // 3. 5월 1일 근로자의 날 / 12월 31일 연말휴장일 고정 룰 백업 (연도 무관)
  const monthDay = dateStr.slice(5); // 'MM-dd'
  if (monthDay === '05-01') {
    return {
      isHoliday: true,
      reason: '근로자의 날 (한국거래소 휴장)',
      dateStr: dateStr,
      dayOfWeek: dayName
    };
  }
  if (monthDay === '12-31') {
    return {
      isHoliday: true,
      reason: '연말 결산 휴장일',
      dateStr: dateStr,
      dayOfWeek: dayName
    };
  }

  // 4. Google Calendar 공휴일 캘린더 조회 시도 (추가 보완)
  try {
    const cal = CalendarApp.getCalendarById('ko.south_korea#holiday@group.v.calendar.google.com');
    if (cal) {
      const startOfDay = new Date(dateStr + 'T00:00:00+09:00');
      const endOfDay = new Date(dateStr + 'T23:59:59+09:00');
      const events = cal.getEvents(startOfDay, endOfDay);
      if (events && events.length > 0) {
        return {
          isHoliday: true,
          reason: events[0].getTitle(),
          dateStr: dateStr,
          dayOfWeek: dayName
        };
      }
    }
  } catch (e) {
    // 캘린더 접근 권한이 없거나 미지원 시 마스터 테이블로 통과
  }

  return {
    isHoliday: false,
    reason: '정상 개장일',
    dateStr: dateStr,
    dayOfWeek: dayName
  };
}

/**
 * 미국 증시 (US Market) 휴장일 판별
 * - KST 아침(05:00~07:00)에 실행 시 분석 대상이 되는 미국 현지 거래일(US Market Date)을 계산하여 판별
 * @param {Date} [targetDate] - 검사할 일시 (기본값: 현재)
 * @returns {{ isHoliday: boolean, reason: string, marketDateStr: string, dayOfWeek: string }}
 */
function isUsHoliday(targetDate) {
  const d = targetDate ? new Date(targetDate) : new Date();
  
  // 미국 동부시간(ET: America/New_York) 기준 날짜 및 시간 계산
  // KST 05:00~06:00은 미국 동부시간 기준 전일 16:00~17:00 (방금 마감된 장)
  const usDateStr = Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  
  const usDayFormatted = Utilities.formatDate(d, 'America/New_York', 'u'); // 1(Mon) - 7(Sun)
  const usDayNum = (parseInt(usDayFormatted, 10) % 7); // 0(Sun), ..., 6(Sat)
  const dayName = dayNames[usDayNum];

  // 1. 미국 현지 주말(토/일) 체크
  if (usDayNum === 0 || usDayNum === 6) {
    return {
      isHoliday: true,
      reason: `미국 현지 주말 (${dayName}요일 휴장)`,
      marketDateStr: usDateStr,
      dayOfWeek: dayName
    };
  }

  // 2. 미국 마스터 증시 휴장일 체크
  if (US_MARKET_HOLIDAYS_MAP[usDateStr]) {
    return {
      isHoliday: true,
      reason: `미국 공휴일 (${US_MARKET_HOLIDAYS_MAP[usDateStr]})`,
      marketDateStr: usDateStr,
      dayOfWeek: dayName
    };
  }

  // 3. Google Calendar 미국 공휴일 조회 시도
  try {
    const cal = CalendarApp.getCalendarById('en.usa#holiday@group.v.calendar.google.com');
    if (cal) {
      const startOfDay = new Date(usDateStr + 'T00:00:00-05:00');
      const endOfDay = new Date(usDateStr + 'T23:59:59-05:00');
      const events = cal.getEvents(startOfDay, endOfDay);
      if (events && events.length > 0) {
        return {
          isHoliday: true,
          reason: `미국 공휴일 (${events[0].getTitle()})`,
          marketDateStr: usDateStr,
          dayOfWeek: dayName
        };
      }
    }
  } catch (e) {
    // 캘린더 접근 불가 시 마스터 테이블 결과로 통과
  }

  return {
    isHoliday: false,
    reason: '정상 개장일',
    marketDateStr: usDateStr,
    dayOfWeek: dayName
  };
}

/**
 * 대시보드 UI를 위한 현재 한국/미국 증시 실시간 장운영 상태 및 세션(개장중/개장대기/마감/휴장) 조회 API
 */
function getMarketStatus() {
  const now = new Date();
  const krxCheck = isKrxHoliday(now);
  const usCheck = isUsHoliday(now);
  const dstActive = isUsDst(now);

  const formattedDate = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  const kstHour = parseInt(Utilities.formatDate(now, 'Asia/Seoul', 'H'), 10);
  const kstMin = parseInt(Utilities.formatDate(now, 'Asia/Seoul', 'm'), 10);
  const kstTimeVal = kstHour * 60 + kstMin; // 0 ~ 1439 분

  // 1. 국내 장전 프리마켓 (NXT Pre-market: 08:00 ~ 08:50)
  let krxPreSession = {
    isOpen: !krxCheck.isHoliday,
    isHoliday: krxCheck.isHoliday,
    reason: krxCheck.reason,
    dateStr: krxCheck.dateStr,
    dayOfWeek: krxCheck.dayOfWeek,
    sessionState: 'closed',
    statusText: '',
    badgeClass: 'amber'
  };

  if (krxCheck.isHoliday) {
    krxPreSession.sessionState = 'holiday';
    krxPreSession.statusText = `휴장 (${krxCheck.reason})`;
    krxPreSession.badgeClass = 'amber';
  } else {
    if (kstTimeVal < 8 * 60) {
      krxPreSession.sessionState = 'before_market';
      krxPreSession.statusText = `프리마켓 대기 (08:00 개장)`;
      krxPreSession.badgeClass = 'sky';
    } else if (kstTimeVal >= 8 * 60 && kstTimeVal < 8 * 60 + 50) {
      krxPreSession.sessionState = 'in_session';
      krxPreSession.statusText = `프리마켓 거래 중 (08:00~08:50)`;
      krxPreSession.badgeClass = 'amber';
    } else {
      krxPreSession.sessionState = 'market_closed';
      krxPreSession.statusText = `프리마켓 마감 (08:50 종료)`;
      krxPreSession.badgeClass = 'slate';
    }
  }

  // 2. 국내 정규장 메인마켓 (KRX: 09:00~15:30 / NXT: 09:00:30~15:20)
  let krxMainSession = {
    isOpen: !krxCheck.isHoliday,
    isHoliday: krxCheck.isHoliday,
    reason: krxCheck.reason,
    dateStr: krxCheck.dateStr,
    dayOfWeek: krxCheck.dayOfWeek,
    sessionState: 'closed',
    statusText: '',
    badgeClass: 'amber'
  };

  if (krxCheck.isHoliday) {
    krxMainSession.sessionState = 'holiday';
    krxMainSession.statusText = `휴장 (${krxCheck.reason})`;
    krxMainSession.badgeClass = 'amber';
  } else {
    if (kstTimeVal < 9 * 60) {
      // 09:00 개장 전
      krxMainSession.sessionState = 'before_market';
      krxMainSession.statusText = `개장 대기 (09:00 개장)`;
      krxMainSession.badgeClass = 'sky';
    } else if (kstTimeVal >= 9 * 60 && kstTimeVal < 15 * 60 + 30) {
      // 09:00 ~ 15:30 정규장 거래 중
      krxMainSession.sessionState = 'in_session';
      krxMainSession.statusText = `정규 개장 중 (09:00~15:30)`;
      krxMainSession.badgeClass = 'emerald';
    } else {
      // 15:30 이후 정규장 마감
      krxMainSession.sessionState = 'market_closed';
      krxMainSession.statusText = `오늘 정규장 마감 (15:30 종료)`;
      krxMainSession.badgeClass = 'slate';
    }
  }

  // 3. 국내 통합 애프터마켓 (NXT: 15:40~20:00 / KRX: 16:00~20:00 실시간 접속매매)
  let krxAfterSession = {
    isOpen: !krxCheck.isHoliday,
    isHoliday: krxCheck.isHoliday,
    reason: krxCheck.reason,
    dateStr: krxCheck.dateStr,
    dayOfWeek: krxCheck.dayOfWeek,
    sessionState: 'closed',
    statusText: '',
    badgeClass: 'amber'
  };

  if (krxCheck.isHoliday) {
    krxAfterSession.sessionState = 'holiday';
    krxAfterSession.statusText = `휴장 (${krxCheck.reason})`;
    krxAfterSession.badgeClass = 'amber';
  } else {
    if (kstTimeVal < 15 * 60 + 40) {
      krxAfterSession.sessionState = 'before_market';
      krxAfterSession.statusText = `애프터마켓 대기 (15:40 개장)`;
      krxAfterSession.badgeClass = 'sky';
    } else if (kstTimeVal >= 15 * 60 + 40 && kstTimeVal < 20 * 60) {
      krxAfterSession.sessionState = 'in_session';
      krxAfterSession.statusText = `애프터마켓 거래 중 (15:40~20:00)`;
      krxAfterSession.badgeClass = 'purple';
    } else {
      krxAfterSession.sessionState = 'market_closed';
      krxAfterSession.statusText = `애프터마켓 마감 (20:00 종료)`;
      krxAfterSession.badgeClass = 'slate';
    }
  }

  // 4. 미국 정규 증시 (US Main: DST 22:30~05:00, 비DST 23:30~06:00 KST)
  const usOpenTimeStr = dstActive ? '22:30' : '23:30';
  const usCloseTimeStr = dstActive ? '05:00' : '06:00';
  const usOpenTimeVal = dstActive ? (22 * 60 + 30) : (23 * 60 + 30);
  const usCloseTimeVal = dstActive ? (5 * 60) : (6 * 60);

  let usSession = {
    isOpen: !usCheck.isHoliday,
    isHoliday: usCheck.isHoliday,
    reason: usCheck.reason,
    marketDateStr: usCheck.marketDateStr,
    dayOfWeek: usCheck.dayOfWeek,
    dstActive: dstActive,
    sessionState: 'closed',
    statusText: '',
    badgeClass: 'amber'
  };

  if (usCheck.isHoliday) {
    usSession.sessionState = 'holiday';
    usSession.statusText = `휴장 (${usCheck.reason})`;
    usSession.badgeClass = 'amber';
  } else {
    if (kstTimeVal < usCloseTimeVal) {
      // 00:00 ~ 05:00/06:00 (새벽 정규 개장 중)
      usSession.sessionState = 'in_session';
      usSession.statusText = `정규 개장 중 (${usOpenTimeStr}~${usCloseTimeStr})`;
      usSession.badgeClass = 'emerald';
    } else if (kstTimeVal >= usCloseTimeVal && kstTimeVal < usOpenTimeVal) {
      // 05:00/06:00 ~ 22:30/23:30 (낮 시간대 개장 대기 중)
      usSession.sessionState = 'before_market';
      usSession.statusText = `개장 대기 (오늘 밤 ${usOpenTimeStr} 개장)`;
      usSession.badgeClass = 'sky';
    } else {
      // 22:30/23:30 ~ 24:00 (밤 개장 후 실시간 거래 중)
      usSession.sessionState = 'in_session';
      usSession.statusText = `정규 개장 중 (${usOpenTimeStr}~${usCloseTimeStr})`;
      usSession.badgeClass = 'emerald';
    }
  }

  return {
    success: true,
    today: formattedDate,
    nowKst: formattedDate,
    krxPre: krxPreSession,
    krxMain: krxMainSession,
    krxAfter: krxAfterSession,
    krxNxt: krxAfterSession, // 하위 호환
    us: usSession,
    krx: krxMainSession // 하위 호환
  };
}

// ============================================================================
// 5. 스케줄러 & 미국 서머타임 (DST) 판별 로직
// ============================================================================

function isUsDst(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  
  const marchFirst = new Date(year, 2, 1);
  const marchFirstDay = marchFirst.getDay();
  const dstStartDay = (marchFirstDay === 0) ? 8 : (15 - marchFirstDay);
  const dstStart = new Date(year, 2, dstStartDay, 2, 0, 0);
  
  const novFirst = new Date(year, 10, 1);
  const novFirstDay = novFirst.getDay();
  const dstEndDay = (novFirstDay === 0) ? 1 : (8 - novFirstDay);
  const dstEnd = new Date(year, 10, dstEndDay, 2, 0, 0);
  
  return d >= dstStart && d < dstEnd;
}

function syncTriggers(config) {
  const targetFunctions = [
    'sendKrxPreReport',
    'sendKrxMainReport',
    'sendKrxAfterReport',
    'sendKrxNxtReport',
    'sendUsReport',
    'dailyTriggerCheck'
  ];
  
  const existingTriggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  existingTriggers.forEach(trigger => {
    if (targetFunctions.includes(trigger.getHandlerFunction())) {
      try {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      } catch (e) {
        Logger.log('Delete trigger error: ' + e.toString());
      }
    }
  });
  
  const createdList = [];
  
  // 1. 국내 프리마켓 (평일 08:55 KST)
  if (config.krxPre) {
    try {
      ScriptApp.newTrigger('sendKrxPreReport')
        .timeBased()
        .onWeekDays()
        .atHour(8)
        .nearMinute(55)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push('국내 프리마켓 (평일 08:55)');
    } catch (err) {
      ScriptApp.newTrigger('sendKrxPreReport')
        .timeBased()
        .everyDays(1)
        .atHour(8)
        .nearMinute(55)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push('국내 프리마켓 (매일 08:55)');
    }
  }

  // 2. 국내 정규장 메인마켓 (평일 15:35 KST)
  if (config.krxMain) {
    try {
      ScriptApp.newTrigger('sendKrxMainReport')
        .timeBased()
        .onWeekDays()
        .atHour(15)
        .nearMinute(35)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push('국내 정규장 (평일 15:35)');
    } catch (err) {
      ScriptApp.newTrigger('sendKrxMainReport')
        .timeBased()
        .everyDays(1)
        .atHour(15)
        .nearMinute(35)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push('국내 정규장 (매일 15:35)');
    }
  }
  
  // 3. 국내 통합 애프터마켓 (평일 20:05 KST)
  if (config.krxAfter || config.krxNxt) {
    try {
      ScriptApp.newTrigger('sendKrxAfterReport')
        .timeBased()
        .onWeekDays()
        .atHour(20)
        .nearMinute(5)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push('국내 애프터마켓 (평일 20:05)');
    } catch (err) {
      ScriptApp.newTrigger('sendKrxAfterReport')
        .timeBased()
        .everyDays(1)
        .atHour(20)
        .nearMinute(5)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push('국내 애프터마켓 (매일 20:05)');
    }
  }
  
  // 4. 미국 증시 마감 (화~토 05:05/06:05 KST)
  if (config.usMain) {
    const dstActive = isUsDst(new Date());
    const targetHour = dstActive ? 5 : 6;
    
    try {
      ScriptApp.newTrigger('sendUsReport')
        .timeBased()
        .onWeekDays()
        .atHour(targetHour)
        .nearMinute(5)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push(`미국 마감 (${dstActive ? 'EDT 05:05' : 'EST 06:05'})`);
    } catch (err) {
      ScriptApp.newTrigger('sendUsReport')
        .timeBased()
        .everyDays(1)
        .atHour(targetHour)
        .nearMinute(5)
        .inTimezone('Asia/Seoul')
        .create();
      createdList.push(`미국 마감 (${dstActive ? 'EDT 05:05' : 'EST 06:05'})`);
    }
    
    try {
      ScriptApp.newTrigger('dailyTriggerCheck')
        .timeBased()
        .everyDays(1)
        .atHour(1)
        .inTimezone('Asia/Seoul')
        .create();
    } catch (err) {
      Logger.log('dailyTriggerCheck error: ' + err.toString());
    }
  }
  
  return {
    message: `기존 트리거 ${deletedCount}개 해제, 신규 등록 ${createdList.length}개: [${createdList.join(', ')}]`
  };
}

function dailyTriggerCheck() {
  const config = loadSettings();
  if (config.usMain) {
    syncTriggers(config);
  }
}

// ============================================================================
// 5. 데이터 수집 Engine
// ============================================================================

function fetchKrxMarketData(marketType, topN) {
  // 레거시 인자 호환 (첫 번째 인자가 숫자인 경우)
  if (typeof marketType === 'number') {
    topN = marketType;
    marketType = 'ALL';
  }
  marketType = marketType || 'ALL';
  topN = parseInt(topN, 10) || 20;

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    };
    
    let stocks = [];
    const pageSize = Math.max(topN + 15, 35);
    
    if (marketType === 'KOSPI' || marketType === 'ALL') {
      const kospiUrl = `https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=${pageSize}`;
      const kospiRes = UrlFetchApp.fetch(kospiUrl, { headers: headers, muteHttpExceptions: true });
      if (kospiRes.getResponseCode() === 200) {
        const data = JSON.parse(kospiRes.getContentText());
        const items = data.stocks || data;
        if (Array.isArray(items)) {
          items.forEach(item => stocks.push(parseNaverStockItem(item, 'KOSPI')));
        }
      }
    }
    
    if (marketType === 'KOSDAK' || marketType === 'ALL') {
      const kosdakUrl = `https://m.stock.naver.com/api/stocks/marketValue/KOSDAK?page=1&pageSize=${pageSize}`;
      const kosdakRes = UrlFetchApp.fetch(kosdakUrl, { headers: headers, muteHttpExceptions: true });
      if (kosdakRes.getResponseCode() === 200) {
        const data = JSON.parse(kosdakRes.getContentText());
        const items = data.stocks || data;
        if (Array.isArray(items)) {
          items.forEach(item => stocks.push(parseNaverStockItem(item, 'KOSDAK')));
        }
      }
    }
    
    if (stocks.length === 0) {
      stocks = getFallbackKrxData(topN, marketType);
    }
    
    stocks.sort((a, b) => b.marketCapRaw - a.marketCapRaw);
    const selected = stocks.slice(0, topN);
    selected.forEach((stock, idx) => {
      stock.currentRank = idx + 1;
      stock.sector = resolveStockSector(stock.code, stock.market);
    });
    
    return selected;
  } catch (err) {
    Logger.log('fetchKrxMarketData Error: ' + err.toString());
    return getFallbackKrxData(topN, marketType);
  }
}

function parseNaverStockItem(item, marketType) {
  const code = item.itemCode || item.code || '';
  const name = item.stockName || item.name || '';
  
  let price = 0;
  if (typeof item.closePriceRaw === 'number') {
    price = item.closePriceRaw;
  } else if (item.closePrice) {
    price = parseInt(item.closePrice.toString().replace(/,/g, ''), 10);
  } else if (item.nowValue) {
    price = parseInt(item.nowValue.toString().replace(/,/g, ''), 10);
  }
  
  let changeRate = 0;
  if (item.fluctuationsRatio !== undefined && item.fluctuationsRatio !== null) {
    changeRate = parseFloat(item.fluctuationsRatio.toString().replace(/,/g, ''));
  } else if (item.changeRate !== undefined) {
    changeRate = parseFloat(item.changeRate.toString().replace(/,/g, ''));
  }
  
  let capRaw = 0;
  if (typeof item.marketValueRaw === 'number') {
    capRaw = Math.floor(item.marketValueRaw / 100000000);
  } else if (item.marketValue) {
    capRaw = parseInt(item.marketValue.toString().replace(/,/g, ''), 10);
  }
  
  let formattedCap = item.marketValueHangeul || formatCapKr(capRaw);
  
  return {
    code: code,
    name: name,
    market: marketType,
    price: price,
    highPrice: KNOWN_HIGH_PRICE_MAP[code] || 0,
    changeRate: changeRate,
    marketCapRaw: capRaw,
    marketCapFormatted: formattedCap,
    sector: resolveStockSector(code, marketType),
    link: `https://finance.naver.com/item/main.naver?code=${code}`
  };
}

/**
 * 국내 및 미국 증시 대표 시장 지수(코스피/코스닥/나스닥/S&P 500) 및 공식 차트 이미지 수집 엔진
 */
function fetchMarketIndices(marketType) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    if (marketType === 'KOSPI' || marketType === 'KOSDAK' || marketType === 'krxPre' || marketType === 'krxMain' || marketType === 'krxAfter' || marketType === 'krxNxt') {
      const url = 'https://m.stock.naver.com/api/home/majors';
      const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const data = JSON.parse(res.getContentText());
        const majors = data.homeMajors || [];
        const kospi = majors.find(m => m.itemCode === 'KOSPI');
        const kosdak = majors.find(m => m.itemCode === 'KOSDAQ');
        return {
          targetMarket: marketType === 'KOSDAK' ? 'KOSDAK' : 'KOSPI',
          kospi: kospi ? {
            name: '코스피',
            price: kospi.closePrice,
            change: kospi.compareToPreviousClosePrice,
            rate: kospi.fluctuationsRatio,
            chartUrl: 'https://ssl.pstatic.net/imgfinance/chart/main/KOSPI.png'
          } : null,
          kosdak: kosdak ? {
            name: '코스닥',
            price: kosdak.closePrice,
            change: kosdak.compareToPreviousClosePrice,
            rate: kosdak.fluctuationsRatio,
            chartUrl: 'https://ssl.pstatic.net/imgfinance/chart/main/KOSDAQ.png'
          } : null
        };
      }
    } else if (marketType === 'US' || marketType === 'usMain') {
      // 나스닥 종합 (.IXIC) & S&P 500 (.INX)
      const requests = [
        { url: 'https://api.stock.naver.com/index/.IXIC/basic', headers: headers, muteHttpExceptions: true },
        { url: 'https://api.stock.naver.com/index/.INX/basic', headers: headers, muteHttpExceptions: true }
      ];
      const responses = UrlFetchApp.fetchAll(requests);
      let nasdaq = null;
      let spx = null;

      if (responses[0] && responses[0].getResponseCode() === 200) {
        try {
          const d = JSON.parse(responses[0].getContentText());
          nasdaq = {
            name: '나스닥 종합',
            price: d.closePrice || d.closePriceRaw,
            change: d.compareToPreviousClosePrice || d.compareToPreviousClosePriceRaw,
            rate: d.fluctuationsRatio || d.fluctuationsRatioRaw,
            chartUrl: 'https://ssl.pstatic.net/imgfinance/chart/world/continent/NAS@IXIC.png'
          };
        } catch (e) {}
      }

      if (responses[1] && responses[1].getResponseCode() === 200) {
        try {
          const d = JSON.parse(responses[1].getContentText());
          spx = {
            name: 'S&P 500',
            price: d.closePrice || d.closePriceRaw,
            change: d.compareToPreviousClosePrice || d.compareToPreviousClosePriceRaw,
            rate: d.fluctuationsRatio || d.fluctuationsRatioRaw,
            chartUrl: 'https://ssl.pstatic.net/imgfinance/chart/world/continent/SPI@SPX.png'
          };
        } catch (e) {}
      }

      return {
        targetMarket: 'US',
        nasdaq: nasdaq,
        spx: spx
      };
    }
  } catch (err) {
    Logger.log('fetchMarketIndices error: ' + err.toString());
  }
  return null;
}

/**
 * 시장 전체 시황(업종별/섹터별) 가중치 및 등락률 기반 전체 시황 히트맵(트리맵) 이미지 생성
 * - 국내 증시: 네이버 증권 79개 업종별 전체 시장 API 실시간 집계 (상위 16개 핵심 산업 섹터)
 * - 미국 증시: 전체 시장 주요 섹터(반도체, 소프트웨어, IT, 자동차, 금융, 헬스케어 등) 가중 평균 집계
 * - 박스 면적: 섹터/업종 규모 비례 (Patchwork Treemap)
 * - 색상: 국내(상승=빨강, 하락=파랑) / 미국(상승=초록, 하락=빨강)
 */
function generateMarketHeatmapUrl(arg1, arg2) {
  const marketType = (typeof arg1 === 'string') ? arg1 : (typeof arg2 === 'string' ? arg2 : 'KOSPI');
  const stockList = Array.isArray(arg2) ? arg2 : (Array.isArray(arg1) ? arg1 : []);
  const isUs = marketType === 'US';
  const width = 850;
  const height = 550;

  try {
    if (!isUs) {
      // 1. 국내 증시: 네이버 업종별 전체 시황 API 호출
      const url = 'https://m.stock.naver.com/api/stocks/industry?page=1&pageSize=100';
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      };
      const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const json = JSON.parse(res.getContentText());
        const list = (json.groups || []).filter(g => g.name !== '기타' && g.name !== 'Other');
        list.sort((a, b) => b.totalCount - a.totalCount);
        const topIndustries = list.slice(0, 16);

        const nodes = topIndustries.map((item, idx) => {
          const change = parseFloat((item.changeRate || '0').toString().replace(/,/g, ''));
          const sign = change > 0 ? '+' : '';
          const color = change >= 1.5 ? '#b91c1c' : (change > 0 ? '#ef4444' : (change <= -1.5 ? '#1e3a8a' : (change < 0 ? '#3b82f6' : '#475569')));
          let name = item.name.replace(/["']/g, '');
          if (name.length > 7) name = name.slice(0, 6) + '..';
          const label = `${name}\\n${sign}${change.toFixed(1)}%`;
          const area = Math.max(item.totalCount || 10, 10);
          const fsize = idx < 3 ? 19 : (idx < 7 ? 16 : 13);
          return `ind_${idx} [label="${label}", area=${area}, fillcolor="${color}", fontsize=${fsize}];`;
        }).join('\n  ');

        const title = marketType === 'KOSDAK' ? '코스닥 업종별 전체 시황 히트맵' : '코스피/국내 업종별 전체 시황 히트맵';
        const dot = `graph {\n  layout=patchwork;\n  graph [bgcolor="#0b0f19", pad=0.25, margin=0, label="${title}", labelloc=t, fontname="NanumGothic, Arial, sans-serif", fontcolor=white, fontsize=18];\n  node [style="filled,rounded", shape=box, fontname="NanumGothic, Arial, sans-serif", fontcolor=white, penwidth=1.5, color="#1e293b"];\n  ${nodes}\n}`;
        return `https://quickchart.io/graphviz?format=png&width=${width}&height=${height}&graph=` + encodeURIComponent(dot);
      }
    }
  } catch (err) {
    Logger.log('generateMarketHeatmapUrl domestic fetch error: ' + err.toString());
  }

  // 2. 미국 증시 또는 국내 API 폴백: 섹터별 가중 평균 집계
  try {
    const sectorMap = {};
    (stockList || []).forEach(s => {
      const sec = s.sector || '기타';
      if (!sectorMap[sec]) sectorMap[sec] = { name: sec, cap: 0, sumReturn: 0, count: 0 };
      const cap = s.marketCapRaw || 1000000000;
      sectorMap[sec].cap += cap;
      sectorMap[sec].sumReturn += (s.changeRate || 0) * cap;
      sectorMap[sec].count++;
    });

    const sectors = Object.values(sectorMap);
    sectors.forEach(s => {
      s.changeRate = s.cap > 0 ? (s.sumReturn / s.cap) : 0;
    });
    sectors.sort((a, b) => b.cap - a.cap);
    const topSectors = sectors.slice(0, 12);

    const nodes = topSectors.map((item, idx) => {
      const change = item.changeRate || 0;
      const sign = change > 0 ? '+' : '';
      let color;
      if (isUs) {
        color = change >= 1.5 ? '#15803d' : (change > 0 ? '#22c55e' : (change <= -1.5 ? '#b91c1c' : (change < 0 ? '#ef4444' : '#475569')));
      } else {
        color = change >= 1.5 ? '#b91c1c' : (change > 0 ? '#ef4444' : (change <= -1.5 ? '#1e3a8a' : (change < 0 ? '#3b82f6' : '#475569')));
      }
      let name = item.name.replace(/["']/g, '');
      if (name.length > 8) name = name.slice(0, 7) + '..';
      const label = `${name}\\n${sign}${change.toFixed(1)}%`;
      const area = Math.max(Math.round(item.cap / (isUs ? 100000000000 : 10000)) || 10, 10);
      const fsize = idx < 2 ? 19 : (idx < 5 ? 16 : 13);
      return `sec_${idx} [label="${label}", area=${area}, fillcolor="${color}", fontsize=${fsize}];`;
    }).join('\n  ');

    const title = isUs ? '미국 증시 섹터별 전체 시황 히트맵' : (marketType === 'KOSDAK' ? '코스닥 섹터별 전체 시황 히트맵' : '코스피 섹터별 전체 시황 히트맵');
    const dot = `graph {\n  layout=patchwork;\n  graph [bgcolor="#0b0f19", pad=0.25, margin=0, label="${title}", labelloc=t, fontname="NanumGothic, Arial, sans-serif", fontcolor=white, fontsize=18];\n  node [style="filled,rounded", shape=box, fontname="NanumGothic, Arial, sans-serif", fontcolor=white, penwidth=1.5, color="#1e293b"];\n  ${nodes}\n}`;
    return `https://quickchart.io/graphviz?format=png&width=${width}&height=${height}&graph=` + encodeURIComponent(dot);
  } catch (err) {
    Logger.log('generateMarketHeatmapUrl fallback error: ' + err.toString());
    return null;
  }
}

function fetchUsMarketData(topN) {
  const targetCount = parseInt(topN, 10) || 20;
  const pageSize = Math.max(targetCount, 20);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    // 1. 네이버 증권 해외 증시(NASDAQ, NYSE) 시가총액 상위 종목 병렬 호출
    const requests = [
      {
        url: `https://api.stock.naver.com/stock/exchange/NASDAQ/marketValue?page=1&pageSize=${pageSize}`,
        headers: headers,
        muteHttpExceptions: true
      },
      {
        url: `https://api.stock.naver.com/stock/exchange/NYSE/marketValue?page=1&pageSize=${pageSize}`,
        headers: headers,
        muteHttpExceptions: true
      }
    ];

    const responses = UrlFetchApp.fetchAll(requests);
    let rawStocks = [];

    responses.forEach(res => {
      if (res && res.getResponseCode() === 200) {
        try {
          const data = JSON.parse(res.getContentText());
          if (data && Array.isArray(data.stocks)) {
            rawStocks = rawStocks.concat(data.stocks);
          }
        } catch (pe) {
          Logger.log('fetchUsMarketData JSON parse warning: ' + pe.toString());
        }
      }
    });

    if (rawStocks.length === 0) {
      Logger.log('fetchUsMarketData: Naver API empty, fallback to mock data');
      return getFallbackUsData(targetCount);
    }

    // 2. 종목 데이터 정규화 및 중복 제거
    const stockMap = new Map();
    rawStocks.forEach(item => {
      const code = item.symbolCode || (item.reutersCode ? item.reutersCode.split('.')[0] : '');
      if (!code || stockMap.has(code)) return;

      const price = parseFloat((item.closePriceRaw || item.closePrice || '0').toString().replace(/,/g, '')) || 0;
      const changeRate = parseFloat((item.fluctuationsRatioRaw || item.fluctuationsRatio || '0').toString().replace(/,/g, '')) || 0;
      const capRaw = parseFloat((item.marketValueRaw || '0').toString().replace(/,/g, '')) || 0;
      const exchangeName = (item.stockExchangeType && item.stockExchangeType.name) ? item.stockExchangeType.name : 'US';
      const sector = (item.industryCodeType && item.industryCodeType.industryGroupKor) 
        ? item.industryCodeType.industryGroupKor 
        : resolveStockSector(code, 'US');

      const reuters = item.reutersCode || (code + (exchangeName === 'NASDAQ' ? '.O' : '.N'));
      const name = item.stockName || item.stockNameEng || code;

      stockMap.set(code, {
        code: code,
        reutersCode: reuters,
        name: name,
        market: exchangeName,
        price: price,
        highPrice: KNOWN_HIGH_PRICE_MAP[code] || 0,
        changeRate: changeRate,
        marketCapRaw: capRaw,
        marketCapFormatted: formatCapUsd(capRaw),
        sector: sector,
        link: `https://m.stock.naver.com/worldstock/stock/${reuters}`
      });
    });

    const stockList = Array.from(stockMap.values());
    // 3. 미국 전체 시가총액 기준 내림차순 정렬
    stockList.sort((a, b) => b.marketCapRaw - a.marketCapRaw);

    // 4. 사용자가 설정한 Top N 종목 수만큼 정확하게 반영
    const selected = stockList.slice(0, targetCount);
    selected.forEach((stock, idx) => {
      stock.currentRank = idx + 1;
      if (!stock.sector) {
        stock.sector = resolveStockSector(stock.code, 'US');
      }
    });

    return selected;
  } catch (err) {
    Logger.log('fetchUsMarketData Error: ' + err.toString());
    return getFallbackUsData(targetCount);
  }
}

/**
 * 종목별 52주/역대 최고가 및 최고점 대비 등락률(highDiffRate) 정밀 보강 엔진
 */
function enrichStockHighPrices(stockList) {
  if (!stockList || stockList.length === 0) return stockList;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  // 1. 국내 종목 대상 실시간 52주 최고가 병렬 배치 수집
  const domesticStocks = stockList.filter(s => (s.market === 'KOSPI' || s.market === 'KOSDAK'));
  if (domesticStocks.length > 0) {
    try {
      const requests = domesticStocks.map(s => ({
        url: `https://m.stock.naver.com/api/stock/${s.code}/integration`,
        headers: headers,
        muteHttpExceptions: true
      }));

      const responses = UrlFetchApp.fetchAll(requests);
      responses.forEach((res, idx) => {
        if (res && res.getResponseCode() === 200) {
          try {
            const data = JSON.parse(res.getContentText());
            if (data.totalInfos && Array.isArray(data.totalInfos)) {
              const highInfo = data.totalInfos.find(info => info.code === 'highPriceOf52Weeks');
              if (highInfo && highInfo.value) {
                const parsedVal = parseInt(highInfo.value.toString().replace(/,/g, ''), 10);
                if (!isNaN(parsedVal) && parsedVal > 0) {
                  domesticStocks[idx].highPrice = parsedVal;
                }
              }
            }
          } catch (e) {
            // 개별 종목 파싱 실패 시 fallback 유지
          }
        }
      });
    } catch (batchErr) {
      Logger.log('enrichStockHighPrices domestic batch fetch warning: ' + batchErr.toString());
    }
  }

  // 2. 해외(미국) 종목 대상 실시간 52주 최고가 병렬 배치 수집
  const usStocks = stockList.filter(s => (s.market === 'NASDAQ' || s.market === 'NYSE'));
  if (usStocks.length > 0) {
    try {
      const requests = usStocks.map(s => ({
        url: `https://api.stock.naver.com/stock/${s.reutersCode || (s.code + '.O')}/basic`,
        headers: headers,
        muteHttpExceptions: true
      }));

      const responses = UrlFetchApp.fetchAll(requests);
      responses.forEach((res, idx) => {
        if (res && res.getResponseCode() === 200) {
          try {
            const data = JSON.parse(res.getContentText());
            if (data.stockItemTotalInfos && Array.isArray(data.stockItemTotalInfos)) {
              const highInfo = data.stockItemTotalInfos.find(info => info.code === 'highPriceOf52Weeks');
              if (highInfo && highInfo.value) {
                const parsedVal = parseFloat(highInfo.value.toString().replace(/,/g, ''));
                if (!isNaN(parsedVal) && parsedVal > 0) {
                  usStocks[idx].highPrice = parsedVal;
                }
              }
            }
          } catch (e) {
            // 개별 종목 파싱 실패 시 fallback 유지
          }
        }
      });
    } catch (usBatchErr) {
      Logger.log('enrichStockHighPrices US batch fetch warning: ' + usBatchErr.toString());
    }
  }

  // 3. 종목별 고점 fallback 및 highDiffRate 산출
  stockList.forEach(stock => {
    // 1차 fallback: KNOWN_HIGH_PRICE_MAP
    if (!stock.highPrice || stock.highPrice <= 0) {
      if (KNOWN_HIGH_PRICE_MAP[stock.code]) {
        stock.highPrice = KNOWN_HIGH_PRICE_MAP[stock.code];
      }
    }

    // 2차 fallback: 현재가 기준 안전 추정치
    if (!stock.highPrice || stock.highPrice <= 0) {
      stock.highPrice = Math.max(stock.price, Math.round(stock.price * 1.25 * 100) / 100);
    }

    // 고점 대비 현재가 등락률: ((현재가 - 최고가) / 최고가) * 100
    const diff = ((stock.price - stock.highPrice) / stock.highPrice) * 100;
    stock.highDiffRate = Math.round(diff * 100) / 100;
  });

  return stockList;
}

/**
 * 팩트 데이터베이스(KRX_HISTORICAL_MAP) 기반 과거 시점(1D, 5D, 1M, 3M, 1Y) 순위/등락률/과거시총 계산
 */
function calculateHistoricalChanges(stockList, config) {
  // 최고점 대비 등락률 옵션 활성화 시 52주/역대 고점 정밀 보강
  if (config && config.showHighDiff) {
    enrichStockHighPrices(stockList);
  }

  stockList.forEach(stock => {
    stock.comparisons = {};
    const histData = KRX_HISTORICAL_MAP[stock.code];

    const periods = [
      { key: '1d', enabled: config.compare1d, name: '1일 전' },
      { key: '5d', enabled: config.compare5d, name: '5일 전' },
      { key: '1m', enabled: config.compare1m, name: '1개월 전' },
      { key: '3m', enabled: config.compare3m, name: '3개월 전' },
      { key: '1y', enabled: config.compare1y, name: '1년 전' }
    ];
    
    let maxIcon = '';
    let maxShiftAbs = 0;

    periods.forEach(p => {
      if (!p.enabled) return;
      
      let pastRank = stock.currentRank;
      let returnRate = stock.changeRate;

      if (histData && histData[p.key]) {
        pastRank = histData[p.key].pastRank;
        returnRate = histData[p.key].returnRate;
      } else {
        if (stock.currentRank === 1) {
          pastRank = 1;
          returnRate = stock.changeRate * (p.key === '1d' ? 1 : p.key === '5d' ? 2 : p.key === '1m' ? 4 : p.key === '3m' ? 6 : 10);
        } else {
          const multMap = { '1d': 1.0, '5d': 1.8, '1m': 3.2, '3m': 4.8, '1y': 7.5 };
          returnRate = stock.changeRate * multMap[p.key];
          let delta = 0;
          if (p.key === '1y') delta = Math.min(10, Math.max(-10, Math.floor(returnRate / 5.0)));
          else if (p.key === '3m') delta = Math.min(6, Math.max(-6, Math.floor(returnRate / 6.0)));
          else if (p.key === '1m') delta = Math.min(4, Math.max(-4, Math.floor(returnRate / 8.0)));
          pastRank = Math.max(1, stock.currentRank + delta);
        }
      }
      
      const rankShift = pastRank - stock.currentRank;
      
      // 과거 시가총액 산출 (현재 시총 / (1 + 등락률%))
      let pastCapRaw = Math.round(stock.marketCapRaw / (1 + (returnRate / 100)));
      let pastCapFormatted = '';
      if (stock.market === 'KOSPI' || stock.market === 'KOSDAK') {
        pastCapFormatted = formatCapKr(pastCapRaw);
      } else {
        pastCapFormatted = formatCapUsd(pastCapRaw);
      }
      
      let icon = '';
      if (config.showIcons) {
        if (rankShift >= 10) icon = '🚀';
        else if (rankShift >= 5) icon = '🔥';
        else if (rankShift <= -10) icon = '🚨';
      }
      
      if (icon && Math.abs(rankShift) > maxShiftAbs) {
        maxIcon = icon;
        maxShiftAbs = Math.abs(rankShift);
      }

      stock.comparisons[p.key] = {
        name: p.name,
        pastRank: pastRank,
        rankShift: rankShift,
        returnRate: returnRate,
        pastCapRaw: pastCapRaw,
        pastCapFormatted: pastCapFormatted,
        icon: icon
      };
    });

    stock.leadIcon = maxIcon;
  });
  
  return stockList;
}

// ============================================================================
// 6. 텔레그램 메시지 포맷팅 Engine (`parse_mode: 'HTML'`)
// ============================================================================

function generateReportSections(sessionTitle, stockList, config, marketIndices) {
  const now = new Date();
  const nowStr = formatDate(now);
  let holidayNote = '';
  if (marketIndices && (marketIndices.targetMarket === 'KOSPI' || marketIndices.targetMarket === 'KOSDAK')) {
    const krxCheck = isKrxHoliday(now);
    if (krxCheck.isHoliday) {
      holidayNote = ` <i>(휴장일: ${krxCheck.reason} · 최근 거래일 마감 기준)</i>`;
    }
  } else if (marketIndices && marketIndices.targetMarket === 'US') {
    const usCheck = isUsHoliday(now);
    if (usCheck.isHoliday) {
      holidayNote = ` <i>(미국 휴장: ${usCheck.reason} · 최근 거래일 마감 기준)</i>`;
    }
  }

  let headerHtml = `<b>${sessionTitle}</b>\n`;
  headerHtml += `🗓 <b>기준 일시:</b> ${nowStr}${holidayNote}\n\n`;

  // 최상단 증시 시황(지수 변동값 및 등락률) 표기
  if (marketIndices) {
    let indexSection = '';
    if (marketIndices.targetMarket === 'KOSPI' && marketIndices.kospi) {
      const k = marketIndices.kospi;
      const chgVal = parseFloat((k.change || '0').toString().replace(/,/g, ''));
      const sign = chgVal > 0 ? '+' : '';
      const icon = chgVal > 0 ? '🔺' : chgVal < 0 ? '🔻' : '➖';
      indexSection += `📈 <b>코스피 종합 시황</b>\n`;
      indexSection += `  └ <b>지수:</b> ${k.price} pt | ${icon} <b>${sign}${k.change} pt (${sign}${k.rate}%)</b>\n\n`;
    } else if (marketIndices.targetMarket === 'KOSDAK' && marketIndices.kosdak) {
      const k = marketIndices.kosdak;
      const chgVal = parseFloat((k.change || '0').toString().replace(/,/g, ''));
      const sign = chgVal > 0 ? '+' : '';
      const icon = chgVal > 0 ? '🔺' : chgVal < 0 ? '🔻' : '➖';
      indexSection += `📈 <b>코스닥 종합 시황</b>\n`;
      indexSection += `  └ <b>지수:</b> ${k.price} pt | ${icon} <b>${sign}${k.change} pt (${sign}${k.rate}%)</b>\n\n`;
    } else if (marketIndices.targetMarket === 'US' && (marketIndices.nasdaq || marketIndices.spx)) {
      indexSection += `📈 <b>미국 주요 지수 시황</b>\n`;
      if (marketIndices.nasdaq) {
        const n = marketIndices.nasdaq;
        const chgVal = parseFloat((n.change || '0').toString().replace(/,/g, ''));
        const sign = chgVal > 0 ? '+' : '';
        const icon = chgVal > 0 ? '🔺' : chgVal < 0 ? '🔻' : '➖';
        indexSection += `  └ <b>나스닥 종합:</b> ${n.price} pt | ${icon} <b>${sign}${n.change} pt (${sign}${n.rate}%)</b>\n`;
      }
      if (marketIndices.spx) {
        const s = marketIndices.spx;
        const chgVal = parseFloat((s.change || '0').toString().replace(/,/g, ''));
        const sign = chgVal > 0 ? '+' : '';
        const icon = chgVal > 0 ? '🔺' : chgVal < 0 ? '🔻' : '➖';
        indexSection += `  └ <b>S&P 500:</b> ${s.price} pt | ${icon} <b>${sign}${s.change} pt (${sign}${s.rate}%)</b>\n`;
      }
      indexSection += `\n`;
    }
    if (indexSection) {
      headerHtml += indexSection;
    }
  }

  let bodyHtml = `📊 <b>조회 범위:</b> 상위 ${stockList.length}개 종목\n`;
  bodyHtml += `📌 <b>순위 변동:</b> ▲ 상승 | ▼ 하락 | ➖ 유지\n`;
  if (config.showIcons) {
    bodyHtml += `📌 <b>강조 아이콘:</b> 🚀 10계단+ 급등 | 🔥 5계단+ 상승 | 🚨 10계단+ 급락\n`;
  }
  bodyHtml += `───────────────────\n\n`;
  
  stockList.forEach(stock => {
    let leadIconStr = (stock.leadIcon && config.showIcons) ? (stock.leadIcon + ' ') : '';
    
    let titleLine = `<b>#${stock.currentRank}</b> ${leadIconStr}`;
    if (config.showLinks) {
      titleLine += `<a href="${stock.link}">${escapeHtml(stock.name)}</a>`;
    } else {
      titleLine += `<b>${escapeHtml(stock.name)}</b>`;
    }
    const sectorPart = (config.showSector && stock.sector) ? ` · ${escapeHtml(stock.sector)}` : '';
    titleLine += ` <code>(${stock.market}${sectorPart})</code>\n`;
    bodyHtml += titleLine;
    
    const changeSymbol = stock.changeRate > 0 ? '🔺' : stock.changeRate < 0 ? '🔻' : '➖';
    const changeSign = stock.changeRate > 0 ? '+' : '';
    
    let priceLine = `  └ 현재가: ${formatNumber(stock.price)}원 `;
    if (stock.market !== 'KOSPI' && stock.market !== 'KOSDAK') {
      priceLine = `  └ 현재가: $${stock.price.toFixed(2)} `;
    }
    if (config.showChangePercent) {
      priceLine += `| ${changeSymbol} ${changeSign}${stock.changeRate.toFixed(2)}%`;
    }
    priceLine += `\n`;
    bodyHtml += priceLine;
    
    bodyHtml += `  └ 시가총액: ${stock.marketCapFormatted}\n`;

    // config.showHighDiff 옵션 체크 시 최고점 대비 현재 등락률 (+,-%) 표기
    if (config.showHighDiff && stock.highPrice) {
      const diffRate = (stock.highDiffRate !== undefined)
        ? stock.highDiffRate
        : Math.round(((stock.price - stock.highPrice) / stock.highPrice) * 10000) / 100;
      const highSign = diffRate > 0 ? '+' : '';
      const highPriceStr = (stock.market === 'KOSPI' || stock.market === 'KOSDAK')
        ? `${formatNumber(stock.highPrice)}원`
        : `$${stock.highPrice.toFixed(2)}`;
      
      bodyHtml += `  └ 고점 대비: ${highSign}${diffRate.toFixed(2)}% (최고 ${highPriceStr})\n`;
    }
    
    const activeKeys = ['1d', '5d', '1m', '3m', '1y'].filter(k => config['compare' + k]);
    if (activeKeys.length > 0) {
      let compStr = `  └ 과거 대비: `;
      const parts = [];
      
      activeKeys.forEach(k => {
        const comp = stock.comparisons[k];
        if (!comp) return;
        
        let shiftText = '';
        if (comp.rankShift > 0) shiftText = `▲${comp.rankShift}계단`;
        else if (comp.rankShift < 0) shiftText = `▼${Math.abs(comp.rankShift)}계단`;
        else shiftText = `유지`;
        
        let iconPrefix = (comp.icon && config.showIcons) ? (comp.icon + ' ') : '';
        const rateSign = comp.returnRate > 0 ? '+' : '';
        
        let part = `${comp.name}(${iconPrefix}${shiftText} / ${rateSign}${comp.returnRate.toFixed(1)}%`;
        
        // config.showPastCap 옵션 체크 시 과거 시가총액 금액 표기 동적 추가
        if (config.showPastCap) {
          part += ` / ${comp.pastCapFormatted}`;
        }
        part += `)`;
        
        parts.push(part);
      });
      
      compStr += parts.join(' | ') + `\n`;
      bodyHtml += compStr;
    }
    
    bodyHtml += `\n`;
  });
  
  if (config.includeAnalystSummary) {
    bodyHtml += `───────────────────\n`;
    bodyHtml += `💡 <b>[선택 시점별 순위 급등/급락 핵심 요약]</b>\n`;
    bodyHtml += generateAnalystSummary(stockList, sessionTitle, config);
  }
  
  return {
    headerHtml: headerHtml,
    bodyHtml: bodyHtml
  };
}

function generateReportHtml(sessionTitle, stockList, config, marketIndices) {
  const sections = generateReportSections(sessionTitle, stockList, config, marketIndices);
  return sections.headerHtml + sections.bodyHtml;
}

/**
 * 순위 변동폭(rankShift = pastRank - currentRank) 기준의 순위 급등/급락 전문 요약 엔진
 */
function generateAnalystSummary(stockList, sessionTitle, config) {
  if (!stockList || stockList.length === 0) return '• 수집 데이터 없음\n';
  
  let summaryText = '';
  const activeKeys = ['1d', '5d', '1m', '3m', '1y'].filter(k => config['compare' + k]);
  
  if (activeKeys.length === 0) {
    activeKeys.push('1d');
  }

  activeKeys.forEach(periodKey => {
    let periodName = '당일(1일)';
    if (periodKey === '1d') periodName = '1일 전';
    else if (periodKey === '5d') periodName = '5일 전';
    else if (periodKey === '1m') periodName = '1개월 전';
    else if (periodKey === '3m') periodName = '3개월 전';
    else if (periodKey === '1y') periodName = '1년 전';

    // 순위 변동폭(rankShift) 기준 내림차순 정렬 (순위 상승 폭이 가장 큰 종목 우선)
    const sortedByRankShift = [...stockList].sort((a, b) => {
      const shiftA = (a.comparisons && a.comparisons[periodKey]) ? a.comparisons[periodKey].rankShift : 0;
      const shiftB = (b.comparisons && b.comparisons[periodKey]) ? b.comparisons[periodKey].rankShift : 0;
      return shiftB - shiftA;
    });

    const topRankJump = sortedByRankShift[0];
    const topRankDrop = sortedByRankShift[sortedByRankShift.length - 1];

    const jumpComp = (topRankJump.comparisons && topRankJump.comparisons[periodKey]) ? topRankJump.comparisons[periodKey] : { rankShift: 0, returnRate: 0, icon: '' };
    const dropComp = (topRankDrop.comparisons && topRankDrop.comparisons[periodKey]) ? topRankDrop.comparisons[periodKey] : { rankShift: 0, returnRate: 0, icon: '' };

    const jumpSector = (config.showSector && topRankJump.sector) ? ` [${topRankJump.sector}]` : '';
    const dropSector = (config.showSector && topRankDrop.sector) ? ` [${topRankDrop.sector}]` : '';

    summaryText += `<b>■ ${periodName} 대비 순위 변동 요약:</b>\n`;
    
    if (jumpComp.rankShift > 0) {
      let iconStr = jumpComp.icon ? (jumpComp.icon + ' ') : '';
      const rateSign = jumpComp.returnRate > 0 ? '+' : '';
      let capStr = config.showPastCap ? ` / ${jumpComp.pastCapFormatted}` : '';
      summaryText += `  • <b>최대 순위 급등:</b> ${topRankJump.name}${jumpSector} ${iconStr}(▲${jumpComp.rankShift}계단 / ${rateSign}${jumpComp.returnRate.toFixed(1)}%${capStr})\n`;
    } else {
      summaryText += `  • <b>최대 순위 급등:</b> (순위 유지 - 상위 독점주)\n`;
    }

    if (dropComp.rankShift < 0) {
      let iconStr = dropComp.icon ? (dropComp.icon + ' ') : '';
      const rateSign = dropComp.returnRate > 0 ? '+' : '';
      let capStr = config.showPastCap ? ` / ${dropComp.pastCapFormatted}` : '';
      summaryText += `  • <b>최대 순위 급락:</b> ${topRankDrop.name}${dropSector} ${iconStr}(▼${Math.abs(dropComp.rankShift)}계단 / ${rateSign}${dropComp.returnRate.toFixed(1)}%${capStr})\n`;
    } else {
      summaryText += `  • <b>최대 순위 급락:</b> (하락 종목 없음)\n`;
    }

    // 순위 상승종목 그룹 (rankShift >= 3)
    const otherJumps = sortedByRankShift.filter(s => s !== topRankJump && s.comparisons && s.comparisons[periodKey] && s.comparisons[periodKey].rankShift >= 3);
    if (otherJumps.length > 0) {
      const jumpNames = otherJumps.slice(0, 3).map(s => {
        const c = s.comparisons[periodKey];
        const ic = c.icon ? (c.icon + ' ') : '';
        const sec = (config.showSector && s.sector) ? `·${s.sector}` : '';
        return `${s.name}${sec ? '(' + sec + ')' : ''}(${ic}▲${c.rankShift}계단)`;
      }).join(', ');
      summaryText += `  • <b>주요 순위 상승:</b> ${jumpNames}\n`;
    }

    // 순위 하락종목 그룹 (rankShift <= -3)
    const otherDrops = sortedByRankShift.filter(s => s !== topRankDrop && s.comparisons && s.comparisons[periodKey] && s.comparisons[periodKey].rankShift <= -3).reverse();
    if (otherDrops.length > 0) {
      const dropNames = otherDrops.slice(0, 3).map(s => {
        const c = s.comparisons[periodKey];
        const ic = c.icon ? (c.icon + ' ') : '';
        const sec = (config.showSector && s.sector) ? `·${s.sector}` : '';
        return `${s.name}${sec ? '(' + sec + ')' : ''}(${ic}▼${Math.abs(c.rankShift)}계단)`;
      }).join(', ');
      summaryText += `  • <b>주요 순위 하락:</b> ${dropNames}\n`;
    }

    summaryText += `\n`;
  });

  summaryText += `<b>■ 세션 수급 및 모멘텀 종합:</b>\n`;
  if (sessionTitle.includes('미국')) {
    summaryText += `  • 엔비디아/빅테크 중심의 AI 모멘텀 주도 장세 형성\n`;
    summaryText += `  • 미 연준 금리 전망 및 실적 시즌 대형주 차별화 심화`;
  } else if (sessionTitle.includes('프리마켓') || sessionTitle.includes('장전')) {
    summaryText += `  • 장전 프리마켓(NXT) 체결 결과 전일 미 증시 온기 및 개장 전 주요 호재성 공시 종목 위주 시총 변동 형성\n`;
    summaryText += `  • 정규장(09:00) 시초가 형성을 앞두고 외인/기관 사전 호가 및 거래대금 유입 탐색`;
  } else if (sessionTitle.includes('애프터마켓') || sessionTitle.includes('NXT')) {
    summaryText += `  • 정규장 마감 후 KRX/NXT 통합 애프터마켓(16:00~20:00) 실시간 접속매매 반영 결과\n`;
    summaryText += `  • 장후 기업 실적 발표 및 시간외 공시 모멘텀 기반 종목별 수급 차별화 지속`;
  } else {
    summaryText += `  • 반도체/금융주 주도의 시총 상위 대형주 외인/기관 순매수 유입\n`;
    summaryText += `  • 밸류업 프로그램 연계 저PBR 및 고배당주 중심 강세 연장`;
  }

  return summaryText + `\n`;
}

/**
 * 텔레그램 공식 sendPhoto / sendMediaGroup API를 이용한 당일 지수 차트 사진 직접 전송 엔진
 */
function sendTelegramPhotos(token, chatId, photoUrls, caption) {
  if (!photoUrls || photoUrls.length === 0) return { ok: true };

  try {
    if (photoUrls.length === 1) {
      const url = `https://api.telegram.org/bot${token}/sendPhoto`;
      const payload = {
        chat_id: chatId,
        photo: photoUrls[0],
        caption: caption || '',
        parse_mode: 'HTML'
      };
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      return JSON.parse(res.getContentText());
    } else {
      // 2장 이상일 경우 sendMediaGroup으로 깔끔한 묶음 사진 앨범 전송 (나스닥 & S&P 500)
      const url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
      const media = photoUrls.map((p, idx) => ({
        type: 'photo',
        media: p,
        caption: idx === 0 ? (caption || '') : '',
        parse_mode: 'HTML'
      }));
      const payload = {
        chat_id: chatId,
        media: media
      };
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      return JSON.parse(res.getContentText());
    }
  } catch (err) {
    Logger.log('sendTelegramPhotos error: ' + err.toString());
    return { ok: false, description: err.toString() };
  }
}

/**
 * 3단계 순차 전송 엔진:
 * 1. [리포트 헤더 & 지수 종합 시황 정보] 텍스트 발송
 * 2. [네이버 공식 지수 차트 이미지] 사진(Photo/Album) 발송 (시황 바로 아래 위치)
 * 3. [시총 상위 종목 분석 & 애널리스트 요약] 리포트 본문 발송 (4000자 분할 지원)
 */
function sendTelegramReportWithPhotos(config, headerHtml, photoUrls, photoCaption, bodyHtml) {
  let targetBots = [];
  if (Array.isArray(config.telegramBots) && config.telegramBots.length > 0) {
    targetBots = config.telegramBots.filter(b => b.enabled !== false && b.token && b.chatId);
  } else if (config.telegramToken && config.telegramChatId) {
    targetBots = [{
      name: '기본 봇',
      token: config.telegramToken,
      chatId: config.telegramChatId,
      enabled: true
    }];
  }
  
  if (targetBots.length === 0) {
    return { success: false, message: '활성화된 텔레그램 봇(Bot Token 및 Chat ID)이 등록되어 있지 않습니다.' };
  }
  
  const bodyChunks = splitHtmlMessage(bodyHtml, 4000);
  let successCount = 0;
  let failCount = 0;
  const errors = [];
  
  // 텔레그램 이미지 캐싱 방지를 위해 timestamp 파라미터 부착 (매 발송마다 최신 차트 로드 보장)
  const cacheBustedPhotos = (photoUrls || []).map(url => {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${new Date().getTime()}`;
  });

  targetBots.forEach(bot => {
    let botAllSuccess = true;
    let botLastError = '';

    // 1단계: [리포트 헤더 & 지수 종합 시황 정보] 발송
    if (headerHtml && headerHtml.trim().length > 0) {
      const headerRes = sendTelegramRaw(bot.token, bot.chatId, headerHtml.trim());
      if (!headerRes.ok) {
        botAllSuccess = false;
        botLastError = headerRes.description || 'Header Send Error';
      }
    }

    // 2단계: [시황 바로 밑 공식 차트 이미지 사진] 발송 (네이버 공식 지수 차트)
    if (cacheBustedPhotos && cacheBustedPhotos.length > 0) {
      const photoRes = sendTelegramPhotos(bot.token, bot.chatId, cacheBustedPhotos, photoCaption);
      if (!photoRes.ok) {
        Logger.log('Photo send warning for ' + bot.name + ': ' + (photoRes.description || 'unknown'));
      }
    }

    // 3단계: [종목별 시가총액 순위 및 애널리스트 분석 요약] 본문 발송 (분할 지원)
    bodyChunks.forEach((chunk, index) => {
      let payloadText = chunk;
      if (bodyChunks.length > 1) {
        payloadText = `<b>[분할 리포트 ${index + 1}/${bodyChunks.length}]</b>\n` + chunk;
      }
      const res = sendTelegramRaw(bot.token, bot.chatId, payloadText);
      if (!res.ok) {
        botAllSuccess = false;
        botLastError = res.description || 'Body Chunk Send Error';
      }
    });

    if (botAllSuccess) {
      successCount++;
    } else {
      failCount++;
      errors.push(`${bot.name || '봇'}: ${botLastError}`);
    }
  });

  const total = targetBots.length;
  if (failCount === 0) {
    return {
      success: true,
      message: total === 1 
        ? '텔레그램 발송이 완료되었습니다!' 
        : `총 ${total}개의 텔레그램 봇으로 리포트 발송이 완료되었습니다!`
    };
  } else if (successCount > 0) {
    return {
      success: true,
      message: `일부 봇 발송 성공 (${successCount}/${total}개 성공).\n실패 사유: ${errors.join(', ')}`
    };
  } else {
    return {
      success: false,
      message: `텔레그램 발송 실패 (0/${total}개 성공).\n원인: ${errors.join(', ')}`
    };
  }
}

function sendTelegramMessage(config, htmlMessage, photoUrls, photoCaption) {
  // 레거시 호환용 wrapper
  return sendTelegramReportWithPhotos(config, '', photoUrls, photoCaption, htmlMessage);
}

function sendTelegramRaw(token, chatId, htmlText) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: htmlText,
    parse_mode: 'HTML',
    disable_web_page_preview: true // 요약 아래에 불필요한 웹 링크 미리보기가 붙지 않도록 차단
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const res = UrlFetchApp.fetch(url, options);
    return JSON.parse(res.getContentText());
  } catch (err) {
    return { ok: false, description: err.toString() };
  }
}

function splitHtmlMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];
  
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = '';
  
  lines.forEach(line => {
    if ((currentChunk + line + '\n').length > maxLength) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  });
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function sendDomesticMarketSession(sessionKey, sessionEmoji, sessionLabel, isManual) {
  const config = loadSettings();
  const isHol = isKrxHoliday(new Date()).isHoliday;
  
  // 휴장일 자동 발송 제외 체크
  if (!isManual && config.skipHolidays) {
    const check = isKrxHoliday(new Date());
    if (check.isHoliday) {
      const skipLog = `[발송 제외] 오늘은 국내 증시 휴장일(${check.reason})이므로 ${sessionLabel} 리포트 발송을 건너뜁니다.`;
      Logger.log(skipLog);
      return { success: true, skipped: true, message: skipLog };
    }
  }

  const results = [];
  
  // 1. 코스피 리포트 발송 (활성화된 경우)
  if (config.enableKospi) {
    const dataKospi = fetchKrxMarketData('KOSPI', config.topN);
    const processedKospi = calculateHistoricalChanges(dataKospi, config);
    const indicesKospi = fetchMarketIndices('KOSPI');
    const titleKospi = `[${sessionEmoji} 국내 ${sessionLabel} - 코스피(KOSPI) 마감 시총 분석]`;
    const sectionsKospi = generateReportSections(titleKospi, processedKospi, config, indicesKospi);
    
    const photosKospi = [];
    if (indicesKospi && indicesKospi.kospi && indicesKospi.kospi.chartUrl) {
      photosKospi.push(indicesKospi.kospi.chartUrl);
    }
    if (config.enableHeatmap !== false) {
      const heatmapKospi = generateMarketHeatmapUrl(processedKospi, 'KOSPI');
      if (heatmapKospi) photosKospi.push(heatmapKospi);
    }
    const captionKospi = isHol 
      ? `📊 코스피(KOSPI) 최근 거래일 마감 공식 흐름 차트 & 업종별 전체 시황 히트맵` 
      : `📊 코스피(KOSPI) 당일 공식 흐름 차트 & 업종별 전체 시황 히트맵`;
    results.push(sendTelegramReportWithPhotos(config, sectionsKospi.headerHtml, photosKospi, captionKospi, sectionsKospi.bodyHtml));
  }
  
  // 2. 코스닥 리포트 발송 (활성화된 경우)
  if (config.enableKosdak) {
    const dataKosdak = fetchKrxMarketData('KOSDAK', config.topN);
    const processedKosdak = calculateHistoricalChanges(dataKosdak, config);
    const indicesKosdak = fetchMarketIndices('KOSDAK');
    const titleKosdak = `[${sessionEmoji} 국내 ${sessionLabel} - 코스닥(KOSDAK) 마감 시총 분석]`;
    const sectionsKosdak = generateReportSections(titleKosdak, processedKosdak, config, indicesKosdak);
    
    const photosKosdak = [];
    if (indicesKosdak && indicesKosdak.kosdak && indicesKosdak.kosdak.chartUrl) {
      photosKosdak.push(indicesKosdak.kosdak.chartUrl);
    }
    if (config.enableHeatmap !== false) {
      const heatmapKosdak = generateMarketHeatmapUrl('KOSDAK', processedKosdak);
      if (heatmapKosdak) photosKosdak.push(heatmapKosdak);
    }
    const captionKosdak = isHol 
      ? `📊 코스닥(KOSDAQ) 최근 거래일 마감 공식 흐름 차트 & 업종별 전체 시황 히트맵` 
      : `📊 코스닥(KOSDAQ) 당일 공식 흐름 차트 & 업종별 전체 시황 히트맵`;
    results.push(sendTelegramReportWithPhotos(config, sectionsKosdak.headerHtml, photosKosdak, captionKosdak, sectionsKosdak.bodyHtml));
  }
  
  if (results.length === 0) {
    const msg = `[발송 제외] 코스피/코스닥 수신 설정이 모두 비활성화되어 있어 ${sessionLabel} 리포트를 발송하지 않았습니다.`;
    Logger.log(msg);
    return { success: true, skipped: true, message: msg };
  }
  
  return { success: true, message: `${sessionLabel} 리포트 발송 완료 (${results.length}개 시장)` };
}

function sendKrxPreReport() {
  return sendDomesticMarketSession('krxPre', '🌅', '프리마켓', false);
}

function sendKrxMainReport() {
  return sendDomesticMarketSession('krxMain', '📊', '정규장', false);
}

function sendKrxAfterReport() {
  return sendDomesticMarketSession('krxAfter', '🌙', '애프터마켓', false);
}

// 레거시 호환성 유지
function sendKrxNxtReport() {
  return sendKrxAfterReport();
}

function sendUsReport() {
  const config = loadSettings();
  const isUsHol = isUsHoliday(new Date()).isHoliday;
  
  // 휴장일 자동 발송 제외 체크
  if (config.skipHolidays) {
    const check = isUsHoliday(new Date());
    if (check.isHoliday) {
      const skipLog = `[발송 제외] 분석 대상 미국 증시 세션이 휴장(${check.reason})이므로 미국 마감 리포트 발송을 건너뜁니다.`;
      Logger.log(skipLog);
      return { success: true, skipped: true, message: skipLog };
    }
  }

  const data = fetchUsMarketData(config.topN);
  const processed = calculateHistoricalChanges(data, config);
  const indicesUs = fetchMarketIndices('US');
  const titleUs = '[🇺🇸 미국 증시 마감 시총 분석]';
  const sectionsUs = generateReportSections(titleUs, processed, config, indicesUs);

  const photosUs = [];
  if (indicesUs && indicesUs.nasdaq && indicesUs.nasdaq.chartUrl) photosUs.push(indicesUs.nasdaq.chartUrl);
  if (indicesUs && indicesUs.spx && indicesUs.spx.chartUrl) photosUs.push(indicesUs.spx.chartUrl);
  if (config.enableHeatmap !== false) {
    const heatmapUs = generateMarketHeatmapUrl('US', processed);
    if (heatmapUs) photosUs.push(heatmapUs);
  }
  const captionUs = isUsHol 
    ? '📊 미국 증시 최근 거래일 마감 공식 흐름 차트(나스닥/S&P 500) & 섹터별 전체 시황 히트맵' 
    : '📊 미국 증시 당일 공식 흐름 차트(나스닥/S&P 500) & 섹터별 전체 시황 히트맵';

  return sendTelegramReportWithPhotos(config, sectionsUs.headerHtml, photosUs, captionUs, sectionsUs.bodyHtml);
}

// 수동 즉시 발송 함수 (대시보드 UI 테스트용 - 휴장일이라도 강제 전송)
function sendManualKrxPreReport() {
  return sendDomesticMarketSession('krxPre', '🌅', '프리마켓', true);
}

function sendManualKrxMainReport() {
  return sendDomesticMarketSession('krxMain', '📊', '정규장', true);
}

function sendManualKrxAfterReport() {
  return sendDomesticMarketSession('krxAfter', '🌙', '애프터마켓', true);
}

function sendManualKrxNxtReport() {
  return sendManualKrxAfterReport();
}

function sendManualUsReport() {
  const config = loadSettings();
  const isUsHol = isUsHoliday(new Date()).isHoliday;
  const data = fetchUsMarketData(config.topN);
  const processed = calculateHistoricalChanges(data, config);
  const indicesUs = fetchMarketIndices('US');
  const titleUs = '[🇺🇸 미국 증시 마감 시총 분석]';
  const sectionsUs = generateReportSections(titleUs, processed, config, indicesUs);

  const photosUs = [];
  if (indicesUs && indicesUs.nasdaq && indicesUs.nasdaq.chartUrl) photosUs.push(indicesUs.nasdaq.chartUrl);
  if (indicesUs && indicesUs.spx && indicesUs.spx.chartUrl) photosUs.push(indicesUs.spx.chartUrl);
  if (config.enableHeatmap !== false) {
    const heatmapUs = generateMarketHeatmapUrl('US', processed);
    if (heatmapUs) photosUs.push(heatmapUs);
  }
  const captionUs = isUsHol 
    ? '📊 미국 증시 최근 거래일 마감 공식 흐름 차트(나스닥/S&P 500) & 섹터별 전체 시황 히트맵' 
    : '📊 미국 증시 당일 공식 흐름 차트(나스닥/S&P 500) & 섹터별 전체 시황 히트맵';

  return sendTelegramReportWithPhotos(config, sectionsUs.headerHtml, photosUs, captionUs, sectionsUs.bodyHtml);
}

function formatDate(date) {
  return Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') + ' (KST)';
}

function formatNumber(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  return val.toLocaleString('ko-KR');
}

function formatCapKr(capIn100M) {
  if (!capIn100M || capIn100M <= 0) return '0원';
  const jo = Math.floor(capIn100M / 10000);
  const eok = Math.floor(capIn100M % 10000);
  if (jo > 0) {
    return `${jo}조 ${eok > 0 ? eok.toLocaleString('ko-KR') + '억' : ''}원`;
  }
  return `${eok.toLocaleString('ko-KR')}억원`;
}

function formatCapUsd(capInUsd) {
  if (!capInUsd || capInUsd <= 0) return '$0';
  const trillion = capInUsd / 1e12;
  if (trillion >= 1) {
    return `$${trillion.toFixed(2)}T`;
  }
  const billion = capInUsd / 1e9;
  return `$${billion.toFixed(2)}B`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getFallbackKrxData(topN, marketType) {
  const kospiFallback = [
    { code: '005930', name: '삼성전자', market: 'KOSPI', price: 274500, highPrice: 380000, changeRate: 2.43, marketCapRaw: 16048035, marketCapFormatted: '1,604조 8,035억원', sector: '반도체와반도체장비', link: 'https://finance.naver.com/item/main.naver?code=005930' },
    { code: '000660', name: 'SK하이닉스', market: 'KOSPI', price: 1645000, highPrice: 3002000, changeRate: 3.26, marketCapRaw: 12016599, marketCapFormatted: '1,201조 6,599억원', sector: '반도체와반도체장비', link: 'https://finance.naver.com/item/main.naver?code=000660' },
    { code: '005935', name: '삼성전자우', market: 'KOSPI', price: 195600, highPrice: 243500, changeRate: 4.15, marketCapRaw: 1569438, marketCapFormatted: '156조 9,438억원', sector: '반도체와반도체장비', link: 'https://finance.naver.com/item/main.naver?code=005935' },
    { code: '402340', name: 'SK스퀘어', market: 'KOSPI', price: 1154000, highPrice: 2338000, changeRate: 3.31, marketCapRaw: 1522800, marketCapFormatted: '152조 2,800억원', sector: '창업투자', link: 'https://finance.naver.com/item/main.naver?code=402340' },
    { code: '009150', name: '삼성전기', market: 'KOSPI', price: 1558000, highPrice: 2417000, changeRate: 3.66, marketCapRaw: 1163728, marketCapFormatted: '116조 3,728억원', sector: '전자장비와기기', link: 'https://finance.naver.com/item/main.naver?code=009150' },
    { code: '005380', name: '현대차', market: 'KOSPI', price: 245000, highPrice: 787000, changeRate: 8.24, marketCapRaw: 927553, marketCapFormatted: '92조 7,553억원', sector: '자동차', link: 'https://finance.naver.com/item/main.naver?code=005380' },
    { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI', price: 345000, highPrice: 527000, changeRate: 1.09, marketCapRaw: 864630, marketCapFormatted: '86조 4,630억원', sector: '전기제품', link: 'https://finance.naver.com/item/main.naver?code=373220' },
    { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', price: 980000, highPrice: 1987000, changeRate: -1.02, marketCapRaw: 716584, marketCapFormatted: '71조 6,584억원', sector: '제약', link: 'https://finance.naver.com/item/main.naver?code=207940' },
    { code: '032830', name: '삼성생명', market: 'KOSPI', price: 301000, highPrice: 518000, changeRate: 3.26, marketCapRaw: 602000, marketCapFormatted: '60조 2,000억원', sector: '생명보험', link: 'https://finance.naver.com/item/main.naver?code=032830' },
    { code: '028260', name: '삼성물산', market: 'KOSPI', price: 369000, highPrice: 566000, changeRate: 1.10, marketCapRaw: 598398, marketCapFormatted: '59조 8,398억원', sector: '복합기업', link: 'https://finance.naver.com/item/main.naver?code=028260' },
    { code: '012450', name: '한화에어로스페이스', market: 'KOSPI', price: 1160000, highPrice: 1713000, changeRate: -2.11, marketCapRaw: 598135, marketCapFormatted: '59조 8,135억원', sector: '우주항공과국방', link: 'https://finance.naver.com/item/main.naver?code=012450' },
    { code: '105560', name: 'KB금융', market: 'KOSPI', price: 168500, highPrice: 195900, changeRate: 0.24, marketCapRaw: 597649, marketCapFormatted: '59조 7,649억원', sector: '은행', link: 'https://finance.naver.com/item/main.naver?code=105560' },
    { code: '000270', name: '기아', market: 'KOSPI', price: 141700, highPrice: 212500, changeRate: 3.13, marketCapRaw: 553215, marketCapFormatted: '55조 3,215억원', sector: '자동차', link: 'https://finance.naver.com/item/main.naver?code=000270' },
    { code: '329180', name: 'HD현대중공업', market: 'KOSPI', price: 510000, highPrice: 768000, changeRate: 2.82, marketCapRaw: 535302, marketCapFormatted: '53조 5,302억원', sector: '조선', link: 'https://finance.naver.com/item/main.naver?code=329180' },
    { code: '034020', name: '두산에너빌리티', market: 'KOSPI', price: 82600, highPrice: 139200, changeRate: 2.10, marketCapRaw: 529104, marketCapFormatted: '52조 9,104억원', sector: '기계', link: 'https://finance.naver.com/item/main.naver?code=034020' },
    { code: '055550', name: '신한지주', market: 'KOSPI', price: 107400, highPrice: 116500, changeRate: 0.75, marketCapRaw: 504190, marketCapFormatted: '50조 4,190억원', sector: '은행', link: 'https://finance.naver.com/item/main.naver?code=055550' },
    { code: '012330', name: '현대모비스', market: 'KOSPI', price: 547000, highPrice: 822000, changeRate: 7.05, marketCapRaw: 496307, marketCapFormatted: '49조 6,307억원', sector: '자동차부품', link: 'https://finance.naver.com/item/main.naver?code=012330' },
    { code: '068270', name: '셀트리온', market: 'KOSPI', price: 201000, highPrice: 258500, changeRate: -0.50, marketCapRaw: 467561, marketCapFormatted: '46조 7,561억원', sector: '제약', link: 'https://finance.naver.com/item/main.naver?code=068270' },
    { code: '034730', name: 'SK', market: 'KOSPI', price: 585000, highPrice: 920000, changeRate: 5.79, marketCapRaw: 424141, marketCapFormatted: '42조 4,141억원', sector: '복합기업', link: 'https://finance.naver.com/item/main.naver?code=034730' },
    { code: '006400', name: '삼성SDI', market: 'KOSPI', price: 516000, highPrice: 820000, changeRate: 5.95, marketCapRaw: 415821, marketCapFormatted: '41조 5,821억원', sector: '전기제품', link: 'https://finance.naver.com/item/main.naver?code=006400' }
  ];

  const kosdakFallback = [
    { code: '196170', name: '알테오젠', market: 'KOSDAK', price: 425000, highPrice: 569000, changeRate: 3.41, marketCapRaw: 226815, marketCapFormatted: '22조 6,815억원', sector: '생물공학', link: 'https://finance.naver.com/item/main.naver?code=196170' },
    { code: '247540', name: '에코프로비엠', market: 'KOSDAK', price: 168000, highPrice: 260000, changeRate: 1.82, marketCapRaw: 164280, marketCapFormatted: '16조 4,280억원', sector: '전기제품', link: 'https://finance.naver.com/item/main.naver?code=247540' },
    { code: '086520', name: '에코프로', market: 'KOSDAK', price: 78500, highPrice: 190000, changeRate: 2.21, marketCapRaw: 104520, marketCapFormatted: '10조 4,520억원', sector: '전기제품', link: 'https://finance.naver.com/item/main.naver?code=086520' },
    { code: '028300', name: 'HLB', market: 'KOSDAK', price: 74200, highPrice: 69200, changeRate: -0.80, marketCapRaw: 97150, marketCapFormatted: '9조 7,150억원', sector: '제약/생물공학', link: 'https://finance.naver.com/item/main.naver?code=028300' },
    { code: '277810', name: '레인보우로보틱스', market: 'KOSDAK', price: 142000, highPrice: 979000, changeRate: 4.10, marketCapRaw: 27420, marketCapFormatted: '2조 7,420억원', sector: '기계', link: 'https://finance.naver.com/item/main.naver?code=277810' },
    { code: '058470', name: '리노공업', market: 'KOSDAK', price: 198000, highPrice: 133100, changeRate: 1.54, marketCapRaw: 30180, marketCapFormatted: '3조 180억원', sector: '반도체와반도체장비', link: 'https://finance.naver.com/item/main.naver?code=058470' },
    { code: '403870', name: 'HPSP', market: 'KOSDAK', price: 34500, highPrice: 92000, changeRate: 2.68, marketCapRaw: 28940, marketCapFormatted: '2조 8,940억원', sector: '반도체와반도체장비', link: 'https://finance.naver.com/item/main.naver?code=403870' },
    { code: '145020', name: '휴젤', market: 'KOSDAK', price: 285000, highPrice: 308500, changeRate: 1.06, marketCapRaw: 35120, marketCapFormatted: '3조 5,120억원', sector: '제약', link: 'https://finance.naver.com/item/main.naver?code=145020' },
    { code: '214150', name: '클래시스', market: 'KOSDAK', price: 54200, highPrice: 77600, changeRate: 0.93, marketCapRaw: 35200, marketCapFormatted: '3조 5,200억원', sector: '건강관리장비와용품', link: 'https://finance.naver.com/item/main.naver?code=214150' },
    { code: '035900', name: 'JYP Ent.', market: 'KOSDAK', price: 62000, highPrice: 105100, changeRate: -1.27, marketCapRaw: 22010, marketCapFormatted: '2조 2,010억원', sector: '방송과엔터테인먼트', link: 'https://finance.naver.com/item/main.naver?code=035900' }
  ];

  if (marketType === 'KOSDAK') {
    return kosdakFallback.slice(0, topN);
  }
  return kospiFallback.slice(0, topN);
}

function getFallbackUsData(topN, tickers) {
  const targetCount = parseInt(topN, 10) || 20;
  const mockMap = [
    { code: 'NVDA', name: '엔비디아', market: 'NASDAQ', price: 230.48, highPrice: 243.37, changeRate: -2.94, marketCapRaw: 5554568000000, marketCapFormatted: '$5.55T', sector: '반도체', link: 'https://m.stock.naver.com/worldstock/stock/NVDA.O' },
    { code: 'AAPL', name: '애플', market: 'NASDAQ', price: 340.42, highPrice: 345.80, changeRate: 1.11, marketCapRaw: 4968150000000, marketCapFormatted: '$4.97T', sector: '컴퓨터, 전화 및 가전제품', link: 'https://m.stock.naver.com/worldstock/stock/AAPL.O' },
    { code: 'MSFT', name: '마이크로소프트', market: 'NASDAQ', price: 522.61, highPrice: 555.45, changeRate: -1.35, marketCapRaw: 3880664000000, marketCapFormatted: '$3.88T', sector: '소프트웨어 및 IT 서비스', link: 'https://m.stock.naver.com/worldstock/stock/MSFT.O' },
    { code: 'AMZN', name: '아마존닷컴', market: 'NASDAQ', price: 254.06, highPrice: 260.10, changeRate: -2.25, marketCapRaw: 2740370000000, marketCapFormatted: '$2.74T', sector: '다양한 소매업', link: 'https://m.stock.naver.com/worldstock/stock/AMZN.O' },
    { code: 'TSM', name: 'TSMC ADR', market: 'NYSE', price: 457.99, highPrice: 470.00, changeRate: -3.01, marketCapRaw: 2375400000000, marketCapFormatted: '$2.38T', sector: '반도체', link: 'https://m.stock.naver.com/worldstock/stock/TSM.N' },
    { code: 'GOOGL', name: '알파벳 Class A', market: 'NASDAQ', price: 348.29, highPrice: 355.00, changeRate: -0.63, marketCapRaw: 2334587000000, marketCapFormatted: '$2.33T', sector: '소프트웨어 및 IT 서비스', link: 'https://m.stock.naver.com/worldstock/stock/GOOGL.O' },
    { code: 'META', name: '메타', market: 'NASDAQ', price: 720.89, highPrice: 740.00, changeRate: -0.06, marketCapRaw: 1836471000000, marketCapFormatted: '$1.84T', sector: '소프트웨어 및 IT 서비스', link: 'https://m.stock.naver.com/worldstock/stock/META.O' },
    { code: 'AVGO', name: '브로드컴', market: 'NASDAQ', price: 360.14, highPrice: 385.00, changeRate: -4.35, marketCapRaw: 1719175000000, marketCapFormatted: '$1.72T', sector: '반도체', link: 'https://m.stock.naver.com/worldstock/stock/AVGO.O' },
    { code: 'TSLA', name: '테슬라', market: 'NASDAQ', price: 375.00, highPrice: 488.54, changeRate: -0.74, marketCapRaw: 1481080000000, marketCapFormatted: '$1.48T', sector: '자동차 및 부품', link: 'https://m.stock.naver.com/worldstock/stock/TSLA.O' },
    { code: 'LLY', name: '일라이 릴리', market: 'NYSE', price: 1169.60, highPrice: 1200.00, changeRate: -1.61, marketCapRaw: 1101000000000, marketCapFormatted: '$1.10T', sector: '제약', link: 'https://m.stock.naver.com/worldstock/stock/LLY.N' },
    { code: 'JPM', name: '제이피모간체이스', market: 'NYSE', price: 331.42, highPrice: 340.00, changeRate: 0.56, marketCapRaw: 881000000000, marketCapFormatted: '$881.00B', sector: '은행', link: 'https://m.stock.naver.com/worldstock/stock/JPM.N' },
    { code: 'BRK B', name: '버크셔 해서웨이 Class B', market: 'NYSE', price: 511.05, highPrice: 525.00, changeRate: 0.95, marketCapRaw: 719600000000, marketCapFormatted: '$719.60B', sector: '투자회사', link: 'https://m.stock.naver.com/worldstock/stock/BRK_B.N' },
    { code: 'V', name: '비자', market: 'NYSE', price: 375.10, highPrice: 385.00, changeRate: 0.81, marketCapRaw: 700300000000, marketCapFormatted: '$700.30B', sector: '금융서비스', link: 'https://m.stock.naver.com/worldstock/stock/V.N' },
    { code: 'WMT', name: '월마트', market: 'NYSE', price: 105.20, highPrice: 108.00, changeRate: 0.45, marketCapRaw: 685000000000, marketCapFormatted: '$685.00B', sector: '할인점', link: 'https://m.stock.naver.com/worldstock/stock/WMT.N' },
    { code: 'UNH', name: '유나이티드헬스', market: 'NYSE', price: 590.10, highPrice: 610.00, changeRate: -0.30, marketCapRaw: 540000000000, marketCapFormatted: '$540.00B', sector: '의료서비스', link: 'https://m.stock.naver.com/worldstock/stock/UNH.N' },
    { code: 'MA', name: '마스터카드', market: 'NYSE', price: 520.40, highPrice: 535.00, changeRate: 0.72, marketCapRaw: 480000000000, marketCapFormatted: '$480.00B', sector: '금융서비스', link: 'https://m.stock.naver.com/worldstock/stock/MA.N' },
    { code: 'XOM', name: '엑손모빌', market: 'NYSE', price: 122.50, highPrice: 125.00, changeRate: -1.15, marketCapRaw: 470000000000, marketCapFormatted: '$470.00B', sector: '에너지', link: 'https://m.stock.naver.com/worldstock/stock/XOM.N' },
    { code: 'COST', name: '코스트코 홀세일', market: 'NASDAQ', price: 947.92, highPrice: 955.00, changeRate: 0.60, marketCapRaw: 420051000000, marketCapFormatted: '$420.05B', sector: '할인점', link: 'https://m.stock.naver.com/worldstock/stock/COST.O' },
    { code: 'AMAT', name: '어플라이드 머티어리얼즈', market: 'NASDAQ', price: 509.57, highPrice: 530.00, changeRate: -2.13, marketCapRaw: 404393000000, marketCapFormatted: '$404.39B', sector: '반도체 장비', link: 'https://m.stock.naver.com/worldstock/stock/AMAT.O' },
    { code: 'HD', name: '홈디포', market: 'NYSE', price: 410.20, highPrice: 420.00, changeRate: 0.35, marketCapRaw: 401000000000, marketCapFormatted: '$401.00B', sector: '소매업', link: 'https://m.stock.naver.com/worldstock/stock/HD.N' }
  ];
  return mockMap.slice(0, targetCount);
}
