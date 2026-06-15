# Lineup Lens (Vercel Web App - Free OCR Edition)

페스티벌 라인업 이미지를 업로드하면 **브라우저에서 무료 OCR(Tesseract.js)** 로 텍스트를 읽고,
DJ 이름 후보를 정리한 뒤 YouTube 추천 링크와 장르 태그를 보여주는 Next.js 웹앱입니다.

## 핵심 변경점
- **OpenAI OCR 제거**
- **Tesseract.js 무료 OCR 사용**
- OCR은 **브라우저 안에서 실행**되므로 OpenAI 크레딧이 필요 없습니다.
- YouTube API 키가 있으면 실제 추천 영상 2개를 찾고,
  키가 없으면 유튜브 검색 링크로 대체합니다.

## 기능
- 이미지 업로드
- 무료 OCR 실행
- DJ 이름 후보 추출
- 수동 DJ 이름 입력 보강
- 결과 카드 표시
- Save 기능(localStorage)
- Demo lineup 버튼

## 기술 스택
- Next.js App Router
- TypeScript
- Vercel 배포 가능
- Tesseract.js (무료 OCR)
- 선택적 YouTube Data API
- 선택적 Last.fm API

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

브라우저에서 `http://localhost:3000` 열기.

## 환경변수
루트에 `.env.local` 파일을 만들고 필요하면 아래처럼 넣습니다.

```env
USE_MOCKS=false
YOUTUBE_API_KEY=
LASTFM_API_KEY=
```

### 설명
- `USE_MOCKS=false` → 실제 OCR/분석 흐름 사용
- `USE_MOCKS=true` → 항상 데모 결과 사용
- `YOUTUBE_API_KEY` → 있으면 실제 추천 영상 검색
- `LASTFM_API_KEY` → 있으면 장르/설명 강화

## Vercel 배포
1. 이 프로젝트를 GitHub에 업로드
2. Vercel에서 Import Project
3. Build settings는 기본값 사용
4. 필요하면 Environment Variables에 아래 추가

```env
USE_MOCKS=false
YOUTUBE_API_KEY=...
LASTFM_API_KEY=...
```

5. Deploy

## 사용 방법
1. `라인업 스크린샷 선택`
2. `Analyze lineup`
3. 브라우저에서 무료 OCR이 실행됨
4. OCR 결과를 바탕으로 DJ 카드 생성
5. OCR이 불완전하면 아래 텍스트 박스에 DJ 이름을 직접 붙여넣어 보완

## 정확도 관련
무료 OCR은 OpenAI Vision보다 정확도가 낮을 수 있습니다.
특히 아래 경우에 오차가 생길 수 있습니다.
- 글자가 너무 작음
- 배경이 화려함
- 줄 배치가 복잡함
- 폰트가 장식적임

그래서 이 프로젝트는 아래 전략을 사용합니다.
- OCR 텍스트에서 DJ 이름처럼 보이는 후보만 추림
- 중복 제거
- 수동 입력으로 보정 가능
- YouTube / SoundCloud / Spotify 링크로 바로 들어보기 가능

## 추천 운영 방식
- 먼저 무료 OCR로 테스트
- YouTube API는 나중에 붙여도 됨
- Last.fm은 장르 보강용이라 선택사항

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
    demoData.ts
    lastfm.ts
    ocrTextParser.ts
    types.ts
    youtube.ts
```

## 주의
- YouTube API 키는 코드에 직접 넣지 말고 Vercel Environment Variables에 넣기
- `.env.local` 파일은 GitHub에 올리지 않기
- OCR은 브라우저에서 돌아가므로 첫 실행 시 몇 초 걸릴 수 있음
