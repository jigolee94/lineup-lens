# Lineup Lens - Vercel Web App

페스티벌 라인업/타임테이블 스크린샷을 올리면 OCR로 DJ 이름을 뽑고, DJ 카드와 추천 YouTube 링크를 보여주는 웹앱 MVP입니다.

현재 버전은 **Vercel에 바로 배포 가능한 Next.js 단일 프로젝트**입니다.

> 기본값은 demo/mock mode입니다. `USE_MOCKS=false`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`를 Vercel 환경변수에 넣으면 실제 OCR + YouTube 검색 흐름으로 작동합니다.

---

## 1. 포함된 기능

- 모바일 웹에 맞는 Lineup Lens UI
- 라인업 스크린샷 업로드 화면
- OpenAI Vision 기반 OCR / 아티스트 이름 추출
- `Use Demo Lineup` 버튼
- DJ 이름 직접 입력 fallback
- DJ 카드 목록
- DJ별 장르 태그
- DJ별 설명
- YouTube 추천 2개
- YouTube / SoundCloud / Spotify 검색 링크
- 브라우저 localStorage 기반 저장 기능
- Vercel 서버리스 API 라우트
- API 키가 없어도 mock mode로 작동

---

## 2. 폴더 구조

```txt
lineup-lens-vercel/
  src/
    app/
      page.tsx                      # 메인 웹앱 화면
      layout.tsx                    # 앱 레이아웃
      globals.css                   # 전체 스타일
      api/
        analyze-lineup/route.ts     # 라인업 분석 API
        health/route.ts             # 상태 확인 API
    components/
      DjCard.tsx                    # DJ 카드 컴포넌트
    lib/
      types.ts                      # 공통 타입
      demoData.ts                   # mock DJ 데이터
      artistUtils.ts                # 이름 정리/중복 제거
      openaiVision.ts               # OpenAI Vision OCR provider
      youtube.ts                    # YouTube API provider
      lastfm.ts                     # Last.fm provider
  public/
    icon.svg
  .env.example
  .gitignore
  next.config.mjs
  package.json
  tsconfig.json
  vercel.json
```

---

## 3. 로컬에서 실행하기

### 3-1. 압축 풀기

```bash
unzip lineup-lens-vercel-ocr.zip
cd lineup-lens-vercel
```

### 3-2. 패키지 설치

```bash
npm install
```

### 3-3. 환경변수 파일 만들기

```bash
cp .env.example .env.local
```

처음에는 그대로 둬도 됩니다.

```env
USE_MOCKS=true
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.5
YOUTUBE_API_KEY=
LASTFM_API_KEY=
```

### 3-4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```txt
http://localhost:3000
```

---

## 4. GitHub에 올리기

1. GitHub에서 새 repository를 만듭니다.
2. 이 폴더 전체를 repository에 업로드합니다.
3. `.env.local` 파일은 절대 올리지 마세요.
4. GitHub에 올라가면 Vercel에서 이 repository를 Import 하면 됩니다.

---

## 5. Vercel 배포 방법

1. Vercel 로그인
2. `Add New Project`
3. GitHub repository 선택
4. Framework Preset이 `Next.js`인지 확인
5. Build Command는 기본값 그대로 사용
6. Output Directory도 기본값 그대로 사용
7. `Deploy` 클릭

기본 mock mode는 환경변수 없이도 작동합니다.

---

## 6. OCR 기능 켜기

OCR 기능은 OpenAI API 키가 필요합니다.

### 로컬 개발

`.env.local` 파일에 넣습니다.

```env
USE_MOCKS=false
OPENAI_API_KEY=여기에_OpenAI_API키
OPENAI_VISION_MODEL=gpt-5.5
YOUTUBE_API_KEY=
LASTFM_API_KEY=
```

그다음 개발 서버를 다시 켭니다.

```bash
npm run dev
```

### Vercel 배포 환경

Vercel 프로젝트에서:

```txt
Settings
→ Environment Variables
→ Add New
```

아래처럼 추가합니다.

```txt
USE_MOCKS=false
OPENAI_API_KEY=여기에_OpenAI_API키
OPENAI_VISION_MODEL=gpt-5.5
```

저장 후 다시 Deploy 해야 반영됩니다.

### OCR 작동 방식

1. 사용자가 라인업 이미지를 업로드합니다.
2. `/api/analyze-lineup` 서버 route가 이미지를 받습니다.
3. 서버가 이미지를 base64 data URL로 바꿉니다.
4. OpenAI Vision 모델에 “DJ/아티스트 이름만 JSON으로 뽑아줘”라고 요청합니다.
5. 결과 JSON을 파싱해서 DJ 카드로 만듭니다.

이미지 파일은 8MB 이하만 받도록 제한했습니다.

---

## 7. YouTube API 연결하기

YouTube API 키를 만들었다면 두 곳 중 하나에 넣으면 됩니다.

### 로컬 개발

`.env.local` 파일에 넣습니다.

```env
USE_MOCKS=false
OPENAI_API_KEY=여기에_OpenAI_API키
YOUTUBE_API_KEY=여기에_유튜브_API키
LASTFM_API_KEY=
```

그다음 개발 서버를 다시 켭니다.

```bash
npm run dev
```

### Vercel 배포 환경

Vercel 프로젝트에서:

```txt
Settings
→ Environment Variables
→ Add New
```

아래처럼 추가합니다.

```txt
USE_MOCKS=false
YOUTUBE_API_KEY=여기에_유튜브_API키
```

저장 후 다시 Deploy 해야 반영됩니다.

> 주의: API 키를 소스코드에 직접 넣지 마세요. `.env.local` 또는 Vercel Environment Variables에만 넣으세요.

---

## 8. Last.fm API 연결하기

Last.fm API 키가 있으면 장르 태그 보강에 사용할 수 있습니다.

```env
LASTFM_API_KEY=여기에_Lastfm_API키
```

없어도 앱은 정상 작동합니다.

---

## 9. 현재 한계

- OCR 결과는 이미지 품질에 따라 틀릴 수 있습니다.
- 포스터 디자인이 복잡하거나 폰트가 매우 장식적이면 잘못 뽑을 수 있습니다.
- DJ 이름과 일반 문구를 100% 구분하지 못할 수 있습니다.
- YouTube 검색 결과는 공식 트랙이 아니라 DJ set / live set 위주로 잡힐 수 있습니다.
- 현재 재생은 YouTube 링크 열기 방식입니다.
- 로그인/계정 기능은 없습니다.

---

## 10. API 안전수칙

- `.env.local`은 GitHub에 올리지 마세요.
- API 키는 프론트엔드 코드에 직접 쓰지 마세요.
- 이 프로젝트는 API 키를 서버 route에서만 읽습니다.
- YouTube 영상을 다운로드하거나 오디오만 추출하지 않습니다.
- 채팅방, GitHub issue, README 등에 실제 API 키를 붙여넣지 마세요.
- 키가 노출됐으면 Google Cloud/OpenAI 대시보드에서 삭제하고 새 키를 만드세요.

---

## 11. 확인용 API

배포 후 아래 주소를 열어보면 API 상태를 확인할 수 있습니다.

```txt
https://내-vercel-주소.vercel.app/api/health
```

정상이라면 이런 응답이 나옵니다.

```json
{
  "ok": true,
  "app": "Lineup Lens",
  "mode": "provider",
  "providers": {
    "youtube": true,
    "lastfm": false,
    "openaiVision": true,
    "openaiVisionModel": "gpt-5.5"
  }
}
```

---

## 12. 추천 환경변수 세팅

Vercel에서 최소로 이렇게 넣으면 됩니다.

```txt
USE_MOCKS=false
OPENAI_API_KEY=본인_OpenAI_API키
OPENAI_VISION_MODEL=gpt-5.5
YOUTUBE_API_KEY=본인_YouTube_API키
```

Last.fm은 나중에 넣어도 됩니다.
