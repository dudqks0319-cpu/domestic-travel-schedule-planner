# TripMate Web Design Workspace

웹 UI 디자인 실험/시안 구현용 워크스페이스입니다.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- shadcn/ui
- DTCG JSON Tokens + Style Dictionary
- HyperUI 스타일 패턴(스니펫 기반)

## Quick Start

```bash
cd apps/web-design
npm install
npm run tokens:build
npm run dev
```

## Token Pipeline

디자인 토큰 원본:
- `design-tokens/tokens.json`

토큰 빌드:
```bash
npm run tokens:build
```

생성 파일:
- `src/styles/tokens.css`
- `src/styles/tokens.js`

감시 모드:
```bash
npm run tokens:watch
```

## shadcn/ui 컴포넌트 추가

```bash
cd apps/web-design
npx shadcn@latest add button card badge tabs avatar input separator
```

필요 시 원하는 컴포넌트를 추가로 더 붙이면 됩니다.
