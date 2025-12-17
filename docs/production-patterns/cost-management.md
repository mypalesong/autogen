---
sidebar_position: 2
---

# 비용 관리

프로덕션 환경에서 LLM API 비용을 효과적으로 관리하고 최적화하는 방법을 알아봅니다.

## 비용 추적

### 기본 비용 추적

```python
from autogen import AssistantAgent, UserProxyAgent

# 대화 후 비용 확인
chat_result = user_proxy.initiate_chat(
    assistant,
    message="Write a Python function"
)

# 비용 정보 출력
print(f"Total cost: ${chat_result.cost['total_cost']:.4f}")
print(f"Input tokens: {chat_result.cost.get('usage_including_cached_inference', {})}")
```

### 상세 비용 추적 시스템

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import json

@dataclass
class UsageRecord:
    """단일 API 호출 기록"""
    timestamp: datetime
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost: float
    agent_name: Optional[str] = None
    task_id: Optional[str] = None

@dataclass
class CostTracker:
    """비용 추적 시스템"""
    records: list[UsageRecord] = field(default_factory=list)
    budget_limit: float = float('inf')
    alert_threshold: float = 0.8  # 80% 사용 시 알림

    # 모델별 가격 (1K 토큰당, 2024년 기준)
    PRICING = {
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    }

    def add_record(self, model: str, prompt_tokens: int,
                   completion_tokens: int, **kwargs):
        """사용량 기록 추가"""
        cost = self._calculate_cost(model, prompt_tokens, completion_tokens)

        record = UsageRecord(
            timestamp=datetime.now(),
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost=cost,
            **kwargs
        )

        self.records.append(record)
        self._check_budget()

        return record

    def _calculate_cost(self, model: str, prompt_tokens: int,
                        completion_tokens: int) -> float:
        """비용 계산"""
        pricing = self.PRICING.get(model, {"input": 0.01, "output": 0.03})

        input_cost = (prompt_tokens / 1000) * pricing["input"]
        output_cost = (completion_tokens / 1000) * pricing["output"]

        return input_cost + output_cost

    def _check_budget(self):
        """예산 확인"""
        total = self.get_total_cost()

        if total >= self.budget_limit:
            raise BudgetExceededError(f"Budget limit ${self.budget_limit} exceeded")

        if total >= self.budget_limit * self.alert_threshold:
            self._send_budget_alert(total)

    def get_total_cost(self) -> float:
        """총 비용"""
        return sum(r.cost for r in self.records)

    def get_cost_by_model(self) -> dict[str, float]:
        """모델별 비용"""
        costs = {}
        for record in self.records:
            costs[record.model] = costs.get(record.model, 0) + record.cost
        return costs

    def get_cost_by_task(self) -> dict[str, float]:
        """작업별 비용"""
        costs = {}
        for record in self.records:
            if record.task_id:
                costs[record.task_id] = costs.get(record.task_id, 0) + record.cost
        return costs

    def get_daily_report(self) -> dict:
        """일일 리포트"""
        today = datetime.now().date()
        today_records = [r for r in self.records if r.timestamp.date() == today]

        return {
            "date": str(today),
            "total_cost": sum(r.cost for r in today_records),
            "total_tokens": sum(r.total_tokens for r in today_records),
            "api_calls": len(today_records),
            "by_model": self._group_by_model(today_records)
        }

    def _group_by_model(self, records: list[UsageRecord]) -> dict:
        """모델별 그룹화"""
        groups = {}
        for record in records:
            if record.model not in groups:
                groups[record.model] = {"cost": 0, "tokens": 0, "calls": 0}
            groups[record.model]["cost"] += record.cost
            groups[record.model]["tokens"] += record.total_tokens
            groups[record.model]["calls"] += 1
        return groups

    def _send_budget_alert(self, current_cost: float):
        """예산 알림 전송"""
        print(f"WARNING: Budget usage at {current_cost/self.budget_limit*100:.1f}%")

    def export_to_json(self, filepath: str):
        """JSON으로 내보내기"""
        data = [
            {
                "timestamp": r.timestamp.isoformat(),
                "model": r.model,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "cost": r.cost
            }
            for r in self.records
        ]
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

class BudgetExceededError(Exception):
    pass
```

## 비용 최적화 전략

### 1. 모델 선택 최적화

```python
class ModelSelector:
    """작업 복잡도에 따른 모델 선택"""

    def __init__(self, config_list: list):
        self.models = {
            "simple": self._filter_models(config_list, ["gpt-3.5-turbo"]),
            "medium": self._filter_models(config_list, ["gpt-4-turbo-preview"]),
            "complex": self._filter_models(config_list, ["gpt-4", "claude-3-opus"])
        }

    def _filter_models(self, config_list: list, models: list) -> list:
        return [c for c in config_list if c.get("model") in models]

    def select(self, task_complexity: str) -> list:
        """복잡도에 따른 모델 선택"""
        return self.models.get(task_complexity, self.models["medium"])

    def estimate_complexity(self, task: str) -> str:
        """작업 복잡도 추정"""
        # 간단한 휴리스틱
        task_lower = task.lower()

        complex_keywords = ["analyze", "design", "architect", "optimize", "debug"]
        simple_keywords = ["format", "convert", "summarize", "translate"]

        if any(kw in task_lower for kw in complex_keywords):
            return "complex"
        elif any(kw in task_lower for kw in simple_keywords):
            return "simple"
        else:
            return "medium"

# 사용 예시
selector = ModelSelector(config_list)

task = "Analyze the codebase and suggest architectural improvements"
complexity = selector.estimate_complexity(task)
selected_config = selector.select(complexity)

llm_config = {"config_list": selected_config}
```

### 2. 캐싱 전략

```python
import hashlib
import json
from typing import Optional

class ResponseCache:
    """LLM 응답 캐시"""

    def __init__(self, cache_dir: str = ".cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _get_cache_key(self, messages: list, model: str) -> str:
        """캐시 키 생성"""
        content = json.dumps({"messages": messages, "model": model}, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def get(self, messages: list, model: str) -> Optional[dict]:
        """캐시에서 응답 조회"""
        key = self._get_cache_key(messages, model)
        cache_path = os.path.join(self.cache_dir, f"{key}.json")

        if os.path.exists(cache_path):
            with open(cache_path, "r") as f:
                return json.load(f)
        return None

    def set(self, messages: list, model: str, response: dict):
        """캐시에 응답 저장"""
        key = self._get_cache_key(messages, model)
        cache_path = os.path.join(self.cache_dir, f"{key}.json")

        with open(cache_path, "w") as f:
            json.dump(response, f)

class CachedLLMClient:
    """캐싱이 적용된 LLM 클라이언트"""

    def __init__(self, config_list: list, cache: ResponseCache):
        self.config_list = config_list
        self.cache = cache
        self.cache_hits = 0
        self.cache_misses = 0

    def call(self, messages: list) -> dict:
        """캐시 우선 LLM 호출"""
        model = self.config_list[0].get("model")

        # 캐시 확인
        cached_response = self.cache.get(messages, model)
        if cached_response:
            self.cache_hits += 1
            return cached_response

        # API 호출
        self.cache_misses += 1
        response = self._call_api(messages)

        # 캐시 저장
        self.cache.set(messages, model, response)

        return response

    def _call_api(self, messages: list) -> dict:
        """실제 API 호출"""
        # API 호출 로직
        pass

    def get_cache_stats(self) -> dict:
        """캐시 통계"""
        total = self.cache_hits + self.cache_misses
        return {
            "hits": self.cache_hits,
            "misses": self.cache_misses,
            "hit_rate": self.cache_hits / total if total > 0 else 0
        }
```

### 3. 토큰 최적화

```python
class TokenOptimizer:
    """토큰 사용량 최적화"""

    def __init__(self, max_context_tokens: int = 8000):
        self.max_context_tokens = max_context_tokens

    def optimize_messages(self, messages: list) -> list:
        """메시지 최적화"""
        optimized = []
        total_tokens = 0

        # 시스템 메시지는 항상 포함
        system_msgs = [m for m in messages if m.get("role") == "system"]
        for msg in system_msgs:
            tokens = self._estimate_tokens(msg["content"])
            optimized.append(msg)
            total_tokens += tokens

        # 최신 메시지부터 역순으로 추가
        other_msgs = [m for m in messages if m.get("role") != "system"]
        for msg in reversed(other_msgs):
            tokens = self._estimate_tokens(msg["content"])

            if total_tokens + tokens > self.max_context_tokens:
                break

            optimized.insert(len(system_msgs), msg)
            total_tokens += tokens

        return optimized

    def _estimate_tokens(self, text: str) -> int:
        """토큰 수 추정 (대략적)"""
        # 실제로는 tiktoken 사용 권장
        return len(text) // 4

    def truncate_long_content(self, content: str, max_tokens: int = 2000) -> str:
        """긴 콘텐츠 자르기"""
        estimated = self._estimate_tokens(content)

        if estimated <= max_tokens:
            return content

        # 대략적인 문자 수로 변환
        max_chars = max_tokens * 4
        return content[:max_chars] + "\n... (truncated)"

    def summarize_history(self, messages: list, assistant) -> list:
        """대화 기록 요약"""
        if len(messages) < 10:
            return messages

        # 오래된 메시지 요약
        old_messages = messages[:-5]
        recent_messages = messages[-5:]

        summary_prompt = f"""
Summarize the following conversation in 2-3 sentences:
{json.dumps(old_messages, indent=2)}
"""

        summary_response = assistant.generate_reply(
            messages=[{"role": "user", "content": summary_prompt}]
        )

        return [
            {"role": "system", "content": f"Previous conversation summary: {summary_response}"}
        ] + recent_messages
```

### 4. 예산 제한

```python
class BudgetManager:
    """예산 관리"""

    def __init__(self, daily_budget: float, monthly_budget: float):
        self.daily_budget = daily_budget
        self.monthly_budget = monthly_budget
        self.cost_tracker = CostTracker()

    def can_proceed(self) -> tuple[bool, str]:
        """진행 가능 여부 확인"""
        daily_cost = self._get_daily_cost()
        monthly_cost = self._get_monthly_cost()

        if daily_cost >= self.daily_budget:
            return False, f"Daily budget ${self.daily_budget} exceeded"

        if monthly_cost >= self.monthly_budget:
            return False, f"Monthly budget ${self.monthly_budget} exceeded"

        return True, ""

    def _get_daily_cost(self) -> float:
        """오늘 비용"""
        today = datetime.now().date()
        return sum(
            r.cost for r in self.cost_tracker.records
            if r.timestamp.date() == today
        )

    def _get_monthly_cost(self) -> float:
        """이번 달 비용"""
        this_month = datetime.now().month
        this_year = datetime.now().year
        return sum(
            r.cost for r in self.cost_tracker.records
            if r.timestamp.month == this_month and r.timestamp.year == this_year
        )

    def get_remaining_budget(self) -> dict:
        """남은 예산"""
        return {
            "daily_remaining": max(0, self.daily_budget - self._get_daily_cost()),
            "monthly_remaining": max(0, self.monthly_budget - self._get_monthly_cost())
        }

# 에이전트 래퍼
class BudgetAwareAgent:
    """예산 인식 에이전트 래퍼"""

    def __init__(self, agent, budget_manager: BudgetManager):
        self.agent = agent
        self.budget_manager = budget_manager

    def initiate_chat(self, *args, **kwargs):
        can_proceed, reason = self.budget_manager.can_proceed()

        if not can_proceed:
            raise BudgetExceededError(reason)

        return self.agent.initiate_chat(*args, **kwargs)
```

## 비용 리포팅

### 대시보드 데이터 생성

```python
class CostReporter:
    """비용 리포터"""

    def __init__(self, cost_tracker: CostTracker):
        self.tracker = cost_tracker

    def generate_report(self, period: str = "daily") -> dict:
        """리포트 생성"""
        if period == "daily":
            return self._daily_report()
        elif period == "weekly":
            return self._weekly_report()
        elif period == "monthly":
            return self._monthly_report()

    def _daily_report(self) -> dict:
        today = datetime.now().date()
        records = [r for r in self.tracker.records if r.timestamp.date() == today]

        return {
            "period": "daily",
            "date": str(today),
            "total_cost": sum(r.cost for r in records),
            "total_tokens": sum(r.total_tokens for r in records),
            "api_calls": len(records),
            "breakdown": {
                "by_model": self._by_model(records),
                "by_hour": self._by_hour(records)
            }
        }

    def _by_model(self, records: list) -> dict:
        result = {}
        for r in records:
            if r.model not in result:
                result[r.model] = {"cost": 0, "tokens": 0, "calls": 0}
            result[r.model]["cost"] += r.cost
            result[r.model]["tokens"] += r.total_tokens
            result[r.model]["calls"] += 1
        return result

    def _by_hour(self, records: list) -> dict:
        result = {}
        for r in records:
            hour = r.timestamp.hour
            if hour not in result:
                result[hour] = {"cost": 0, "calls": 0}
            result[hour]["cost"] += r.cost
            result[hour]["calls"] += 1
        return result

    def export_csv(self, filepath: str):
        """CSV 내보내기"""
        import csv

        with open(filepath, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "model", "prompt_tokens",
                "completion_tokens", "total_tokens", "cost"
            ])

            for r in self.tracker.records:
                writer.writerow([
                    r.timestamp.isoformat(), r.model, r.prompt_tokens,
                    r.completion_tokens, r.total_tokens, f"{r.cost:.6f}"
                ])
```

## 비용 최적화 체크리스트

1. **모델 선택**: 작업 복잡도에 맞는 모델 사용
2. **캐싱**: 반복적인 쿼리에 대한 응답 캐싱
3. **토큰 최적화**: 프롬프트와 컨텍스트 길이 최적화
4. **배치 처리**: 가능한 경우 요청 배치 처리
5. **예산 제한**: 일일/월별 예산 설정 및 모니터링
6. **모니터링**: 실시간 비용 추적 및 알림
