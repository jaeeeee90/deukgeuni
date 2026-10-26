# 득근이 6-1차 Supabase 인증 기반 구축 구현 계획

> 기존 localStorage 운동방·운동 기록을 유지한 채 Supabase Auth와 profiles만 연결한다.

목표: 이메일 회원가입·로그인·로그아웃, 세션 복원, profiles 자동 생성 SQL/RLS, 설정 오류 안내를 추가한다.

구조: `@supabase/supabase-js` 클라이언트를 환경변수로 만들고, 인증 상태 훅이 기존 앱과 인증 화면을 분기한다. profiles는 `auth.users`를 참조하며 최소 권한의 `SECURITY DEFINER` trigger 함수로 자동 생성한다.

제약:

- `deukgeuni:custom-rooms:v1`과 `deukgeuni:workout-demo:v1`을 삭제·초기화·변환하지 않는다.
- 기존 개발용 `currentUserId` 선택 기능을 유지한다.
- 서비스 키, Secret key, 데이터베이스 비밀번호를 프론트엔드에 사용하지 않는다.
- SQL은 파일만 작성하고 Supabase 데이터베이스에는 실행하지 않는다.
- Git commit, push, merge를 하지 않는다.

구현 순서:

- [ ] `@supabase/supabase-js` 설치와 `.env.example` 작성
- [ ] 설정 누락을 안전하게 판별하는 Supabase 클라이언트 작성
- [ ] profiles 테이블·trigger·RLS SQL 작성
- [ ] Auth 상태 훅 작성: 세션 복원, 상태 변경, 로그아웃
- [ ] 로그인·회원가입 UI와 이메일 확인 안내 작성
- [ ] App 인증 게이트 연결, 기존 앱과 localStorage 보존 확인
- [ ] lint와 build 실행

검증 기준:

- 환경변수가 없으면 안내 화면이 보이고 기존 앱이 예외로 종료되지 않는다.
- 로그인 전에는 AuthPage, 로그인 후에는 기존 앱이 보인다.
- 새로고침 후 세션이 복원된다.
- 로그아웃 후 AuthPage로 돌아간다.
- SQL에는 profiles FK, 자동 생성 trigger, 본인 조회·수정 RLS가 있다.
- 실제 Supabase SQL Editor에는 아무것도 실행하지 않는다.
