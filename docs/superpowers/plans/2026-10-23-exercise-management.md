# 운동 종목 관리 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다중 부위 운동 카탈로그와 기록 방식, 카테고리별 최근 운동 및 방 범위 직접 운동을 기존 기록 호환성 아래 제공한다.

**Architecture:** 마스터 카탈로그 선택·정렬 함수와 운동 저장 상태 v2를 분리한다. v1은 검증 후에만 v2로 메모리 변환하고 저장 훅은 변환/검증 오류 때 기존 localStorage를 쓰지 않는다. 상세 화면은 새 선택·등록 UI와 기록 방식별 세트 입력을 기존 컴포넌트에 연결한다.

**Tech Stack:** React 19, JavaScript, Vite, Node 내장 테스트, localStorage

**Spec:** `docs/superpowers/specs/2026-10-23-exercise-management-design.md`

## Global Constraints
- 기존 21개 운동 ID와 유효한 v1 세트 기록을 보존한다.
- v1 변환 또는 저장 데이터 검증 실패 시 기존 localStorage를 초기화·삭제·덮어쓰지 않는다.
- 최근 운동은 현재 사용자, 현재 선택 카테고리, 실제 수행 날짜 우선·동일 날짜 기록 순서 기준으로 최대 3개다.
- 사용자 운동은 현재 방 범위이며 같은 방에서 이름 중복을 막는다.
- Supabase·로그인·초대·실시간 동기화·통계는 추가하지 않는다.
- Git commit, push, merge를 실행하지 않는다.

## Review Focus
- 유효한 v1 세트가 v2로 바뀐 뒤 무게·횟수 값과 ID가 그대로 남는다.
- 손상된 저장 데이터는 기존 raw localStorage를 그대로 보존하고 보호 오류를 반환한다.
- 다중 부위 운동은 해당하는 모든 카테고리에서 한 번씩만 보인다.
- 과거 날짜에 나중에 기록한 세트는 더 최신 수행 날짜 운동보다 최근 목록에서 앞서지 않는다.
- 같은 방의 직접 운동만 선택되고, 다른 방 운동·기록은 섞이지 않는다.

---

### Task 1: 확장 카탈로그와 선택 정렬

**Files:**
- Modify: `src/features/workouts/exerciseCatalog.js`
- Modify: `src/features/workouts/exerciseCatalog.test.js`
- Create: `src/features/workouts/exerciseSelection.js`
- Create: `src/features/workouts/exerciseSelection.test.js`

**Interfaces:**
- Produces: `exerciseCategories`, `exercises`, `getExercisesForPicker({ exercises, customExercises, roomId, category, query, state, currentUserId })`.

- [ ] Write failing tests for stable legacy IDs, 70–100 catalog size, multi-category filtering, search, category-scoped recent three, and date/order sorting.
- [ ] Run focused tests to verify missing selector failure.
- [ ] Implement master catalog and pure picker ordering helpers.
- [ ] Run catalog/selector tests and verify pass.

### Task 2: v1→v2 storage migration and direct exercise domain

**Files:**
- Modify: `src/features/workouts/workoutData.js`
- Modify: `src/features/workouts/workoutStorage.js`
- Modify: `src/features/workouts/useWorkoutStore.js`
- Modify: `src/features/workouts/workoutData.test.js`
- Modify: `src/features/workouts/workoutStorage.test.js`

**Interfaces:**
- Produces: v2 workout state, `addCustomExercise`, recording-method-aware `addSet`/`updateSet`, protected load result `{state, error, migrated}`.

- [ ] Write failing tests for exact v1 migration, migration error raw-storage protection, room-scoped custom exercise duplicate checks, method validation, and room deletion cascade.
- [ ] Run focused tests and verify failures identify absent v2 behavior.
- [ ] Implement v2 parser/migrator, storage write protection, custom exercise CRUD, and method-aware set logic.
- [ ] Run data/storage tests and verify pass.

### Task 3: picker, direct registration, and set-entry UI

**Files:**
- Modify: `src/features/workouts/WorkoutRoomPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: picker selector and v2 store actions.
- Produces: searchable category picker, direct registration form, method-specific display/input/edit, storage protection notice.

- [ ] Render multi-category chips, recent section, sorted result section, no-result direct registration action, and selected room’s custom exercises.
- [ ] Render and validate the four record input modes while keeping legacy weight-reps output editable.
- [ ] Pass storage protection error from hook to the page and disable write actions while the old raw storage is protected.
- [ ] Run lint/build and verify pass.

### Task 4: integration verification

- [ ] Browser-test category filtering/search, chest/back different recent lists, a multi-category exercise, direct exercise room isolation, all record modes, legacy v1 migration, and protected malformed storage.
- [ ] Run `node --test src/features/workouts/*.test.js src/features/rooms/*.test.js src/utils/*.test.js`, `npm run lint`, `npm run build`, and `git diff --check`.
