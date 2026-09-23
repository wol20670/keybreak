# KEYBREAK — 키보드 파괴왕

> 키보드를 부숴라. 기록을 남겨라.

30초 동안 `A` `S` `D` `F` 를 연타해 보스를 공격하고, DPM(Depressions Per Minute)으로
전체 플레이어와 기록을 겨루는 웹 아케이드 게임. 로그인·회원가입 없이 바로 플레이.

## 기술 스택

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS v4 ·
Neon PostgreSQL (`@neondatabase/serverless`) · Vercel

ORM, 게임 엔진, 전역 상태 관리 라이브러리를 쓰지 않습니다. 런타임 의존성은
`next` / `react` / `react-dom` / `@neondatabase/serverless` 네 개뿐입니다.

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

DATABASE_URL이 없어도 게임은 완전히 동작합니다. 이때 랭킹 API는 503과 함께
"랭킹 서버가 아직 연결되지 않았습니다" 메시지를 반환하고, UI가 이를 그대로 보여줍니다.

## Neon 연결

1. <https://console.neon.tech> 에서 프로젝트 생성
2. **Connect** → **Pooled connection** 문자열 복사
3. 프로젝트 루트 `.env` 에 붙여넣기

   ```
   DATABASE_URL=postgresql://...
   ```

4. Neon SQL Editor에서 [`db/schema.sql`](db/schema.sql) 실행
5. Vercel 프로젝트 환경변수에도 같은 값을 `DATABASE_URL` 로 등록 후 재배포

`DATABASE_URL`은 **서버 전용**입니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/scores` | 상위 20명. `dpm DESC, created_at ASC` |
| `POST` | `/api/scores` | 기록 저장 |

`POST` 본문과 서버 검증:

```json
{ "nickname": "KEYMASTER", "dpm": 520, "totalHits": 260, "maxCombo": 135 }
```

- 닉네임은 공백 제거 후 1~20자
- `totalHits`는 0 이상의 정수이며 900 이하 (초당 30타 상한)
- `maxCombo`는 0 이상이며 `totalHits` 이하
- `dpm`은 반드시 `totalHits * 2`
- 위반 시 `400`, DB 미연결 시 `503`, 테이블 없음 시 `503`

SQL은 전부 태그드 템플릿(파라미터 바인딩)으로 실행합니다. 문자열 연결 쿼리 없음.

클라이언트 점수 위변조를 완벽히 막는 것은 이번 MVP 범위가 아닙니다. 위 검증은
기본적인 입력 sanity check입니다.

## 구조

```
app/
  page.tsx              상태머신 셸 (START → COUNTDOWN → PLAYING → RESULT)
  api/scores/route.ts   랭킹 조회 / 기록 저장
components/             화면 및 게임 요소
hooks/useKeybreakGame.ts  ★ 게임 엔진
lib/game.ts             게임 규칙 상수와 순수 계산 함수 (서버/클라 공용)
lib/db.ts               Neon 지연 초기화
db/schema.sql           scores 테이블
public/assets/          boss · backgrounds · effects · ui · audio
```

## 게임 엔진 메모

핵심은 **키 입력 경로에서 React 상태를 갱신하지 않는 것**입니다.

- `keydown` 핸들러는 ref만 변경합니다. 렌더링은 `requestAnimationFrame` 루프가
  프레임당 한 번 스냅샷을 만들어 단일 `setState`로 처리합니다. 연타가 렌더를
  기다리다 유실되지 않습니다.
- `event.repeat`, ASDF 외 키, 수식키 조합(Ctrl/Meta/Alt), 입력 필드 포커스를
  모두 걸러냅니다. `preventDefault()`는 해당 키가 게임 입력이라고 확정된
  뒤에만 호출하므로 브라우저 단축키를 막지 않습니다.
- 타이머는 `setInterval` 횟수가 아니라 `performance.now()` 실경과 시간 기준입니다.
  백업 `setTimeout`과 `visibilitychange` 체크가 있어 탭을 숨겨도 30초가 늘어나지
  않으며, 종료 처리는 `endedRef` 가드로 단 한 번만 실행됩니다.

### 점수

- 최종 DPM = `총 타격 수 × 2` (30초 기준)
- 진행 중 DPM = `타격 수 / 경과 초 × 60`, 단 첫 1초는 1초로 취급해 초반 과대값 방지

## 에셋 교체

`public/assets/boss/boss-idle.png` 를 교체하면 그대로 반영됩니다.
파일이 없거나 로드에 실패하면 인라인 픽셀아트 보스로 자동 폴백합니다
([components/Boss.tsx](components/Boss.tsx)).
