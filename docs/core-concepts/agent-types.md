---
sidebar_position: 1
---

# 에이전트 타입

AutoGen은 다양한 유형의 에이전트를 제공하며, 각 에이전트는 특정 역할과 기능을 수행합니다.

## ConversableAgent (기본 클래스)

모든 에이전트의 기본 클래스입니다. 다른 에이전트들은 이 클래스를 상속받아 구현됩니다.

```python
from autogen import ConversableAgent

agent = ConversableAgent(
    name="basic_agent",
    system_message="You are a helpful assistant.",
    llm_config={"config_list": config_list},
    human_input_mode="NEVER"
)
```

### 주요 파라미터

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `name` | 에이전트의 고유 이름 | 필수 |
| `system_message` | 에이전트의 역할 정의 | "You are a helpful AI assistant." |
| `llm_config` | LLM 설정 | None |
| `human_input_mode` | 사람 입력 모드 | "TERMINATE" |
| `max_consecutive_auto_reply` | 자동 응답 최대 횟수 | None |

## AssistantAgent

LLM 기반의 어시스턴트 에이전트입니다. 코드 작성, 질문 응답, 분석 등의 작업을 수행합니다.

```python
from autogen import AssistantAgent

assistant = AssistantAgent(
    name="coding_assistant",
    system_message="""You are a senior Python developer.
    Write clean, efficient, and well-documented code.
    Always include error handling and type hints.""",
    llm_config={
        "config_list": config_list,
        "temperature": 0.7,
        "timeout": 120
    }
)
```

### 커스텀 시스템 메시지 예시

```python
# 데이터 분석 전문가
data_analyst = AssistantAgent(
    name="data_analyst",
    system_message="""You are an expert data analyst.
    - Always use pandas for data manipulation
    - Create visualizations with matplotlib or seaborn
    - Provide statistical insights and summaries
    - Handle missing data appropriately""",
    llm_config=llm_config
)

# 코드 리뷰어
code_reviewer = AssistantAgent(
    name="code_reviewer",
    system_message="""You are a senior code reviewer.
    - Check for security vulnerabilities
    - Ensure code follows best practices
    - Suggest performance optimizations
    - Verify proper error handling""",
    llm_config=llm_config
)
```

## UserProxyAgent

사용자를 대신하여 작업을 수행하는 에이전트입니다. 주로 코드 실행, 사람 입력 처리 등에 사용됩니다.

```python
from autogen import UserProxyAgent

user_proxy = UserProxyAgent(
    name="user_proxy",
    human_input_mode="TERMINATE",  # ALWAYS, TERMINATE, NEVER
    max_consecutive_auto_reply=10,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config={
        "work_dir": "workspace",
        "use_docker": False  # 프로덕션에서는 True 권장
    }
)
```

### human_input_mode 옵션

| 모드 | 설명 | 사용 케이스 |
|------|------|------------|
| `ALWAYS` | 매 턴마다 사람 입력 요청 | 높은 감독이 필요한 경우 |
| `TERMINATE` | 종료 메시지 수신 시 입력 요청 | 일반적인 대화형 사용 |
| `NEVER` | 사람 입력 없이 자동 진행 | 완전 자동화 워크플로우 |

### 코드 실행 설정

```python
# Docker 기반 안전한 코드 실행
code_execution_config = {
    "work_dir": "workspace",
    "use_docker": True,
    "timeout": 60,
    "last_n_messages": 3
}

# 커스텀 Docker 이미지 사용
code_execution_config = {
    "work_dir": "workspace",
    "use_docker": "python:3.11-slim",
    "timeout": 120
}
```

## GroupChatManager

여러 에이전트 간의 그룹 대화를 관리하는 에이전트입니다.

```python
from autogen import GroupChat, GroupChatManager

# 그룹 채팅 설정
groupchat = GroupChat(
    agents=[user_proxy, developer, reviewer, tester],
    messages=[],
    max_round=20,
    speaker_selection_method="auto"  # auto, round_robin, random, manual
)

# 그룹 채팅 매니저 생성
manager = GroupChatManager(
    groupchat=groupchat,
    llm_config=llm_config
)

# 대화 시작
user_proxy.initiate_chat(
    manager,
    message="Create a REST API for user management"
)
```

### speaker_selection_method 옵션

| 메서드 | 설명 |
|--------|------|
| `auto` | LLM이 다음 발화자 자동 선택 |
| `round_robin` | 순서대로 돌아가며 발화 |
| `random` | 무작위 선택 |
| `manual` | 사람이 직접 선택 |

### 커스텀 발화자 선택

```python
def custom_speaker_selection(last_speaker, groupchat):
    """커스텀 발화자 선택 로직"""
    messages = groupchat.messages

    if len(messages) == 0:
        return developer

    last_message = messages[-1]["content"].lower()

    if "review" in last_message:
        return reviewer
    elif "test" in last_message:
        return tester
    else:
        return developer

groupchat = GroupChat(
    agents=[developer, reviewer, tester],
    messages=[],
    max_round=20,
    speaker_selection_method=custom_speaker_selection
)
```

## 커스텀 에이전트 생성

특정 요구사항에 맞는 커스텀 에이전트를 생성할 수 있습니다.

```python
from autogen import ConversableAgent
from typing import Optional, Dict, Any

class DatabaseAgent(ConversableAgent):
    """데이터베이스 작업 전문 에이전트"""

    def __init__(
        self,
        name: str,
        db_connection_string: str,
        **kwargs
    ):
        super().__init__(name=name, **kwargs)
        self.db_connection_string = db_connection_string
        self._setup_database()

    def _setup_database(self):
        """데이터베이스 연결 설정"""
        # 연결 로직 구현
        pass

    def execute_query(self, query: str) -> Dict[str, Any]:
        """SQL 쿼리 실행"""
        # 쿼리 실행 로직
        pass

    def generate_reply(
        self,
        messages: Optional[list] = None,
        sender: Optional[ConversableAgent] = None,
        **kwargs
    ) -> str:
        """커스텀 응답 생성 로직"""
        # 메시지에서 SQL 쿼리 추출
        last_message = messages[-1]["content"] if messages else ""

        if "SELECT" in last_message.upper():
            result = self.execute_query(last_message)
            return f"Query executed. Results: {result}"

        # 기본 LLM 응답
        return super().generate_reply(messages, sender, **kwargs)
```

## 에이전트 간 통신 패턴

### 1:1 대화

```python
# 직접 대화
response = assistant.generate_reply(
    messages=[{"role": "user", "content": "Hello!"}]
)

# 채팅 세션
user_proxy.initiate_chat(
    assistant,
    message="Write a sorting algorithm",
    max_turns=5
)
```

### 다대다 대화 (GroupChat)

```python
groupchat = GroupChat(
    agents=[agent1, agent2, agent3],
    messages=[],
    max_round=10
)

manager = GroupChatManager(groupchat=groupchat, llm_config=llm_config)
agent1.initiate_chat(manager, message="Let's discuss the project")
```

### 체이닝 (Sequential)

```python
# 순차적 에이전트 실행
result1 = user_proxy.initiate_chat(developer, message="Write code")
result2 = user_proxy.initiate_chat(reviewer, message=f"Review this: {result1}")
result3 = user_proxy.initiate_chat(tester, message=f"Test this: {result1}")
```

## 베스트 프랙티스

### 1. 명확한 역할 정의

```python
# Good: 구체적인 역할과 지침
assistant = AssistantAgent(
    name="python_expert",
    system_message="""You are a Python expert specializing in:
    - Clean code principles
    - Performance optimization
    - Security best practices

    Always:
    1. Include type hints
    2. Write docstrings
    3. Handle exceptions
    4. Follow PEP 8""",
    llm_config=llm_config
)

# Bad: 모호한 역할
assistant = AssistantAgent(
    name="helper",
    system_message="Help with things",
    llm_config=llm_config
)
```

### 2. 적절한 종료 조건

```python
def is_task_complete(message: dict) -> bool:
    """작업 완료 여부 판단"""
    content = message.get("content", "")
    return (
        "TASK_COMPLETE" in content or
        "All tests passed" in content
    )

user_proxy = UserProxyAgent(
    name="user_proxy",
    is_termination_msg=is_task_complete,
    max_consecutive_auto_reply=15
)
```

### 3. 리소스 제한

```python
# 토큰 및 비용 제한
llm_config = {
    "config_list": config_list,
    "temperature": 0.7,
    "max_tokens": 2000,
    "timeout": 120,
    "cache_seed": 42  # 동일 입력에 대한 캐싱
}
```
