# AutoGen Guide

Microsoft AutoGen 프레임워크를 활용한 프로덕션 레벨 멀티 에이전트 AI 시스템 구축 가이드입니다.

## 사이트 URL

- **문서 사이트**: https://mypalesong.github.io/autogen/

## 브랜치 구조

- `guide` (또는 `claude/autogen-docs-setup-thKTT`): 소스 코드 브랜치
- `guide-pages`: 빌드된 정적 파일 브랜치 (GitHub Pages 배포용)

## 로컬 개발

### 설치

```bash
npm install
```

### 개발 서버 시작

```bash
npm start
```

로컬 개발 서버가 http://localhost:3000/autogen/ 에서 시작됩니다.

### 빌드

```bash
npm run build
```

`build` 디렉토리에 정적 파일이 생성됩니다.

### 빌드 결과 미리보기

```bash
npm run serve
```

## 배포

GitHub Actions를 통해 자동으로 배포됩니다:

1. `guide` 브랜치에 push
2. GitHub Actions가 자동으로 빌드
3. `guide-pages` 브랜치에 빌드 결과 배포
4. GitHub Pages에서 `guide-pages` 브랜치의 root 디렉토리 서빙

### GitHub Pages 설정

Repository Settings > Pages에서:
- Source: `Deploy from a branch`
- Branch: `guide-pages` / `/ (root)`

## 문서 구조

```
docs/
├── intro.md                    # 소개
├── core-concepts/              # 핵심 개념
│   ├── agent-types.md          # 에이전트 타입
│   ├── conversation-patterns.md # 대화 패턴
│   ├── llm-configuration.md    # LLM 설정
│   └── code-execution.md       # 코드 실행
├── production-patterns/        # 프로덕션 패턴
│   ├── error-handling.md       # 에러 핸들링
│   ├── cost-management.md      # 비용 관리
│   ├── logging-monitoring.md   # 로깅 & 모니터링
│   └── scalability.md          # 확장성
└── real-world-examples/        # 실전 예제
    ├── customer-service.md     # 고객 서비스
    ├── data-analysis.md        # 데이터 분석
    ├── software-development.md # 소프트웨어 개발
    └── document-processing.md  # 문서 처리
```

## 기술 스택

- [Docusaurus 3](https://docusaurus.io/) - 정적 사이트 생성기
- TypeScript
- React

## 라이선스

MIT License
