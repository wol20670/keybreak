# KEYBREAK — 키보드 파괴왕

> 키보드를 부숴라. 기록을 남겨라.

30초 동안 `A` `S` `D` `F` 를 연타해 보스를 공격하고, DPM(Depressions Per Minute)으로
전체 플레이어와 기록을 겨루는 웹 아케이드 게임. 로그인·회원가입 없이 바로 플레이.

## 기술 스택

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS v4 ·
Firebase Cloud Firestore (`firebase-admin`) · Vercel

ORM, 게임 엔진, 전역 상태 관리 라이브러리를 쓰지 않습니다. 런타임 의존성은
`next` / `react` / `react-dom` / `firebase-admin` 네 개뿐입니다.
Firestore는 **서버(Route Handler)에서만** 접근합니다. Firebase 클라이언트 SDK,
Authentication, Hosting, Functions는 쓰지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

Firebase 자격증명이 없어도 게임은 완전히 동작합니다. 이때 랭킹 API는 503과 함께
"랭킹 서버가 아직 연결되지 않았습니다" 메시지를 반환하고, UI가 이를 그대로 보여줍니다.

## Firebase 연결

1. <https://console.firebase.google.com> 에서 프로젝트 생성
2. **Firestore Database** → **Native 모드**로 데이터베이스 생성
3. **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성**
4. 받은 JSON을 프로젝트 루트에 `firebase-service-account.json` 으로 저장 (gitignore됨)
5. 환경변수 생성 → 연결 확인 → 인덱스 생성:

   ```bash
   npm run env:firebase   # JSON에서 .env의 FIREBASE_* 3개를 생성 (값은 출력하지 않음)
   npm run db:check       # Admin SDK 연결·권한·리전 확인 (읽기 전용)
   npm run db:index       # 복합 인덱스 생성 (권한이 없으면 콘솔 원클릭 링크 안내)
   npm run env:vercel     # Vercel Production에 등록 (값은 stdin으로만 전달)
   ```

`FIREBASE_*` 는 전부 **서버 전용**입니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요.
서비스 계정 JSON과 `.env`는 커밋되지 않습니다.

### 복합 인덱스

랭킹 정렬(`dpm DESC, createdAt ASC`)에는 Firestore 복합 인덱스가 필요합니다.
정의는 [firestore.indexes.json](firestore.indexes.json)에 있습니다.

`npm run db:index`는 서비스 계정에 **Cloud Datastore Index Admin** 역할이 있으면
인덱스를 직접 만들고, 없으면 Firebase 콘솔 원클릭 생성 링크를 출력합니다.

인덱스가 아직 없거나 빌드 중이면 `GET /api/scores`가 `FAILED_PRECONDITION`을 감지해
**단일 정렬 + 서버 정렬 폴백**으로 자동 전환하므로 랭킹은 끊기지 않습니다.
인덱스가 READY가 되면 자동으로 정확한 쿼리로 돌아갑니다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/scores` | 상위 20명. `dpm DESC, createdAt ASC` |
| `POST` | `/api/scores` | 기록 저장 |

`POST` 본문과 서버 검증:

```json
{ "nickname": "KEYMASTER", "dpm": 520, "totalHits": 260, "maxCombo": 135 }
```

- 닉네임은 공백 제거 후 1~20자
- `totalHits`는 0 이상의 정수이며 900 이하 (초당 30타 상한)
- `maxCombo`는 0 이상이며 `totalHits` 이하
- `dpm`은 반드시 `totalHits * 2`
- 위반 시 `400`, 자격증명 미설정 시 `503`, Firestore 접근 불가 시 `503`

`createdAt`은 Firestore `serverTimestamp()`로 기록하고, 응답에서는 항상 **ISO 문자열로
직렬화**합니다. Firestore `Timestamp` 객체가 JSON에 노출되지 않습니다.

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
lib/firebase.ts         Firebase Admin 지연 초기화 + 오류 분류
firestore.indexes.json  복합 인덱스 정의
scripts/                env 주입 · 연결 확인 · 인덱스 생성 · Vercel 등록
public/assets/          boss · backgrounds · effects · ui · audio
```

## Firestore 데이터 구조

컬렉션 `scores`, 문서 ID는 Firestore 자동 생성.

| 필드 | 타입 |
| --- | --- |
| `nickname` | string |
| `dpm` | number |
| `totalHits` | number |
| `maxCombo` | number |
| `createdAt` | server timestamp |

접근은 Admin SDK로만 이루어지므로 보안 규칙은 기본 잠금 상태로 둡니다
(Admin SDK는 규칙을 우회합니다). 클라이언트는 Firestore에 직접 접근하지 않습니다.

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
