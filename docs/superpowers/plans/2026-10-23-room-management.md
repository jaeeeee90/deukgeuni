# 운동방 생성·관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 생성 운동방을 저장·표시·관리하고 기존 운동 기록 화면에 연결한다.

**Architecture:** 정적 예시 방과 분리된 방 저장소를 만들고, App에서 두 목록을 합쳐 기존 상세 컴포넌트에 ID로 전달한다. 방 삭제는 기존 운동 상태의 해당 roomId 항목만 정리하는 순수 함수로 처리한다.

**Tech Stack:** React 19, JavaScript, Vite, Node 내장 테스트, localStorage

**Spec:** `docs/superpowers/specs/2026-10-23-room-management-design.md`

## Global Constraints
- 기존 예시 운동방과 `deukgeuni:workout-demo:v1` 운동 기록을 삭제·초기화하지 않는다.
- 새 방은 방 ID 기준으로 운동 기록을 완전히 분리한다.
- 방 정보와 기록은 새로고침 후에도 localStorage에서 복원한다.
- 기존 아이보리·파스텔·코랄 디자인과 하단 코랄 `+` 버튼을 유지한다.
- Supabase, 로그인, 초대, 실시간 동기화, 통계, 외부 이미지 업로드를 추가하지 않는다.
- Git commit, push, merge를 실행하지 않는다.

## Review Focus
- 공백뿐인 이름과 30자 초과 이름은 방을 만들지 않고 명확한 안내를 보인다.
- 같은 방 이름은 허용하지만 생성 방 ID는 달라야 한다.
- 손상된 사용자 생성 방 저장 데이터는 기존 예시 방·운동 기록을 훼손하지 않는다.
- 삭제한 방의 운동·세트·참여 기록만 사라지고 다른 방 기록은 남는다.
- 생성자가 아닌 개발용 사용자는 방 관리 버튼과 변경 동작을 사용할 수 없다.

---

### Task 1: 사용자 생성 방 도메인·저장소

**Files:**
- Create: `src/features/rooms/roomData.js`
- Create: `src/features/rooms/roomStorage.js`
- Create: `src/features/rooms/roomData.test.js`
- Create: `src/features/rooms/roomStorage.test.js`
- Create: `src/features/rooms/useRoomStore.js`

**Interfaces:**
- Produces: `createRoom`, `updateRoom`, `deleteRoom`, `parseRoomState`, `loadRoomState`, `saveRoomState`, `useRoomStore`.
- Consumes: creator `{ id, name }`; room fields `{ name, description, symbol, color }`.

- [ ] Write failing Node tests for trim/required/max name, duplicate-name distinct IDs, creator membership, creator-only update/delete, and damaged/version-mismatched storage.
- [ ] Run `node --test src/features/rooms/*.test.js` and verify expected missing-module failure.
- [ ] Implement normalized custom-room state and versioned storage adapter with safe fallback.
- [ ] Run `node --test src/features/rooms/*.test.js` and verify all tests pass.

### Task 2: 방 삭제 운동 기록 정리

**Files:**
- Modify: `src/features/workouts/workoutData.js`
- Modify: `src/features/workouts/workoutData.test.js`
- Modify: `src/features/workouts/useWorkoutStore.js`

**Interfaces:**
- Consumes: `removeRoomData(state, roomId)`.
- Produces: `actions.removeRoomData(roomId)`.

- [ ] Write a failing test proving deletion removes only matching room exercises, linked sets, and attendance while preserving another room.
- [ ] Run the focused test and verify missing-function failure.
- [ ] Implement `removeRoomData` and expose it through the existing workout hook.
- [ ] Run workout tests and verify all pass.

### Task 3: 방 만들기·목록 연결·생성자 관리 UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Pages.jsx`
- Modify: `src/features/workouts/WorkoutRoomPage.jsx`
- Modify: `src/data/rooms.js`
- Modify: `src/App.css`
- Create: `src/features/rooms/RoomManageDialog.jsx`

**Interfaces:**
- Consumes: `useRoomStore`, selected room ID, `room.creatorId`, management callbacks.
- Produces: created room route, updated list, owner-only management dialog.

- [ ] Connect custom rooms before static rooms in HomePage and replace the placeholder creation form with validated name/description/icon inputs.
- [ ] Use selected room IDs in App so updates resolve to current room data; open the new room after creation.
- [ ] Add a creator-only management button/dialog that updates metadata or confirms deletion; App invokes `removeRoomData` only after a successful room deletion request.
- [ ] Add responsive CSS using current field, modal, card, and coral button conventions.
- [ ] Run `npm run lint` and `npm run build` and verify both pass.

### Task 4: integration verification

**Files:**
- Modify only when a failing verification reveals a defect.

- [ ] Browser-test creating a room, adding a workout record, creating a second room, refreshing, editing the first room, and deleting it.
- [ ] Confirm the second room and example rooms remain, while only the deleted room’s records disappear.
- [ ] Run `node --test src/features/rooms/*.test.js src/features/workouts/*.test.js src/utils/*.test.js`, `npm run lint`, `npm run build`, and `git diff --check`.
