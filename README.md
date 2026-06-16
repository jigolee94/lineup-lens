# Lineup Lens — Free OCR + DJ Verification Edition

페스티벌 라인업 이미지를 업로드하면 브라우저에서 무료 OCR(Tesseract.js)을 실행하고,
OCR로 나온 텍스트 후보를 음악 데이터베이스에서 검증해서 DJ/아티스트일 가능성이 높은 것만 보여주는 Next.js 웹앱입니다.

## 이번 버전에서 바뀐 점

이전 무료 OCR 버전은 OCR이 읽은 텍스트를 너무 많이 DJ 후보로 보여줄 수 있었습니다.
이번 버전은 아래 흐름으로 바꿨습니다.

```text
이미지 업로드
→ 브라우저에서 무료 OCR 실행
→ OCR 텍스트에서 이름 후보 추출
→ MusicBrainz 무료 음악 DB로 후보 검증
→ Last.fm API 키가 있으면 추가 검증
→ 점수 높은 후보만 Confirmed DJs로 표시
→ 애매한 후보는 Needs Review로 분리
→ 점수 낮은 후보는 자동 제외
```

## 핵심 기능

- OpenAI API 사용 안 함
- OpenAI 결제/크레딧 필요 없음
- Tesseract.js 무료 브라우저 OCR
- MusicBrainz 무료 DB 검증 기본 포함
- Last.fm API 키가 있으면 검증/장르 설명 강화
- YouTube API 키가 있으면 실제 추천 영상 검색
- YouTube API 키가 없으면 일반 YouTube 검색 링크로 대체
- `Confirmed DJs`, `Needs Review`, `자동 제외된 OCR 후보`로 결과 분리
- 수동 입력한 DJ 이름은 확정 후보로 처리
- Save 기능은 브라우저 localStorage 사용

## 실행 방법

```bash
npm install
npm run dev
```

또는

```bash
pnpm install
pnpm dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

## Vercel 배포 방법

1. 이 폴더 내용을 GitHub에 업로드
2. Vercel에서 Import Project
3. 기본 Next.js 설정 그대로 배포
4. Vercel Project → Settings → Environment Variables에서 필요한 값 추가
5. Redeploy

## 환경변수

최소 설정:

```env
USE_MOCKS=false
```

추천 설정:

```env
USE_MOCKS=false
YOUTUBE_API_KEY=선택사항
LASTFM_API_KEY=선택사항
```

설명:

- `USE_MOCKS=false`: 실제 무료 OCR + DB 검증 흐름 사용
- `USE_MOCKS=true`: 데모 데이터만 사용
- `YOUTUBE_API_KEY`: 있으면 DJ별 추천 영상 2개를 실제 YouTube API로 검색
- `LASTFM_API_KEY`: 있으면 후보 검증 점수와 장르/설명 품질이 좋아짐

`OPENAI_API_KEY`는 이제 필요 없습니다.

## 왜 MusicBrainz를 넣었나

무료 OCR은 이미지에서 보이는 글자를 많이 읽습니다. 그래서 `MAIN STAGE`, `TICKETS`, `FRIDAY`, `LOCATION` 같은 텍스트가 DJ 이름처럼 섞일 수 있습니다.

이번 버전은 OCR 후보를 MusicBrainz에서 검색해서 실제 음악 아티스트로 보이는 후보만 통과시킵니다.

점수 기준은 대략 아래와 같습니다.

```text
70점 이상: Confirmed DJs
45~69점: Needs Review
45점 미만: 자동 제외
```

수동 입력한 이름은 사용자가 직접 넣은 것이므로 100점 확정 후보로 처리합니다.

## 결과 화면 설명

### Confirmed DJs

음악 DB 검증 점수가 높은 후보입니다. 보통 여기에 실제 DJ/아티스트가 표시됩니다.

### Needs Review

음악 DB에서 약하게 매칭되었거나 이름 형태는 그럴듯하지만 확신이 낮은 후보입니다. 로컬 DJ나 신인 DJ는 여기로 들어올 수 있습니다.

### 자동 제외된 OCR 후보

OCR이 읽었지만 음악 DB 검증 점수가 낮아서 숨긴 텍스트입니다. 예를 들어 날짜, 장소, 스테이지명, 티켓 문구 등이 여기에 들어갑니다.

## 정확도 팁

무료 OCR 정확도를 높이려면:

- 너무 어두운 스크린샷보다 밝고 선명한 이미지 사용
- 글자가 너무 작은 전체 포스터보다 라인업 부분을 확대해서 캡처
- OCR이 놓친 이름은 직접 입력칸에 붙여넣기
- Last.fm API 키 추가해서 검증 점수 보강

## 폴더 구조

```text
src/
  app/
    api/
      analyze-lineup/route.ts
      health/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    DjCard.tsx
  lib/
    artistUtils.ts
    artistVerification.ts
    demoData.ts
    lastfm.ts
    musicBrainz.ts
    ocrTextParser.ts
    types.ts
    youtube.ts
```

## 주의

- API 키는 코드에 직접 넣지 말고 Vercel Environment Variables에 넣으세요.
- `.env.local` 파일은 GitHub에 올리지 마세요.
- MusicBrainz/Last.fm 검증은 완벽하지 않습니다. 로컬 DJ나 신인 DJ는 누락될 수 있습니다.
- 그래서 `Needs Review`와 수동 입력 기능을 함께 둔 구조입니다.
