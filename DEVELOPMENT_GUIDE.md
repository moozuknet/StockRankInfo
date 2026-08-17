# 🛠 개발 및 배포 가이드 (DEVELOPMENT GUIDE)

본 문서는 Google Apps Script(GAS) 프로젝트 생성부터 텔레그램 봇 연동, Clasp CLI 배포, 미리보기 모달 및 시점별 애널리스트 요약 엔진에 대한 개발/유지보수 가이드입니다.

---

## 1. 📝 Google Apps Script 프로젝트 구성 및 Clasp CLI 자동화

### 1) Clasp CLI를 이용한 로컬 코드 푸시 및 배포
본 프로젝트는 `clasp` CLI를 통해 로컬 환경에서 온라인 GAS 프로젝트로 소스 코드를 즉시 업로드하고 버전을 배포할 수 있습니다.

```bash
# 1. 의존성 및 clasp 설치 확인
npx clasp --version

# 2. 로컬 코드 온라인 GAS 프로젝트로 강제 푸시 (.claspignore 자동 적용)
npx clasp push --force

# 3. 새로운 버전 생성 및 배포 (Production Web App)
npx clasp deploy --description "v1.5 Release - Period Analyst Summary & Documentation Update"

# 4. 배포 목록 및 실행 URL 확인
npx clasp deployments
```

### 2) `.clasp.json` 파일 구조
```json
{
  "scriptId": "15e5lRqFYzYIiO-nYcg9zLPJKGRTxSv9tSSoZ_95gLQG8K4XvEjlWF0K9",
  "rootDir": "."
}
```

---

## 2. 🤖 Telegram Bot 생성 및 Token / Chat ID 획득 절차

### 1단계: Telegram Bot Token 생성
1. 텔레그램 앱 실행 후 검색창에 **`@BotFather`**를 검색하여 대화를 시작합니다.
2. `/newbot` 입력 후 안내에 따라 봇 이름을 설정하고 발급된 **HTTP API Token**을 복사합니다.
   - *예시: `7123456789:AAFgH1i2j3k4L5m6N7o8P9q0R1s2T3u4V5w`*

### 2단계: Telegram Chat ID 획득
1. 텔레그램 검색창에 **`@userinfobot`**을 검색하여 자신의 개인 **Chat ID(숫자)**를 확인합니다.
2. 채널/그룹에 발송할 경우 봇을 채널의 **관리자(Admin)**로 등록 후 `"chat":{"id":-1001234567890}` 형태의 음수 Chat ID를 사용합니다.

---

## 3. 🚀 백엔드 핵심 API 및 파싱 엔진 (`Code.gs`)

1. **`previewReport(marketType)`**:
   - Web UI의 미리보기 버튼 클릭 시 호출되며, 텔레그램으로 발송하기 전에 수집된 데이터 및 HTML 메시지 원문/렌더링 결과(`htmlMessage`, `charCount`)를 JSON으로 반환합니다.

2. **`generateAnalystSummary(stockList, sessionTitle, config)` (v1.5+)**:
   - 사용자가 체크한 비교 시점(`1d`, `5d`, `1m`, `3m`, `1y`) 각각에 맞춰 시점별 최대 상승/하락 종목 및 순위 급변동 종목(▲/▼ 5계단 이상)을 구간별로 구조화하여 요약합니다.

3. **`calculateHistoricalChanges(stockList, config)`**:
   - 1위 고정 대형주(`005930`, `AAPL`, `NVDA`)가 1위 유지 시 순위 상승으로 왜곡되는 오류를 보정(`isPermanentTop1`)합니다.

4. **`syncTriggersAction()` & `saveSettings(config)`**:
   - 설정 저장(`saveSettings`)과 트리거 등록(`syncTriggersAction`)이 분리되어 사용자가 스케줄 업데이트 시점을 명확하게 제어할 수 있습니다.

---

## 4. ⏰ 서머타임(DST) 판별 및 스케줄링 디버깅

### 1) 미국 서머타임(DST) 판별 알고리즘 (`isUsDst`)
- 미국 동부 시간대(ET) 3월 2번째 일요일 02:00 ~ 11월 1번째 일요일 02:00 구간을 계산합니다.
  - **EDT (서머타임)**: 미국 마감 16:00 EDT = KST 다음날 **05:00** → 발송 트리거: **05:05 KST**
  - **EST (표준시)**: 미국 마감 16:00 EST = KST 다음날 **06:00** → 발송 트리거: **06:05 KST**
- 매일 새벽 01:00 KST에 `dailyTriggerCheck` 함수가 실행되어 서머타임 전환 시점 당일에 자동으로 트리거 시각을 재설정합니다.

### 2) 디버깅 및 실행 로그 확인
- GAS 편집기 좌측 메뉴의 **[실행 (Executions)]** 탭에서 실행 이력과 로그(Logger.log)를 점검할 수 있습니다.
- 웹 UI의 **[👁️ 미리보기]** 버튼을 통해 언제든지 실시간 수집 결과와 생성 문구를 사전 확인할 수 있습니다.
