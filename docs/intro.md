---
sidebar_position: 1
slug: /intro
---

# AutoGen Guide

Microsoft AutoGen은 **다중 에이전트 대화 시스템**을 구축하기 위한 오픈소스 프레임워크입니다. 이 가이드는 AutoGen을 사용하여 프로덕션 레벨의 AI 애플리케이션을 구축하는 방법을 상세히 다룹니다.

## AutoGen이란?

AutoGen은 다음과 같은 핵심 기능을 제공합니다:

- **다중 에이전트 오케스트레이션**: 여러 AI 에이전트가 협력하여 복잡한 작업을 수행
- **대화 기반 워크플로우**: 에이전트 간 구조화된 대화를 통한 작업 처리
- **유연한 에이전트 타입**: AssistantAgent, UserProxyAgent, GroupChat 등 다양한 에이전트
- **코드 실행 지원**: 안전한 환경에서 코드 생성 및 실행
- **Human-in-the-Loop**: 필요시 사람의 개입을 허용하는 워크플로우

## 왜 AutoGen인가?

### 1. 복잡한 작업의 분해

단일 LLM 호출로는 해결하기 어려운 복잡한 작업을 여러 전문화된 에이전트가 협력하여 해결합니다.

```python
# 예: 코드 작성 + 리뷰 + 테스트를 각 에이전트가 담당
developer = AssistantAgent("developer", ...)
reviewer = AssistantAgent("reviewer", ...)
tester = AssistantAgent("tester", ...)
```

### 2. 반복적 개선

에이전트 간 대화를 통해 결과물을 반복적으로 개선할 수 있습니다.

### 3. 확장성

새로운 에이전트와 기능을 쉽게 추가할 수 있는 모듈식 아키텍처를 제공합니다.

## 설치

```bash
pip install pyautogen
```

## 빠른 시작

가장 간단한 2-에이전트 대화 예제:

```python
from autogen import AssistantAgent, UserProxyAgent

# LLM 설정
config_list = [{
    "model": "gpt-4",
    "api_key": "your-api-key"
}]

# 어시스턴트 에이전트 생성
assistant = AssistantAgent(
    name="assistant",
    llm_config={"config_list": config_list}
)

# 사용자 프록시 에이전트 생성
user_proxy = UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER",
    code_execution_config={"work_dir": "workspace"}
)

# 대화 시작
user_proxy.initiate_chat(
    assistant,
    message="피보나치 수열의 10번째 숫자를 계산하는 Python 함수를 작성해주세요."
)
```

## 가이드 구성

이 가이드는 다음과 같은 섹션으로 구성되어 있습니다:

### Core Concepts
- [에이전트 타입](/docs/core-concepts/agent-types) - 다양한 에이전트의 역할과 사용법
- [대화 패턴](/docs/core-concepts/conversation-patterns) - 에이전트 간 대화 구조
- [LLM 설정](/docs/core-concepts/llm-configuration) - 다양한 LLM 공급자 연동
- [코드 실행](/docs/core-concepts/code-execution) - 안전한 코드 실행 환경

### Production Patterns
- [에러 핸들링](/docs/production-patterns/error-handling) - 프로덕션 환경의 에러 처리
- [비용 관리](/docs/production-patterns/cost-management) - API 비용 최적화
- [로깅과 모니터링](/docs/production-patterns/logging-monitoring) - 운영 가시성 확보
- [확장성](/docs/production-patterns/scalability) - 대규모 트래픽 처리

### Real-World Examples
- [고객 서비스 자동화](/docs/real-world-examples/customer-service) - 지능형 고객 지원 시스템
- [데이터 분석 파이프라인](/docs/real-world-examples/data-analysis) - 자동화된 데이터 분석
- [소프트웨어 개발 워크플로우](/docs/real-world-examples/software-development) - AI 지원 개발 프로세스
- [문서 처리 시스템](/docs/real-world-examples/document-processing) - 지능형 문서 분석

## 커뮤니티

- [Microsoft AutoGen GitHub](https://github.com/microsoft/autogen)
- [Discord 커뮤니티](https://discord.gg/pAbnFJrkgZ)
- [공식 문서](https://microsoft.github.io/autogen/)
