# 운동방 상세 및 기록 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운동방별·로컬 날짜별 운동 종목, 사용자 세트, 참여 상태를 기록하고 새로고침 후에도 브라우저에 보존하는 상세 프로토타입을 구현합니다.

**Architecture:** React 화면은 선택된 방·날짜를 기준으로 모달과 기록 카드를 표시하고, 도메인 로직은 순수 함수 모듈에 둡니다. 데이터는 로컬 날짜 문자열과 고유 ID를 가진 정규화된 임시 레코드로 관리하며 `localStorage`에 보존합니다. 인증·다중 사용자 동기화 없이 개발용 사용자 전환으로 읽기/쓰기 범위를 검증합니다.

**Tech Stack:** React 19, JavaScript ES modules, Node.js `node:test`, localStorage; 새 런타임 의존성 없음.

**Spec:** 사용자가 제공한 「득근이 MVP — 3차 개발: 운동방 상세 화면 및 운동 기록 기능」 요구사항.

## Global Constraints

- 기존 React + Vite 구조와 따뜻한 아이보리·파스텔·코랄 디자인 유지.
- Supabase, 로그인, 실제 다중 사용자 동기화 및 별도 라우팅 라이브러리 추가 금지.
- 운동 데이터는 날짜별·방별·사용자별로 분리하고 localStorage는 테스트용 임시 저장임을 표시.
- 날짜는 로컬 기준 `YYYY-MM-DD`; 날짜 이동은 UTC 파싱으로 날짜를 밀지 않음.
- set 편집/삭제는 현재 개발 사용자 본인의 기록에만 허용하고, 운동 종목 삭제는 기록 전체를 확인받은 뒤 연쇄 삭제.
- Git commit 및 push 금지.

## Review Focus

- 자정 전후에도 오늘 날짜 생성·하루 이동이 로컬 달력 날짜를 유지하는지 — 날짜 유틸리티 테스트.
- 같은 종목을 방/날짜가 다를 때는 추가 가능하고 같은 키에선 거절되는지 — 등록/중복 테스트.
- 종목 삭제가 그 종목의 모든 사용자 세트만 제거하고 참여 상태와 다른 날짜의 기록은 보존하는지 — cascade 범위 테스트.
- 미참여 사용자가 세트를 추가할 때 본인만 자동 참여로 바뀌는지 — attendance 연동 테스트.
- 무효 수치 및 다른 사용자의 세트 변형 요청이 상태를 바꾸지 않는지 — 검증·권한 테스트.

---

### Task 1: 날짜·운동 데이터 도메인과 테스트

**Files:**
- Create: `src/features/workouts/workoutData.js`
- Create: `src/features/workouts/workoutData.test.js`
- Modify: `src/data/rooms.js` — 참여자에게 stable ID 부여
- Modify: `src/utils/memberSummary.js` — 기존 문자열과 `{id,name}` 둘 다 표시 지원

**Interfaces:**
- Produces: `getLocalDateKey(date)`, `shiftDateKey(dateKey, days)`, `createInitialWorkoutState()`, `addExercise(state, roomId, dateKey, exerciseId)`, `removeExercise(state, entryId)`, `setAttendance(state, roomId, dateKey, userId, status)`, `addSet(state, entryId, userId, currentUserId, input)`, `updateSet(...)`, `removeSet(...)`.
- 상태는 `{ exercises: [], sets: [], attendance: [] }`; entry는 `{ id, roomId, date, exerciseId }`; set은 `{ id, entryId, userId, order, weight, reps }`; 참여는 `{ id, roomId, date, userId, status }`.

- [ ] **Step 1: 로컬 날짜, 중복, 연쇄 삭제, 참여·세트 권한/검증 테스트 작성**
  - Node 내장 `node:test` 사용, 외부 테스트 라이브러리 설치 금지.
  - 같은 방·같은 날짜 중복만 거절하고 다른 방/날짜 조합은 허용.
  - 삭제는 해당 entry 세트만 제거하며 attendance와 다른 날짜 entry는 유지.
  - 세트 추가는 kg ≥ 0 숫자 및 reps ≥ 1 정수만 허용하며 현재 사용자 본인만 변경.
  - 세트 순번은 같은 사용자·entry 내에서 연속 부여, 삭제 후에도 연속성 보장.
  - 참여 전환과 미참여 후 세트 추가 자동 참여를 검증.
- [ ] **Step 2: `node --test src/features/workouts/workoutData.test.js`로 실패 확인**
- [ ] **Step 3: 로컬 날짜 키와 불변 상태 변환 함수를 구현**
- [ ] **Step 4: 위 테스트를 재실행해 모두 통과 확인**

### Task 2: 저장소 hook과 운동방 상세 기본 흐름

**Files:**
- Create: `src/features/workouts/useWorkoutStore.js`
- Create: `src/features/workouts/workoutStorage.js`
- Create: `src/features/workouts/workoutStorage.test.js`
- Create: `src/features/workouts/WorkoutRoomPage.jsx`
- Modify: `src/pages/Pages.jsx` — 기존 `RoomDetailPage`와 교체
- Modify: `src/App.jsx` — 선택된 방 상세에 현재 사용자·저장소 연결

**Interfaces:**
- `useWorkoutStore()`는 state와 Task 1 mutation 함수들의 callback을 제공하고 localStorage 읽기/쓰기를 수행.
- `WorkoutRoomPage({ room, onBack, state, currentUserId, onUserChange, actions })`.
- 임시 사용자 선택은 해당 방 참여자만 선택 가능하도록 구현.

- [ ] **Step 1: 저장소 초기화/복원 및 독립된 날짜 키 동작 테스트 작성** (`loadWorkoutState`, `saveWorkoutState`)
- [ ] **Step 2: 해당 테스트 실패 확인**
- [ ] **Step 3: 안전한 JSON 복원과 localStorage 저장 hook 구현**
- [ ] **Step 4: 상세 헤더, 로컬 날짜 좌우 이동, 터치 스와이프, 참여 토글 구현**
- [ ] **Step 5: 날짜별 목록/빈 화면과 유지된 기존 목록 복귀 동작 검증**

### Task 3: 운동 선택·삭제 및 개인별 세트 UI

**Files:**
- Create: `src/features/workouts/exerciseCatalog.js`
- Modify: `src/features/workouts/WorkoutRoomPage.jsx`
- Modify: `src/App.css` — 운동 선택 바텀시트, 날짜/기록/확인 대화상자

**Interfaces:**
- catalog는 `id`, `category`, `name`을 가진 운동 마스터 목록 제공.
- 선택한 운동 entry마다 모든 방 참여자를 표시하고, 현재 사용자만 세트 입력·수정·삭제 버튼을 사용 가능.

- [ ] **Step 1: 운동 카탈로그의 부위별 종목과 중복 선택 동작 테스트 작성**
- [ ] **Step 2: 부위 선택, 운동 선택, 중복 안내가 실패하는지 확인**
- [ ] **Step 3: 모바일 바텀시트, 기록 카드, 본인 세트 폼과 수정/삭제 UI 구현**
- [ ] **Step 4: 확인창에서 타 참여자 세트도 삭제됨을 명시하고 취소/확인 동작 구현**
- [ ] **Step 5: 숫자 검증·저장 안내·미참여 후 자동 참여 상태 UI 검증**

### Task 4: 전체 검증

**Files:** 변경 파일 전체.

- [ ] **Step 1: `node --test src/features/workouts/*.test.js` 실행**
- [ ] **Step 2: `npm run lint` 실행**
- [ ] **Step 3: `npm run build` 실행**
- [ ] **Step 4: 실행 중인 앱을 모바일 브라우저에서 방 이동, 날짜 스와이프, 운동 CRUD, 세트 CRUD, 참여 전환, 저장 복원까지 확인**
- [ ] **Step 5: `git diff --check` 및 `git status` 확인; 커밋·푸시는 하지 않음**
