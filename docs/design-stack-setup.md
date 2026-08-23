# TripMate Design Stack Setup

이 문서는 현재 프로젝트에 적용한 디자인 스택과 운영 방식을 정리합니다.

## 적용된 구성

### 1) Apple HIG (iOS UX 기준)
- 적용 위치:
  - `apps/mobile/constants/HIG.ts`
  - `apps/mobile/components/common/Button.tsx`
  - `apps/mobile/components/common/Input.tsx`
- 반영 내용:
  - 최소 터치 타깃 `44pt` 기준 반영
  - 공통 코너 반경 토큰화

### 2) shadcn/ui (웹 UI 컴포넌트)
- 적용 위치:
  - `apps/web-design/`
- 초기화 결과:
  - `components.json` 생성
  - `src/components/ui/*` 컴포넌트 생성
  - `src/lib/utils.ts` 생성
- 사용 컴포넌트:
  - `Button`, `Card`, `Badge`, `Tabs`, `Avatar`, `Input`, `Separator`

### 3) HyperUI (Tailwind 스니펫 방식)
- 설치형 패키지가 아니라 **스니펫 참조형**입니다.
- 적용 방식:
  - `apps/web-design/src/App.tsx`에 HyperUI 스타일 패턴(카드/칩/리스트)을 Tailwind 클래스 형태로 반영

### 4) DTCG JSON 토큰 + Style Dictionary
- 토큰 원본:
  - `apps/web-design/design-tokens/tokens.json` (DTCG `$value`, `$type`)
- 빌드 설정:
  - `apps/web-design/style-dictionary.config.json`
- 빌드 산출물:
  - `apps/web-design/src/styles/tokens.css`
  - `apps/web-design/src/styles/tokens.js`

### 5) UI/UX Pro Max 디자인 시스템 산출물
- 적용 위치:
  - `docs/design-system/tripmate/MASTER.md`
- 반영 내용:
  - TripMate 모바일 여행앱 기준 컬러/타이포/패턴/안티패턴 기준점 문서화
  - 화면 구현 전에 우선 참조하는 디자인 source-of-truth

## 실행 명령

### 웹 디자인 워크스페이스
```bash
cd apps/web-design
npm install
npm run tokens:build
npm run dev
```

### 토큰 감시 모드
```bash
cd apps/web-design
npm run tokens:watch
```

## Figma와의 관계

- Figma는 **디자인 원본/협업/핸드오프 도구**입니다.
- shadcn + HyperUI + 토큰은 **코드 구현 도구/방식**입니다.
- 서로 겹치기보다, 일반적으로 다음 순서로 함께 사용합니다:
  1. Figma에서 화면/컴포넌트 설계
  2. 디자인 토큰(DTCG) 정리
  3. 코드에서 shadcn 컴포넌트 + Tailwind(HyperUI 패턴)로 구현
  4. Style Dictionary로 토큰을 CSS/JS로 변환해 일관성 유지

즉, **Figma 설치만으로 자동 구현이 완료되지는 않으며**, 설계-토큰-구현 파이프라인을 연결해야 실제 앱에 반영됩니다.
