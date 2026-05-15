# M&C 회의록 대시보드 — Lovable 빌드 명세

> 본 문서는 현재 `dashboard.html`(standalone vanilla JS, ~3,200줄)의 모든 기능을 Lovable(Vite + React + TypeScript + Tailwind + shadcn/ui)로 재빌드하기 위한 단계별 프롬프트 명세입니다. **각 단계의 코드블록을 Lovable 채팅창에 그대로 복붙**하시면 됩니다.

---

## 0. 인계 흐름 (대표님 작업 순서)

1. `lovable.dev` 접속 → **New Project**
2. 아래 **STEP 1 메인 프롬프트** 그대로 붙여넣고 전송 → 골격 생성 대기
3. **STEP 2 ~ STEP 6**을 순서대로 한 단계씩 입력 → 매 단계 결과 확인 후 다음 단계 진행
4. 완성되면 우상단 **GitHub** 버튼 클릭 → **Create Repository** → 새 repo 자동 생성
5. (선택) 새 repo를 로컬로 clone → 운영 도메인(Vercel)에 연결

> ⚠️ 한 번에 전체를 다 넣으면 Lovable이 일부를 빠뜨립니다. **반드시 단계별로** 진행하세요.

---

## STEP 1 — 메인 프롬프트 (골격 + 디자인 시스템)

```
M&C커뮤니케이션즈 신사업실의 주간회의록 관리 대시보드를 만들어줘.
스택은 Vite + React + TypeScript + Tailwind + shadcn/ui이고, 모든 데이터는 브라우저 localStorage에 저장돼.

## 디자인 시스템 (JC Design System)
라이트모드 토큰:
- Primary: #0A2540 (다크 네이비)
- Primary Soft: #1A3556
- Accent: #2962FF (파랑) / Accent Soft: #E8EFFF / Accent Strong: #1E4DCC
- Orange: #FF5722, Magenta: #E91E63, Neon Green: #00C853
- Background: #F8F9FB / Elevated: #FFFFFF / Card: #F1F3F7
- Border: #E5E8ED / Border Strong: #C9CFD8
- Text: #1A1D24 / Muted: #5A6270 / Disabled: #A0A6B0
- Success: #00C853 / Warning: #FFA000 / Danger: #D32F2F
- Radius: sm 8px, md 12px, lg 16px, pill 999px
- Gap: 8/16/24/32
- Shadow: 0 1px 3px rgba(10,37,64,0.06)

폰트: Pretendard (CDN: https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css)

다크모드: prefers-color-scheme + 우상단 토글 버튼으로 수동 오버라이드. localStorage에 'theme' 저장.

## 레이아웃 골격 (단일 페이지, 위에서 아래로)
1. **Topbar (sticky)**: 좌측에 "M&C 신사업실 주간회의록" 브랜드 + 마지막 갱신 시간. 우측에 [주차 선택 셀렉트] [키워드 검색] [+ 회의록 작성] [시트 열기] [↓ Export] [↑ Import] [🌙 다크모드 토글] 버튼.
2. **KPI 4카드** (가로 grid):
   - 이번 주 회의 (건수, 클릭 시 이번 주 필터)
   - 진행 프로젝트 (유니크 수)
   - 액션 완료율 (% + progress bar)
   - 미결 액션 (건수, 빨간색 alert 스타일)
3. **실시간 이슈/메모** 섹션: 입력란 + 추가 버튼 + 시각 표시된 리스트, 삭제 X 버튼.
4. **이번 주 주요 안건** 섹션: 입력란 + 추가, 각 안건은 [해결 체크박스][텍스트][차주 이월 체크박스][삭제 X]. 지난 주 미해결+이월 표시된 안건이 있으면 상단에 "↻ 지난 주 미해결 · 이번 주 계속" 배너로 노출 + "이번 주로 가져오기" 버튼.
5. **금주 핵심 일정 (D-day)**: 회의록 액션의 마감일을 모아 카드 strip으로 표시.
6. **프로젝트 라이프사이클**: 칸반 형태 8단계(리드, 제안, 협상, 수주, 계약, 진행, 완료, 정산).
7. **파트별 과업 그리드**: 부서별 카드 — 각 카드에 회의록·결정·액션 자동 집계.
8. **필터 칩**: 부서/프로젝트 칩 (active 표시).
9. **회의록 리스트 + 상세** (2-pane, 모바일은 단일 칼럼):
   - 좌측: 회의록 카드 리스트 (회의일자·회의명·부서·프로젝트·이번주 배지)
   - 우측: 선택된 회의록 상세 (안건/결정/액션/참석자/비고)
   - 액션 항목은 체크박스로 완료 토글
10. **푸터**: M&C커뮤니케이션즈 · 신사업실 · 데이터 소스 표시.

먼저 이 골격과 디자인 토큰을 적용한 뼈대를 만들어줘. 데이터는 다음 단계에서 채울 거야.
```

---

## STEP 2 — 데이터 모델 & 회의록 CRUD

```
이제 회의록 CRUD를 추가해줘.

## 데이터 모델 (TypeScript)
```ts
type MeetingRow = {
  _id: string;
  _local: true;
  timestamp: string;       // ISO
  meeting_date: string;    // 'YYYY-MM-DD'
  week: string;            // 'YYYY-Www' (자동 계산)
  title: string;
  project_tag: string;     // projects 배열 중 하나
  department: string;      // departments 배열 중 하나
  author: string;          // members 배열 중 하나
  attendees: string;       // 콤마 구분
  agenda_md: string;       // markdown
  decisions_md: string;
  actions_md: string;      // - [ ]/- [x] 마크다운
  next_meeting: string;    // 'YYYY-MM-DD'
  note_md: string;
};
```

## localStorage 키
- `jc-meeting-dashboard:rows` — MeetingRow[]
- `jc-meeting-dashboard:live-issues` — { id, text, createdAt }[]
- `jc-meeting-dashboard:weekly-agendas` — { id, week, text, status: 'open'|'done', carryToNext: boolean, createdAt }[]
- `jc-meeting-dashboard:theme` — 'light' | 'dark'

## 모달 (+ 회의록 작성 버튼 클릭 시)
필드:
- 회의일자 (date, required)
- 다음 회의 (date)
- 회의명 (text, required)
- 부서 (select)
- 프로젝트 (select, 부서 선택에 따라 옵션 동적 변경 - 아래 dept_projects 매핑 사용)
- 작성자 (select)
- 참석자 (체크박스 picker, 부서별 그룹화, 같은 인물 중복 시 첫 부서에서만 표시. 추가 참석자는 별도 input)
- 안건 (계층 입력: 부모 항목 + 자식 항목 추가/삭제)
- 결정사항 (계층 입력 동일)
- 액션아이템 (담당자 select + 할 일 input + 마감일 date + ☐ 완료 토글)
- 비고 (textarea)
- 하단: [삭제] (수정 시만) / 취소 / 저장

## 동작
- 신규 작성 시: 기본 부서 = '신사업 기획팀'(있을 때). 참석자는 빈 상태로 시작.
- 저장: localStorage 즉시 반영 + 리스트/KPI 즉시 갱신 (reload 비동기 대기 X).
- 부서 변경 시 프로젝트 옵션 재계산.
- 액션 마크다운 형식: 한 줄에 `- [ ] 담당자: 할 일 [~마감일]` 또는 `- [x] ...` (완료). 미니 파서로 list/text/due/owner 추출.

## 마크다운
의존성 0의 미니 마크다운 파서: **bold**, *italic*, `code`, 헤딩(##~####), - 리스트, > 인용, [text](url) 링크, - [ ] / - [x] task. 모든 본문은 escape 후 안전 태그만 렌더.
```

---

## STEP 3 — 부서·프로젝트·팀 데이터 시드

```
다음 시드 데이터를 src/config.ts 같은 파일에 상수로 넣어줘.

## 회사
M&C커뮤니케이션즈 (2011년 설립, 19명)

## 부서 목록
['대표이사실', 'MICE 기획팀', '신사업 기획팀', '콘텐츠기획팀', '경영지원팀', '브랜드 리뉴얼 TF', '전체(주간회의)']

## 부서별 인원 (이 매핑이 참석자 picker 그룹의 정렬 기준)
{
  '대표이사실': ['민경익 대표이사'],
  'MICE 기획팀': ['오미영 실장','정은용 과장','조수아 대리','이효정 주임','임혜전 과장','이승주 대리','차동헌 주임','이효원 주임'],
  '신사업 기획팀': ['이진철 실장','김정길 과장','곽은지 대리','김현 주임','이지후 사원'],
  '콘텐츠기획팀': ['오미영 실장','서석민 대리','성희영 주임','이아름 사원'],
  '경영지원팀': ['김현정 과장','오유연 대리'],
  '브랜드 리뉴얼 TF': ['서석민 대리','성희영 주임','김현 주임','김정길 과장','이진철 실장']
}
※ 겸직 인원(이진철·김정길·김현·서석민·성희영·오미영)은 picker에서 첫 부서에서만 출력, 이후 부서에서는 자동 스킵.

## 프로젝트 목록
['MiceConfigurator','리멤버','ConfEx','IUCR','번역원','KTO','옥타브','투비소프트','센트릭','관광학회','부탄','러닝페스티벌','메타버스/KMF','기타']

## 부서별 허용 프로젝트 (모달의 프로젝트 select가 이걸로 필터링)
{
  '대표이사실': '*',  // 전체 허용
  'MICE 기획팀': ['번역원','KTO','옥타브','투비소프트','센트릭','관광학회','부탄','러닝페스티벌','메타버스/KMF','리멤버','기타'],
  '신사업 기획팀': ['리멤버','MiceConfigurator','ConfEx','IUCR','기타'],
  '콘텐츠기획팀': '*',
  '경영지원팀': '*',
  '브랜드 리뉴얼 TF': ['기타'],
  '전체(주간회의)': '*'
}

## 작성자 select 옵션 (전체 19명)
['민경익 대표이사','오미영 실장','이진철 실장','김현정 과장','임혜전 과장','정은용 과장','김정길 과장','서석민 대리','조수아 대리','이승주 대리','곽은지 대리','오유연 대리','차동헌 주임','이효정 주임','이효원 주임','김현 주임','성희영 주임','이아름 사원','이지후 사원']

## 주차 계산
ISO 8601 주차 ('YYYY-Www', 예: '2026-W20'). meeting_date에서 자동 계산.
```

---

## STEP 4 — 이전 주 캐리오버 (자동 불러오기)

```
회의록 작성 모달에 "이전 주 회의록 캐리오버" 기능을 추가해줘.

## 동작
1. 신규 작성 모달이 열리면 모달 body 최상단에 캐리오버 배너 영역을 둠.
2. 현재 선택된 부서·회의일자 기준으로 **같은 부서의 직전 회의록**을 검색:
   - 조건: row.department === 선택 부서 AND row.meeting_date < 현재 입력된 회의일자
   - 가장 가까운 (최근) 회의록 1건 선택
3. 발견되면 배너 표시:
   "📋  지난 {meeting_date} {department} 회의록이 있습니다 — 안건·참석자·미완료 액션({미완료수}/{전체수})을 불러옵니다."
   [불러오기] [×]
4. 부서·회의일자 변경 시 배너 자동 재계산.
5. **[불러오기]** 클릭 시:
   - title = prev.title (단, 이미 사용자가 입력했으면 유지)
   - attendees = prev.attendees 그대로
   - agenda = prev.agenda_md 트리 그대로 복사
   - decisions = 빈 배열 (새 회의에서 새로 작성)
   - actions = prev.actions 중 **완료되지 않은 항목만** 복사 (done: false로 초기화)
   - 토스트: "지난 {meeting_date} 회의록을 불러왔습니다 — 수정 후 저장하세요"
6. **[×]** 클릭 시: 배너 닫기.
7. 수정 모드(기존 row 편집)에서는 배너 표시 안 함.
```

---

## STEP 5 — 주차별 주요 안건 (캐리오버 + 이월)

```
"이번 주 주요 안건" 섹션의 동작을 다음과 같이 구현해줘.

## 데이터 (localStorage: 'jc-meeting-dashboard:weekly-agendas')
```ts
type WeeklyAgenda = {
  id: string;
  text: string;
  week: string;       // 'YYYY-Www'
  status: 'open' | 'done';
  carryToNext: boolean;
  createdAt: string;
};
```

## 표시 기준 주차
- 주차 필터(week-select)가 'all'이면 → 현재 ISO 주차
- 특정 주차 선택 시 → 그 주차

## 화면 동작
1. **추가**: 상단 input에 텍스트 입력 후 Enter 또는 [+ 추가] 버튼 → 현재 주차로 저장.
2. **해결 토글**: 각 안건 왼쪽 체크박스. 체크 시 status='done', 줄긋기(line-through) + 흐리게.
3. **차주 이월**: 각 안건 오른쪽에 작은 체크박스 "차주 이월". 체크 시 carryToNext=true (다음 주차 화면에서 자동 노출됨).
4. **삭제**: × 버튼.
5. **지난 주 미해결 배너** (상단):
   - 현재 주차 < week, status='open', carryToNext=true 인 항목들 자동 수집.
   - 배너 헤더: "↻ 지난 주 미해결 · 이번 주 계속 ({n}건)"
   - 각 항목 옆에 [이번 주로 가져오기] 버튼 → 클릭 시 현재 주차로 새 항목 생성 + 원본 carryToNext=false 처리.
6. **빈 상태**: "이번 주(YYYY-Www) 안건이 없습니다. 위 입력란에 추가하세요."

## 주차 변경 시
주차 필터 셀렉트 변경 → 즉시 재렌더.
```

---

## STEP 6 — 부가 기능 (자동 집계 + 백업/복원)

```
다음 부가 기능을 추가해줘.

## 자동 집계
1. **KPI 카드**:
   - 이번 주 회의: 현재 주차에 해당하는 회의록 수.
   - 진행 프로젝트: 회의록의 project_tag 유니크 카운트.
   - 액션 완료율: 모든 회의록의 - [x] / 전체 액션 비율 (%).
   - 미결 액션: 전체 - 완료.
2. **D-day 카드 strip**: 회의록 액션의 마감일을 모아 가까운 6건 표시. D-day < 0 빨강, 0 주황, 1~3 노랑, 그 외 회색.
3. **파트별 과업 그리드**: 부서별로 카드 — 그 부서 회의록 수 + 액션 수 + 미결 수.
4. **칸반 (프로젝트 라이프사이클)**: 8단계 컬럼 × 프로젝트 카드. 클릭 시 그 프로젝트로 필터.

## 다크모드
- 우상단 🌙/☀️ 토글. localStorage에 저장.
- 다크 토큰: bg #0B0F19, elev #111827, card #1F2937, text #E5E7EB, accent #60A5FA, primary #0E1521.

## Export / Import
- ↓ Export: 전체 localStorage(rows + live-issues + weekly-agendas)를 JSON 한 파일로 다운로드. 파일명: `meeting-dashboard-backup-YYYYMMDD.json`.
- ↑ Import: JSON 파일 업로드 → 기존 데이터에 덮어쓰기 or 병합 선택 confirm.

## 검색 (Topbar input)
회의록의 title + attendees + agenda_md + decisions_md + actions_md + note_md 통합 키워드 매칭. debounce 180ms.

## 시트 열기 버튼
지금은 비활성 placeholder. 클릭 시 토스트로 "구글시트 연결 기능은 추후 추가 예정 - 현재는 로컬 저장만" 안내.

## 모바일 반응형
< 960px: 2-pane → 단일 칼럼, 회의록 선택 시 상세로 전환, 좌상단 [← 목록] 버튼으로 복귀.

## 접근성
- 모든 input에 label
- 모달은 Esc로 닫기
- 다크모드 토글에 aria-label
```

---

## STEP 7 — 검수 체크리스트

대표님이 빌드 완료 후 아래 항목을 직접 클릭/확인:

| # | 항목 | 통과 기준 |
|---|---|---|
| 1 | + 회의록 작성 클릭 | 모달 열림, 기본 부서 '신사업 기획팀' |
| 2 | 참석자 picker | 19명 중복 없이 부서별 그룹 |
| 3 | 부서를 'MICE 기획팀'으로 변경 | 프로젝트 옵션이 11개로 재계산 |
| 4 | 회의록 1건 저장 | 리스트·KPI 즉시 반영 |
| 5 | 같은 부서로 2번째 작성 시작 | 캐리오버 배너 표시 |
| 6 | "불러오기" 클릭 | 안건·참석자 채워지고 미완료 액션만 표시 |
| 7 | 주요 안건 1건 추가 → 차주 이월 체크 | localStorage 저장 |
| 8 | 주차 셀렉트 변경 | "지난 주 미해결" 배너에 그 항목 노출 |
| 9 | "이번 주로 가져오기" 클릭 | 안건 복제, 원본 이월 해제 |
| 10 | ↓ Export → ↑ Import | JSON 백업/복원 정상 |
| 11 | 🌙 토글 | 다크모드 전환, 새로고침해도 유지 |
| 12 | 모바일 뷰 (DevTools 360px) | 단일 칼럼, [← 목록] 동작 |

---

## 추가 메모

### Lovable이 잘 못 만들 가능성 있는 부분
- **계층(트리) 입력**: 안건/결정의 부모-자식 구조. 한 번에 안 되면 "안건 항목에 [+ 하위 항목] 버튼을 추가해줘, 부모 항목 안에 자식 항목 배열로 저장" 식으로 후속 지시.
- **이전 주 캐리오버 로직**: 부서·날짜 매칭. 잘못 만들면 "STEP 4의 검색 조건을 정확히: `row.department === 입력부서 AND parseDate(row.meeting_date) < parseDate(입력일자)`, 가장 최근 1건" 같이 정확히 지정.
- **ISO 주차 계산**: `Math.floor` 잘못 쓰면 1주 어긋남. "ISO 8601 주차 (월요일 시작, 1월 4일 포함 주 = W01)" 명시.

### GitHub 연동 후 (대표님 → 기획자님)
- Lovable이 만든 repo URL을 기획자님께 공유 → 기획자님이 받으셔서 Vercel 새 프로젝트로 연결.
- 또는 Lovable이 자체 Preview URL을 줌. 그걸로 충분하면 Vercel 연결 생략 가능.

### 추가 기능 요청 시 (대표님 → Lovable)
> "회의록 카드에 우측 상단에 ☆ 즐겨찾기 버튼 추가해줘. 즐겨찾기 한 회의록은 리스트 상단에 고정."

이런 식으로 자연어 한 줄로 지시하면 Lovable이 컴포넌트 단위로 수정합니다.

---

**마지막**: 이 명세를 그대로 따르면 Lovable에서 한 번에 완벽한 결과가 나오지 않을 수 있습니다. 각 STEP 결과를 확인하고 어긋난 부분을 자연어로 보완 지시하는 게 정상입니다. "검수 체크리스트(STEP 7)의 항목 N번이 동작 안 한다, 고쳐줘"가 가장 강력한 보완 프롬프트입니다.
