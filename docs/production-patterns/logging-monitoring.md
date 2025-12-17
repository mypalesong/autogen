---
sidebar_position: 3
---

# 로깅과 모니터링

프로덕션 환경에서 AutoGen 애플리케이션의 가시성을 확보하는 방법을 알아봅니다.

## 구조화된 로깅

### 기본 로깅 설정

```python
import logging
import json
from datetime import datetime

# 기본 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("autogen")
```

### JSON 구조화 로깅

```python
class JSONFormatter(logging.Formatter):
    """JSON 포맷 로거"""

    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }

        # 추가 컨텍스트
        if hasattr(record, "agent_name"):
            log_record["agent_name"] = record.agent_name
        if hasattr(record, "task_id"):
            log_record["task_id"] = record.task_id
        if hasattr(record, "cost"):
            log_record["cost"] = record.cost

        return json.dumps(log_record)

# JSON 포맷터 적용
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
```

### 컨텍스트 로깅

```python
import contextvars
from typing import Optional

# 컨텍스트 변수
current_task_id = contextvars.ContextVar('task_id', default=None)
current_agent = contextvars.ContextVar('agent', default=None)

class ContextLogger:
    """컨텍스트 인식 로거"""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    def _add_context(self, extra: dict) -> dict:
        """컨텍스트 추가"""
        extra = extra or {}
        extra["task_id"] = current_task_id.get()
        extra["agent"] = current_agent.get()
        return extra

    def info(self, message: str, extra: dict = None):
        self.logger.info(message, extra=self._add_context(extra))

    def error(self, message: str, extra: dict = None):
        self.logger.error(message, extra=self._add_context(extra))

    def warning(self, message: str, extra: dict = None):
        self.logger.warning(message, extra=self._add_context(extra))

# 사용 예시
ctx_logger = ContextLogger("autogen.agent")

def run_task(task_id: str, agent_name: str):
    current_task_id.set(task_id)
    current_agent.set(agent_name)

    ctx_logger.info("Starting task")  # task_id와 agent가 자동으로 포함됨
```

## 대화 로깅

### 전체 대화 기록

```python
class ConversationLogger:
    """대화 로깅 시스템"""

    def __init__(self, storage_path: str = "logs/conversations"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)

    def log_conversation(self, conversation_id: str, messages: list,
                        metadata: dict = None):
        """대화 기록 저장"""
        log_entry = {
            "conversation_id": conversation_id,
            "timestamp": datetime.now().isoformat(),
            "messages": messages,
            "metadata": metadata or {},
            "message_count": len(messages),
            "total_tokens": self._count_tokens(messages)
        }

        filepath = os.path.join(
            self.storage_path,
            f"{conversation_id}.json"
        )

        with open(filepath, "w") as f:
            json.dump(log_entry, f, indent=2)

    def _count_tokens(self, messages: list) -> int:
        """토큰 수 추정"""
        total = 0
        for msg in messages:
            content = msg.get("content", "")
            total += len(content) // 4  # 대략적 추정
        return total

    def get_conversation(self, conversation_id: str) -> dict:
        """대화 기록 조회"""
        filepath = os.path.join(self.storage_path, f"{conversation_id}.json")

        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                return json.load(f)
        return None

    def search_conversations(self, query: str) -> list[dict]:
        """대화 검색"""
        results = []

        for filename in os.listdir(self.storage_path):
            if filename.endswith(".json"):
                filepath = os.path.join(self.storage_path, filename)
                with open(filepath, "r") as f:
                    conversation = json.load(f)

                # 메시지 내용에서 검색
                for msg in conversation.get("messages", []):
                    if query.lower() in msg.get("content", "").lower():
                        results.append(conversation)
                        break

        return results
```

### 메시지 수준 로깅

```python
class MessageLogger:
    """메시지 수준 로깅"""

    def __init__(self):
        self.logger = logging.getLogger("autogen.messages")

    def log_message(self, sender: str, recipient: str,
                    content: str, metadata: dict = None):
        """개별 메시지 로깅"""
        log_data = {
            "sender": sender,
            "recipient": recipient,
            "content_preview": content[:200] + "..." if len(content) > 200 else content,
            "content_length": len(content),
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata
        }

        self.logger.info(f"Message: {sender} -> {recipient}", extra=log_data)

    def log_function_call(self, function_name: str, arguments: dict,
                         result: any):
        """함수 호출 로깅"""
        self.logger.info(f"Function call: {function_name}", extra={
            "function": function_name,
            "arguments": arguments,
            "result_type": type(result).__name__,
            "timestamp": datetime.now().isoformat()
        })
```

## 메트릭 수집

### 주요 메트릭

```python
from dataclasses import dataclass, field
from collections import defaultdict
import time

@dataclass
class Metrics:
    """메트릭 저장소"""
    counters: dict = field(default_factory=lambda: defaultdict(int))
    gauges: dict = field(default_factory=dict)
    histograms: dict = field(default_factory=lambda: defaultdict(list))
    timers: dict = field(default_factory=dict)

class MetricsCollector:
    """메트릭 수집기"""

    def __init__(self):
        self.metrics = Metrics()

    def increment(self, name: str, value: int = 1, tags: dict = None):
        """카운터 증가"""
        key = self._make_key(name, tags)
        self.metrics.counters[key] += value

    def gauge(self, name: str, value: float, tags: dict = None):
        """게이지 설정"""
        key = self._make_key(name, tags)
        self.metrics.gauges[key] = value

    def histogram(self, name: str, value: float, tags: dict = None):
        """히스토그램 기록"""
        key = self._make_key(name, tags)
        self.metrics.histograms[key].append(value)

    def time(self, name: str, tags: dict = None):
        """타이머 컨텍스트 매니저"""
        return Timer(self, name, tags)

    def _make_key(self, name: str, tags: dict = None) -> str:
        if tags:
            tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
            return f"{name}:{tag_str}"
        return name

    def get_summary(self) -> dict:
        """메트릭 요약"""
        summary = {
            "counters": dict(self.metrics.counters),
            "gauges": self.metrics.gauges,
            "histograms": {}
        }

        for key, values in self.metrics.histograms.items():
            if values:
                summary["histograms"][key] = {
                    "count": len(values),
                    "min": min(values),
                    "max": max(values),
                    "avg": sum(values) / len(values),
                    "p50": self._percentile(values, 50),
                    "p95": self._percentile(values, 95),
                    "p99": self._percentile(values, 99)
                }

        return summary

    def _percentile(self, values: list, percentile: int) -> float:
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        return sorted_values[min(index, len(sorted_values) - 1)]

class Timer:
    """타이머 컨텍스트 매니저"""

    def __init__(self, collector: MetricsCollector, name: str, tags: dict):
        self.collector = collector
        self.name = name
        self.tags = tags
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, *args):
        duration = time.time() - self.start_time
        self.collector.histogram(self.name, duration, self.tags)

# 사용 예시
metrics = MetricsCollector()

# 카운터
metrics.increment("api_calls", tags={"model": "gpt-4"})

# 게이지
metrics.gauge("active_conversations", 5)

# 타이머
with metrics.time("llm_response_time", tags={"model": "gpt-4"}):
    # LLM 호출
    pass
```

### AutoGen 전용 메트릭

```python
class AutoGenMetrics:
    """AutoGen 전용 메트릭"""

    def __init__(self):
        self.collector = MetricsCollector()

    def record_chat(self, chat_result, agent_names: list[str]):
        """대화 메트릭 기록"""
        # 대화 수
        self.collector.increment("conversations_total")

        # 메시지 수
        msg_count = len(chat_result.chat_history)
        self.collector.histogram("messages_per_conversation", msg_count)

        # 비용
        cost = chat_result.cost.get("total_cost", 0)
        self.collector.histogram("conversation_cost", cost)

        # 에이전트별
        for agent in agent_names:
            agent_msgs = sum(
                1 for m in chat_result.chat_history
                if m.get("name") == agent
            )
            self.collector.histogram(
                "messages_per_agent",
                agent_msgs,
                tags={"agent": agent}
            )

    def record_code_execution(self, success: bool, duration: float,
                             language: str):
        """코드 실행 메트릭"""
        self.collector.increment(
            "code_executions",
            tags={"success": str(success), "language": language}
        )
        self.collector.histogram(
            "code_execution_duration",
            duration,
            tags={"language": language}
        )

    def record_error(self, error_type: str, agent: str = None):
        """에러 메트릭"""
        self.collector.increment(
            "errors",
            tags={"type": error_type, "agent": agent or "unknown"}
        )
```

## 분산 추적

### OpenTelemetry 통합

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# 추적 설정
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# OTLP 익스포터 설정
otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4317")
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

class TracedAgent:
    """추적이 적용된 에이전트 래퍼"""

    def __init__(self, agent):
        self.agent = agent

    def initiate_chat(self, recipient, message, **kwargs):
        with tracer.start_as_current_span("agent_chat") as span:
            span.set_attribute("agent.sender", self.agent.name)
            span.set_attribute("agent.recipient", recipient.name)
            span.set_attribute("message.preview", message[:100])

            try:
                result = self.agent.initiate_chat(recipient, message, **kwargs)

                span.set_attribute("chat.success", True)
                span.set_attribute("chat.message_count", len(result.chat_history))
                span.set_attribute("chat.cost", result.cost.get("total_cost", 0))

                return result

            except Exception as e:
                span.set_attribute("chat.success", False)
                span.set_attribute("error.message", str(e))
                span.record_exception(e)
                raise

    def generate_reply(self, messages, **kwargs):
        with tracer.start_as_current_span("generate_reply") as span:
            span.set_attribute("agent.name", self.agent.name)
            span.set_attribute("messages.count", len(messages))

            result = self.agent.generate_reply(messages, **kwargs)

            span.set_attribute("reply.length", len(result) if result else 0)

            return result
```

## 알림 시스템

### 알림 매니저

```python
from abc import ABC, abstractmethod
from enum import Enum

class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class AlertChannel(ABC):
    """알림 채널 추상 클래스"""

    @abstractmethod
    def send(self, message: str, severity: AlertSeverity, context: dict):
        pass

class SlackAlertChannel(AlertChannel):
    """Slack 알림"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def send(self, message: str, severity: AlertSeverity, context: dict):
        import requests

        color_map = {
            AlertSeverity.INFO: "#36a64f",
            AlertSeverity.WARNING: "#ffcc00",
            AlertSeverity.ERROR: "#ff6600",
            AlertSeverity.CRITICAL: "#ff0000"
        }

        payload = {
            "attachments": [{
                "color": color_map[severity],
                "title": f"[{severity.value.upper()}] AutoGen Alert",
                "text": message,
                "fields": [
                    {"title": k, "value": str(v), "short": True}
                    for k, v in context.items()
                ]
            }]
        }

        requests.post(self.webhook_url, json=payload)

class AlertManager:
    """알림 관리자"""

    def __init__(self):
        self.channels: list[AlertChannel] = []
        self.rules: list[dict] = []

    def add_channel(self, channel: AlertChannel):
        self.channels.append(channel)

    def add_rule(self, condition: callable, severity: AlertSeverity,
                 message_template: str):
        self.rules.append({
            "condition": condition,
            "severity": severity,
            "message_template": message_template
        })

    def check_and_alert(self, metrics: dict, context: dict = None):
        """조건 확인 및 알림 발송"""
        context = context or {}

        for rule in self.rules:
            if rule["condition"](metrics):
                message = rule["message_template"].format(**metrics)

                for channel in self.channels:
                    channel.send(message, rule["severity"], context)

# 사용 예시
alert_manager = AlertManager()
alert_manager.add_channel(SlackAlertChannel("https://hooks.slack.com/..."))

# 규칙 추가
alert_manager.add_rule(
    condition=lambda m: m.get("error_rate", 0) > 0.1,
    severity=AlertSeverity.ERROR,
    message_template="High error rate detected: {error_rate:.2%}"
)

alert_manager.add_rule(
    condition=lambda m: m.get("daily_cost", 0) > 100,
    severity=AlertSeverity.WARNING,
    message_template="Daily cost exceeded $100: ${daily_cost:.2f}"
)
```

## 대시보드 통합

### Prometheus 메트릭 노출

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# 메트릭 정의
api_calls_total = Counter(
    'autogen_api_calls_total',
    'Total API calls',
    ['model', 'status']
)

response_time_seconds = Histogram(
    'autogen_response_time_seconds',
    'Response time in seconds',
    ['model']
)

active_conversations = Gauge(
    'autogen_active_conversations',
    'Number of active conversations'
)

# 메트릭 서버 시작
start_http_server(8000)

# 사용
api_calls_total.labels(model='gpt-4', status='success').inc()
response_time_seconds.labels(model='gpt-4').observe(1.5)
active_conversations.set(5)
```
