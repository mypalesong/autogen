---
sidebar_position: 3
---

# LLM 설정

AutoGen에서 다양한 LLM 공급자를 설정하고 활용하는 방법을 알아봅니다.

## 기본 설정 구조

```python
llm_config = {
    "config_list": [
        {
            "model": "gpt-4",
            "api_key": "your-api-key",
            "base_url": "https://api.openai.com/v1",  # 선택적
            "api_type": "openai",  # openai, azure, etc.
        }
    ],
    "temperature": 0.7,
    "timeout": 120,
    "cache_seed": 42  # 캐싱을 위한 시드
}
```

## OpenAI 설정

### GPT-4 / GPT-4 Turbo

```python
config_list_gpt4 = [
    {
        "model": "gpt-4-turbo-preview",
        "api_key": os.environ.get("OPENAI_API_KEY"),
    },
    {
        "model": "gpt-4",
        "api_key": os.environ.get("OPENAI_API_KEY"),
    }
]

llm_config = {
    "config_list": config_list_gpt4,
    "temperature": 0.7,
    "max_tokens": 4096,
    "timeout": 120,
}
```

### GPT-3.5 Turbo

```python
config_list_gpt35 = [
    {
        "model": "gpt-3.5-turbo",
        "api_key": os.environ.get("OPENAI_API_KEY"),
    }
]
```

### JSON 모드

```python
# JSON 응답 강제
llm_config = {
    "config_list": config_list,
    "response_format": {"type": "json_object"},
    "temperature": 0.1,
}

assistant = AssistantAgent(
    name="json_assistant",
    system_message="Always respond in valid JSON format.",
    llm_config=llm_config
)
```

## Azure OpenAI 설정

```python
config_list_azure = [
    {
        "model": "gpt-4",
        "api_key": os.environ.get("AZURE_OPENAI_API_KEY"),
        "base_url": os.environ.get("AZURE_OPENAI_ENDPOINT"),
        "api_type": "azure",
        "api_version": "2024-02-15-preview"
    }
]

llm_config = {
    "config_list": config_list_azure,
    "temperature": 0.7,
}
```

### Azure 배포 이름 사용

```python
config_list_azure = [
    {
        "model": "my-gpt4-deployment",  # Azure 배포 이름
        "api_key": os.environ.get("AZURE_OPENAI_API_KEY"),
        "base_url": "https://my-resource.openai.azure.com/",
        "api_type": "azure",
        "api_version": "2024-02-15-preview"
    }
]
```

## Anthropic Claude 설정

```python
config_list_claude = [
    {
        "model": "claude-3-opus-20240229",
        "api_key": os.environ.get("ANTHROPIC_API_KEY"),
        "api_type": "anthropic"
    },
    {
        "model": "claude-3-sonnet-20240229",
        "api_key": os.environ.get("ANTHROPIC_API_KEY"),
        "api_type": "anthropic"
    }
]

llm_config = {
    "config_list": config_list_claude,
    "temperature": 0.7,
    "max_tokens": 4096,
}
```

## 로컬 LLM 설정

### LM Studio

```python
config_list_local = [
    {
        "model": "local-model",
        "base_url": "http://localhost:1234/v1",
        "api_key": "not-needed"
    }
]
```

### Ollama

```python
config_list_ollama = [
    {
        "model": "llama2",
        "base_url": "http://localhost:11434/v1",
        "api_key": "ollama"
    }
]
```

### vLLM

```python
config_list_vllm = [
    {
        "model": "meta-llama/Llama-2-70b-chat-hf",
        "base_url": "http://localhost:8000/v1",
        "api_key": "not-needed"
    }
]
```

## 폴백 (Fallback) 설정

여러 모델을 순차적으로 시도하는 폴백 구성:

```python
# 우선순위에 따른 폴백 설정
config_list_with_fallback = [
    # 1순위: GPT-4 Turbo (가장 성능 좋음)
    {
        "model": "gpt-4-turbo-preview",
        "api_key": os.environ.get("OPENAI_API_KEY"),
    },
    # 2순위: GPT-4 (안정적)
    {
        "model": "gpt-4",
        "api_key": os.environ.get("OPENAI_API_KEY"),
    },
    # 3순위: GPT-3.5 Turbo (비용 효율적)
    {
        "model": "gpt-3.5-turbo",
        "api_key": os.environ.get("OPENAI_API_KEY"),
    },
    # 4순위: Azure 백업
    {
        "model": "gpt-4",
        "api_key": os.environ.get("AZURE_OPENAI_API_KEY"),
        "base_url": os.environ.get("AZURE_OPENAI_ENDPOINT"),
        "api_type": "azure",
        "api_version": "2024-02-15-preview"
    }
]

llm_config = {
    "config_list": config_list_with_fallback,
    "timeout": 60,  # 빠른 폴백을 위한 짧은 타임아웃
}
```

## 설정 파일 사용

### OAI_CONFIG_LIST 파일

```json
// OAI_CONFIG_LIST
[
    {
        "model": "gpt-4-turbo-preview",
        "api_key": "sk-xxx"
    },
    {
        "model": "gpt-4",
        "api_key": "sk-xxx"
    },
    {
        "model": "gpt-3.5-turbo",
        "api_key": "sk-xxx"
    }
]
```

### 파일에서 설정 로드

```python
from autogen import config_list_from_json

# JSON 파일에서 로드
config_list = config_list_from_json(
    "OAI_CONFIG_LIST",
    filter_dict={
        "model": ["gpt-4", "gpt-4-turbo-preview"]
    }
)

# 환경 변수에서 로드
config_list = config_list_from_json(
    env_or_file="OAI_CONFIG_LIST"
)
```

### 모델 필터링

```python
# 특정 모델만 선택
config_list = config_list_from_json(
    "OAI_CONFIG_LIST",
    filter_dict={
        "model": {
            "gpt-4",
            "gpt-4-turbo-preview"
        }
    }
)

# API 타입으로 필터링
config_list_azure_only = config_list_from_json(
    "OAI_CONFIG_LIST",
    filter_dict={
        "api_type": ["azure"]
    }
)
```

## 고급 설정

### Function Calling 설정

```python
# 함수 정의
functions = [
    {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"]
                }
            },
            "required": ["location"]
        }
    }
]

llm_config = {
    "config_list": config_list,
    "functions": functions,
    "function_call": "auto"  # auto, none, 또는 특정 함수명
}
```

### Tool Calling (새로운 방식)

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_database",
            "description": "Search the database for records",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results"
                    }
                },
                "required": ["query"]
            }
        }
    }
]

llm_config = {
    "config_list": config_list,
    "tools": tools,
    "tool_choice": "auto"
}
```

### 캐싱 설정

```python
# 캐싱 활성화
llm_config = {
    "config_list": config_list,
    "cache_seed": 42,  # 동일한 시드 = 동일한 캐시
}

# 캐싱 비활성화
llm_config = {
    "config_list": config_list,
    "cache_seed": None,  # 매번 새로운 응답
}

# Redis 캐시 사용
from autogen.cache import Cache

with Cache.redis(redis_url="redis://localhost:6379/0") as cache:
    assistant = AssistantAgent(
        name="assistant",
        llm_config=llm_config,
        cache=cache
    )
```

### 토큰 제한

```python
llm_config = {
    "config_list": config_list,
    "max_tokens": 2000,  # 응답 최대 토큰
    "temperature": 0.7,
}

# 에이전트별 토큰 예산
assistant = AssistantAgent(
    name="assistant",
    llm_config=llm_config,
    max_consecutive_auto_reply=10
)
```

## 환경 변수 관리

### .env 파일 사용

```bash
# .env
OPENAI_API_KEY=sk-xxx
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com/
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 환경 변수 로드

```python
from dotenv import load_dotenv
import os

load_dotenv()

config_list = [
    {
        "model": "gpt-4",
        "api_key": os.getenv("OPENAI_API_KEY"),
    }
]
```

## 프로덕션 설정 예시

```python
import os
from dotenv import load_dotenv

load_dotenv()

def get_production_config():
    """프로덕션 환경용 LLM 설정"""

    config_list = []

    # Primary: Azure OpenAI (기업 환경)
    if os.getenv("AZURE_OPENAI_API_KEY"):
        config_list.append({
            "model": os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-4"),
            "api_key": os.getenv("AZURE_OPENAI_API_KEY"),
            "base_url": os.getenv("AZURE_OPENAI_ENDPOINT"),
            "api_type": "azure",
            "api_version": "2024-02-15-preview"
        })

    # Fallback: OpenAI
    if os.getenv("OPENAI_API_KEY"):
        config_list.extend([
            {
                "model": "gpt-4-turbo-preview",
                "api_key": os.getenv("OPENAI_API_KEY"),
            },
            {
                "model": "gpt-3.5-turbo",
                "api_key": os.getenv("OPENAI_API_KEY"),
            }
        ])

    return {
        "config_list": config_list,
        "temperature": 0.7,
        "timeout": 120,
        "max_tokens": 4096,
        "cache_seed": None,  # 프로덕션에서는 캐싱 비활성화 권장
    }

# 사용
llm_config = get_production_config()
```

## 디버깅 및 로깅

```python
import logging

# 상세 로깅 활성화
logging.basicConfig(level=logging.DEBUG)
autogen_logger = logging.getLogger("autogen")
autogen_logger.setLevel(logging.DEBUG)

# LLM 호출 로깅
llm_config = {
    "config_list": config_list,
    "temperature": 0.7,
}

# 요청/응답 로깅을 위한 래퍼
class LoggingWrapper:
    def __init__(self, config):
        self.config = config
        self.call_count = 0
        self.total_tokens = 0

    def log_call(self, messages, response):
        self.call_count += 1
        tokens = response.get("usage", {}).get("total_tokens", 0)
        self.total_tokens += tokens
        print(f"Call #{self.call_count}: {tokens} tokens, Total: {self.total_tokens}")
```
