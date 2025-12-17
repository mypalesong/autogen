---
sidebar_position: 2
---

# 대화 패턴

AutoGen에서 에이전트 간 대화를 구성하는 다양한 패턴을 알아봅니다.

## 기본 대화 패턴

### Two-Agent Chat

가장 기본적인 1:1 대화 패턴입니다.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent(
    name="assistant",
    llm_config=llm_config
)

user_proxy = UserProxyAgent(
    name="user",
    human_input_mode="NEVER",
    code_execution_config={"work_dir": "workspace"}
)

# 대화 시작
chat_result = user_proxy.initiate_chat(
    assistant,
    message="Write a function to calculate factorial",
    max_turns=5
)

# 대화 기록 확인
print(chat_result.chat_history)
print(f"Cost: {chat_result.cost}")
```

### Nested Chat

대화 내에서 다른 대화를 중첩하여 실행할 수 있습니다.

```python
def nested_chat_reply(recipient, messages, sender, config):
    """중첩 대화 핸들러"""
    last_message = messages[-1]["content"]

    # 특정 조건에서 다른 에이전트와 대화
    if "complex_task" in last_message.lower():
        specialist = AssistantAgent(
            name="specialist",
            system_message="You are a specialist for complex tasks",
            llm_config=llm_config
        )

        # 중첩 대화 실행
        result = sender.initiate_chat(
            specialist,
            message=last_message,
            max_turns=3
        )

        return True, result.summary

    return False, None

# 메인 에이전트에 중첩 대화 등록
main_agent.register_reply(
    trigger=AssistantAgent,
    reply_func=nested_chat_reply
)
```

## Sequential Chat (순차 대화)

여러 에이전트가 순차적으로 작업을 수행합니다.

```python
from autogen import initiate_chats

# 순차 대화 설정
chat_queue = [
    {
        "sender": user_proxy,
        "recipient": researcher,
        "message": "Research the latest trends in AI",
        "max_turns": 3,
        "summary_method": "reflection_with_llm"
    },
    {
        "sender": user_proxy,
        "recipient": writer,
        "message": "Write a blog post based on the research",
        "max_turns": 3,
        "summary_method": "last_msg"
    },
    {
        "sender": user_proxy,
        "recipient": editor,
        "message": "Edit and improve the blog post",
        "max_turns": 2,
        "summary_method": "last_msg"
    }
]

# 순차 대화 실행
results = initiate_chats(chat_queue)

# 각 대화 결과 확인
for i, result in enumerate(results):
    print(f"Chat {i+1} Summary: {result.summary}")
```

### 이전 대화 컨텍스트 전달

```python
chat_queue = [
    {
        "sender": user_proxy,
        "recipient": researcher,
        "message": "Research machine learning frameworks",
        "max_turns": 3,
        "summary_method": "reflection_with_llm",
        "summary_args": {
            "summary_prompt": "Summarize the key findings in bullet points"
        }
    },
    {
        "sender": user_proxy,
        "recipient": analyst,
        "message": lambda context: f"""
Based on the research summary:
{context['researcher'].summary}

Provide a comparative analysis of the frameworks.
""",
        "max_turns": 3,
        "carryover": "Combined context from all previous chats"
    }
]
```

## Group Chat (그룹 대화)

여러 에이전트가 동시에 참여하는 대화입니다.

### 기본 그룹 채팅

```python
from autogen import GroupChat, GroupChatManager

# 에이전트들 생성
planner = AssistantAgent(
    name="planner",
    system_message="""You are a project planner.
    Break down tasks into manageable steps.
    Coordinate between team members.""",
    llm_config=llm_config
)

developer = AssistantAgent(
    name="developer",
    system_message="""You are a senior developer.
    Write clean, efficient code.
    Follow best practices.""",
    llm_config=llm_config
)

reviewer = AssistantAgent(
    name="reviewer",
    system_message="""You are a code reviewer.
    Check for bugs, security issues, and code quality.
    Suggest improvements.""",
    llm_config=llm_config
)

executor = UserProxyAgent(
    name="executor",
    human_input_mode="NEVER",
    code_execution_config={"work_dir": "workspace"}
)

# 그룹 채팅 구성
groupchat = GroupChat(
    agents=[executor, planner, developer, reviewer],
    messages=[],
    max_round=20,
    speaker_selection_method="auto"
)

manager = GroupChatManager(
    groupchat=groupchat,
    llm_config=llm_config
)

# 대화 시작
executor.initiate_chat(
    manager,
    message="Build a REST API for a todo application"
)
```

### 발화 순서 제어

```python
# Round Robin 방식
groupchat = GroupChat(
    agents=[agent1, agent2, agent3],
    messages=[],
    max_round=15,
    speaker_selection_method="round_robin"
)

# 커스텀 선택 로직
def select_speaker(last_speaker, groupchat):
    """대화 컨텍스트 기반 발화자 선택"""
    messages = groupchat.messages

    if not messages:
        return planner  # 첫 발화자

    last_content = messages[-1].get("content", "").lower()

    # 키워드 기반 다음 발화자 결정
    if any(word in last_content for word in ["plan", "task", "step"]):
        return developer
    elif any(word in last_content for word in ["code", "implement", "function"]):
        return reviewer
    elif any(word in last_content for word in ["review", "approve", "issue"]):
        return executor
    else:
        return planner

groupchat = GroupChat(
    agents=[planner, developer, reviewer, executor],
    messages=[],
    max_round=20,
    speaker_selection_method=select_speaker
)
```

### 발화 제한 설정

```python
# 특정 에이전트가 연속으로 발화하는 것 방지
groupchat = GroupChat(
    agents=[agent1, agent2, agent3],
    messages=[],
    max_round=15,
    allow_repeat_speaker=False,  # 연속 발화 금지
    speaker_selection_method="auto"
)
```

## 조건부 대화 흐름

### 분기 처리

```python
def branching_chat(task_type: str):
    """작업 유형에 따른 대화 분기"""

    if task_type == "code":
        agents = [developer, code_reviewer, tester]
        initial_message = "Write and test the code"
    elif task_type == "document":
        agents = [writer, editor, fact_checker]
        initial_message = "Create and verify the document"
    else:
        agents = [general_assistant]
        initial_message = "Handle the general task"

    groupchat = GroupChat(
        agents=[user_proxy] + agents,
        messages=[],
        max_round=15
    )

    manager = GroupChatManager(groupchat=groupchat, llm_config=llm_config)
    return user_proxy.initiate_chat(manager, message=initial_message)
```

### 조건부 종료

```python
def custom_termination(message: dict) -> bool:
    """복잡한 종료 조건"""
    content = message.get("content", "")

    # 여러 종료 조건 확인
    termination_keywords = ["COMPLETE", "DONE", "FINISHED"]
    error_keywords = ["ERROR", "FAILED", "ABORT"]

    if any(keyword in content.upper() for keyword in termination_keywords):
        return True

    if any(keyword in content.upper() for keyword in error_keywords):
        # 에러 로깅
        print(f"Task terminated due to error: {content}")
        return True

    return False

user_proxy = UserProxyAgent(
    name="user_proxy",
    is_termination_msg=custom_termination,
    max_consecutive_auto_reply=20
)
```

## 대화 상태 관리

### 대화 기록 저장 및 복원

```python
import json
from datetime import datetime

class ChatStateManager:
    """대화 상태 관리 클래스"""

    def __init__(self, storage_path: str = "chat_states"):
        self.storage_path = storage_path

    def save_chat(self, chat_result, chat_id: str):
        """대화 상태 저장"""
        state = {
            "chat_id": chat_id,
            "timestamp": datetime.now().isoformat(),
            "messages": chat_result.chat_history,
            "summary": chat_result.summary,
            "cost": chat_result.cost
        }

        with open(f"{self.storage_path}/{chat_id}.json", "w") as f:
            json.dump(state, f, indent=2)

    def load_chat(self, chat_id: str) -> dict:
        """대화 상태 로드"""
        with open(f"{self.storage_path}/{chat_id}.json", "r") as f:
            return json.load(f)

    def resume_chat(self, chat_id: str, new_message: str):
        """대화 재개"""
        state = self.load_chat(chat_id)
        previous_messages = state["messages"]

        # 이전 컨텍스트와 함께 새 대화 시작
        context_message = f"""
Previous conversation summary:
{state['summary']}

Continue from here with: {new_message}
"""
        return context_message
```

### 대화 컨텍스트 공유

```python
class SharedContext:
    """에이전트 간 공유 컨텍스트"""

    def __init__(self):
        self.data = {}
        self.findings = []
        self.decisions = []

    def add_finding(self, agent_name: str, finding: str):
        self.findings.append({
            "agent": agent_name,
            "finding": finding,
            "timestamp": datetime.now().isoformat()
        })

    def add_decision(self, decision: str):
        self.decisions.append(decision)

    def get_summary(self) -> str:
        summary = "=== Shared Context Summary ===\n\n"
        summary += "Findings:\n"
        for f in self.findings:
            summary += f"- [{f['agent']}]: {f['finding']}\n"
        summary += "\nDecisions:\n"
        for d in self.decisions:
            summary += f"- {d}\n"
        return summary

# 사용 예시
shared_context = SharedContext()

def context_aware_reply(recipient, messages, sender, config):
    """컨텍스트 인식 응답 생성"""
    context_summary = shared_context.get_summary()
    last_message = messages[-1]["content"]

    enhanced_message = f"""
{context_summary}

Current request: {last_message}
"""
    # 컨텍스트가 포함된 메시지로 응답 생성
    return False, None  # 기본 응답 로직 사용
```

## 대화 패턴 모범 사례

### 1. 명확한 종료 조건 설정

```python
# 여러 종료 조건 조합
max_turns = 10
max_tokens = 50000
timeout = 300  # 5분

def comprehensive_termination(message):
    return (
        "TERMINATE" in message.get("content", "") or
        message.get("token_count", 0) > max_tokens
    )
```

### 2. 적절한 대화 라운드 수

```python
# 작업 복잡도에 따른 라운드 수 설정
simple_task_rounds = 5
medium_task_rounds = 15
complex_task_rounds = 30

groupchat = GroupChat(
    agents=agents,
    messages=[],
    max_round=medium_task_rounds  # 작업 복잡도에 맞게 조정
)
```

### 3. 대화 요약 활용

```python
# 긴 대화의 효율적 요약
chat_result = user_proxy.initiate_chat(
    assistant,
    message="Complex analysis task",
    summary_method="reflection_with_llm",
    summary_args={
        "summary_prompt": """
Summarize this conversation with:
1. Key decisions made
2. Action items identified
3. Open questions remaining
"""
    }
)
```
