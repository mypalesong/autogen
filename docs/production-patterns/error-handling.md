---
sidebar_position: 1
---

# 에러 핸들링

프로덕션 환경에서 AutoGen 애플리케이션의 안정적인 에러 처리 방법을 알아봅니다.

## 기본 에러 처리 구조

### 예외 계층 구조

```python
class AutoGenError(Exception):
    """AutoGen 기본 예외"""
    pass

class LLMError(AutoGenError):
    """LLM 관련 에러"""
    pass

class CodeExecutionError(AutoGenError):
    """코드 실행 에러"""
    pass

class ConversationError(AutoGenError):
    """대화 흐름 에러"""
    pass

class ConfigurationError(AutoGenError):
    """설정 에러"""
    pass

class TimeoutError(AutoGenError):
    """타임아웃 에러"""
    pass
```

### 에러 핸들러 클래스

```python
import logging
from typing import Callable, Optional
from functools import wraps

logger = logging.getLogger(__name__)

class ErrorHandler:
    """중앙 집중식 에러 핸들러"""

    def __init__(self):
        self.handlers: dict[type, Callable] = {}
        self.default_handler: Optional[Callable] = None

    def register(self, error_type: type, handler: Callable):
        """에러 타입별 핸들러 등록"""
        self.handlers[error_type] = handler

    def set_default(self, handler: Callable):
        """기본 핸들러 설정"""
        self.default_handler = handler

    def handle(self, error: Exception) -> any:
        """에러 처리"""
        error_type = type(error)

        # 정확한 타입 매칭
        if error_type in self.handlers:
            return self.handlers[error_type](error)

        # 상속 관계 확인
        for registered_type, handler in self.handlers.items():
            if isinstance(error, registered_type):
                return handler(error)

        # 기본 핸들러
        if self.default_handler:
            return self.default_handler(error)

        raise error

# 사용 예시
error_handler = ErrorHandler()

def handle_llm_error(error: LLMError):
    logger.error(f"LLM Error: {error}")
    return {"status": "error", "message": "AI 서비스 일시적 오류"}

def handle_timeout(error: TimeoutError):
    logger.warning(f"Timeout: {error}")
    return {"status": "timeout", "message": "요청 시간 초과"}

error_handler.register(LLMError, handle_llm_error)
error_handler.register(TimeoutError, handle_timeout)
```

## LLM API 에러 처리

### Rate Limit 처리

```python
import time
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

class RateLimitError(LLMError):
    pass

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=retry_if_exception_type(RateLimitError)
)
def call_llm_with_retry(config_list, messages):
    """Rate Limit을 고려한 LLM 호출"""
    try:
        # LLM 호출 로직
        response = call_llm(config_list, messages)
        return response

    except Exception as e:
        if "rate_limit" in str(e).lower() or "429" in str(e):
            raise RateLimitError(f"Rate limit exceeded: {e}")
        raise
```

### API 키 에러

```python
def validate_api_keys(config_list: list) -> list[str]:
    """API 키 유효성 검증"""
    errors = []

    for config in config_list:
        api_key = config.get("api_key", "")

        if not api_key:
            errors.append(f"Missing API key for model {config.get('model')}")
        elif api_key.startswith("sk-") and len(api_key) < 20:
            errors.append(f"Invalid OpenAI API key format")
        elif config.get("api_type") == "azure" and not config.get("base_url"):
            errors.append("Azure config missing base_url")

    return errors

# 시작 시 검증
errors = validate_api_keys(config_list)
if errors:
    raise ConfigurationError(f"API configuration errors: {errors}")
```

### 모델 폴백

```python
class LLMClient:
    """폴백 지원 LLM 클라이언트"""

    def __init__(self, config_list: list):
        self.config_list = config_list
        self.current_index = 0

    def call(self, messages: list) -> dict:
        """폴백을 포함한 LLM 호출"""
        last_error = None

        for i, config in enumerate(self.config_list):
            try:
                logger.info(f"Trying model: {config.get('model')}")
                response = self._call_single(config, messages)
                self.current_index = i
                return response

            except Exception as e:
                logger.warning(f"Model {config.get('model')} failed: {e}")
                last_error = e
                continue

        raise LLMError(f"All models failed. Last error: {last_error}")

    def _call_single(self, config: dict, messages: list) -> dict:
        """단일 모델 호출"""
        # 실제 API 호출 로직
        pass
```

## 코드 실행 에러 처리

### 실행 실패 복구

```python
class CodeExecutionManager:
    """코드 실행 관리자"""

    def __init__(self, executor, max_retries: int = 3):
        self.executor = executor
        self.max_retries = max_retries

    def execute_with_recovery(self, code: str, assistant) -> dict:
        """복구 로직이 포함된 코드 실행"""

        for attempt in range(self.max_retries):
            try:
                result = self.executor.execute_code_blocks([
                    {"language": "python", "code": code}
                ])

                if result.exit_code == 0:
                    return {
                        "success": True,
                        "output": result.output,
                        "attempt": attempt + 1
                    }

                # 실패 시 에러 분석 및 수정 요청
                if attempt < self.max_retries - 1:
                    code = self._get_fixed_code(
                        code, result.output, assistant
                    )

            except Exception as e:
                logger.error(f"Execution attempt {attempt + 1} failed: {e}")

                if attempt == self.max_retries - 1:
                    return {
                        "success": False,
                        "error": str(e),
                        "attempt": attempt + 1
                    }

        return {
            "success": False,
            "error": "Max retries exceeded",
            "attempt": self.max_retries
        }

    def _get_fixed_code(self, original_code: str, error: str, assistant) -> str:
        """LLM을 통한 코드 수정"""
        fix_prompt = f"""
The following code failed with an error:

```python
{original_code}
```

Error:
{error}

Please provide a corrected version of the code.
Only output the corrected code without explanation.
"""

        response = assistant.generate_reply(
            messages=[{"role": "user", "content": fix_prompt}]
        )

        # 코드 블록 추출
        return self._extract_code(response)

    def _extract_code(self, response: str) -> str:
        """응답에서 코드 추출"""
        import re
        pattern = r"```python\n(.*?)```"
        match = re.search(pattern, response, re.DOTALL)
        return match.group(1) if match else response
```

### 타임아웃 처리

```python
import signal
from contextlib import contextmanager

class ExecutionTimeoutError(CodeExecutionError):
    pass

@contextmanager
def timeout_handler(seconds: int):
    """타임아웃 컨텍스트 매니저"""

    def signal_handler(signum, frame):
        raise ExecutionTimeoutError(f"Execution timed out after {seconds} seconds")

    # 시그널 설정 (Unix만 지원)
    old_handler = signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)

    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)

# 사용 예시
def execute_code_with_timeout(executor, code, timeout_seconds=60):
    try:
        with timeout_handler(timeout_seconds):
            return executor.execute_code_blocks([
                {"language": "python", "code": code}
            ])
    except ExecutionTimeoutError as e:
        return {"success": False, "error": str(e)}
```

## 대화 흐름 에러 처리

### 무한 루프 방지

```python
class ConversationGuard:
    """대화 무한 루프 방지"""

    def __init__(self, max_turns: int = 50, similarity_threshold: float = 0.9):
        self.max_turns = max_turns
        self.similarity_threshold = similarity_threshold
        self.message_history = []

    def check(self, message: str) -> tuple[bool, str]:
        """대화 상태 검증"""

        # 최대 턴 수 확인
        if len(self.message_history) >= self.max_turns:
            return False, "Maximum conversation turns exceeded"

        # 반복 메시지 감지
        if self._is_repetitive(message):
            return False, "Repetitive conversation detected"

        self.message_history.append(message)
        return True, ""

    def _is_repetitive(self, message: str) -> bool:
        """반복 메시지 감지"""
        if len(self.message_history) < 3:
            return False

        # 최근 메시지와 유사도 비교
        from difflib import SequenceMatcher

        for prev_message in self.message_history[-5:]:
            similarity = SequenceMatcher(None, message, prev_message).ratio()
            if similarity > self.similarity_threshold:
                return True

        return False

# 에이전트에 적용
class GuardedUserProxyAgent(UserProxyAgent):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.guard = ConversationGuard()

    def receive(self, message, sender, request_reply=None, silent=False):
        content = message.get("content", "") if isinstance(message, dict) else message

        is_safe, error_msg = self.guard.check(content)
        if not is_safe:
            logger.warning(f"Conversation guard triggered: {error_msg}")
            return {"content": f"TERMINATE: {error_msg}"}

        return super().receive(message, sender, request_reply, silent)
```

### 종료 조건 강화

```python
def robust_termination_check(message: dict) -> bool:
    """강화된 종료 조건 확인"""
    content = message.get("content", "")

    # 명시적 종료
    if "TERMINATE" in content:
        return True

    # 작업 완료 신호
    completion_signals = [
        "task completed",
        "successfully finished",
        "all tests passed",
        "no more actions needed"
    ]

    if any(signal in content.lower() for signal in completion_signals):
        return True

    # 에러 종료 신호
    error_signals = [
        "fatal error",
        "cannot proceed",
        "impossible to complete"
    ]

    if any(signal in content.lower() for signal in error_signals):
        logger.warning(f"Terminating due to error: {content[:100]}")
        return True

    return False
```

## 글로벌 에러 처리

### 데코레이터 기반 처리

```python
from functools import wraps
import traceback

def handle_errors(func):
    """에러 처리 데코레이터"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except LLMError as e:
            logger.error(f"LLM error in {func.__name__}: {e}")
            return {"status": "error", "type": "llm", "message": str(e)}
        except CodeExecutionError as e:
            logger.error(f"Code execution error in {func.__name__}: {e}")
            return {"status": "error", "type": "execution", "message": str(e)}
        except TimeoutError as e:
            logger.error(f"Timeout in {func.__name__}: {e}")
            return {"status": "timeout", "message": str(e)}
        except Exception as e:
            logger.exception(f"Unexpected error in {func.__name__}")
            return {
                "status": "error",
                "type": "unknown",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    return wrapper

# 사용 예시
@handle_errors
def run_agent_task(user_proxy, assistant, task):
    return user_proxy.initiate_chat(assistant, message=task)
```

### 에러 리포팅

```python
import json
from datetime import datetime

class ErrorReporter:
    """에러 리포팅 시스템"""

    def __init__(self, report_file: str = "error_reports.jsonl"):
        self.report_file = report_file

    def report(self, error: Exception, context: dict = None):
        """에러 리포트 저장"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc(),
            "context": context or {}
        }

        with open(self.report_file, "a") as f:
            f.write(json.dumps(report) + "\n")

        # 심각한 에러는 알림 전송
        if self._is_critical(error):
            self._send_alert(report)

    def _is_critical(self, error: Exception) -> bool:
        """심각한 에러 여부 판단"""
        critical_types = [ConfigurationError, LLMError]
        return any(isinstance(error, t) for t in critical_types)

    def _send_alert(self, report: dict):
        """알림 전송 (Slack, Email 등)"""
        # 알림 로직 구현
        pass

# 글로벌 리포터
reporter = ErrorReporter()
```

## 프로덕션 에러 처리 예시

```python
class ProductionAgentRunner:
    """프로덕션용 에이전트 실행기"""

    def __init__(self, config: dict):
        self.config = config
        self.error_handler = ErrorHandler()
        self.reporter = ErrorReporter()
        self._setup_handlers()

    def _setup_handlers(self):
        """에러 핸들러 설정"""
        self.error_handler.register(LLMError, self._handle_llm_error)
        self.error_handler.register(CodeExecutionError, self._handle_code_error)
        self.error_handler.register(TimeoutError, self._handle_timeout)
        self.error_handler.set_default(self._handle_unknown)

    def run(self, task: str) -> dict:
        """안전한 에이전트 실행"""
        try:
            result = self._execute_task(task)
            return {"status": "success", "result": result}

        except Exception as e:
            self.reporter.report(e, {"task": task})
            return self.error_handler.handle(e)

    def _execute_task(self, task: str) -> dict:
        """실제 태스크 실행"""
        user_proxy = UserProxyAgent(
            name="user_proxy",
            human_input_mode="NEVER",
            is_termination_msg=robust_termination_check,
            max_consecutive_auto_reply=20,
            code_execution_config=self.config.get("code_execution")
        )

        assistant = AssistantAgent(
            name="assistant",
            llm_config=self.config.get("llm_config")
        )

        chat_result = user_proxy.initiate_chat(
            assistant,
            message=task,
            max_turns=self.config.get("max_turns", 15)
        )

        return {
            "history": chat_result.chat_history,
            "summary": chat_result.summary,
            "cost": chat_result.cost
        }

    def _handle_llm_error(self, error):
        return {
            "status": "error",
            "message": "AI 서비스에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
            "retry": True
        }

    def _handle_code_error(self, error):
        return {
            "status": "error",
            "message": "코드 실행 중 오류가 발생했습니다.",
            "retry": False
        }

    def _handle_timeout(self, error):
        return {
            "status": "timeout",
            "message": "요청 처리 시간이 초과되었습니다.",
            "retry": True
        }

    def _handle_unknown(self, error):
        return {
            "status": "error",
            "message": "알 수 없는 오류가 발생했습니다.",
            "retry": False
        }
```
