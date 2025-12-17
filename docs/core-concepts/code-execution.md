---
sidebar_position: 4
---

# 코드 실행

AutoGen에서 안전하게 코드를 실행하는 방법과 다양한 실행 환경 설정을 알아봅니다.

## 기본 코드 실행 설정

### UserProxyAgent 코드 실행

```python
from autogen import UserProxyAgent

user_proxy = UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER",
    code_execution_config={
        "work_dir": "workspace",
        "use_docker": False,
        "timeout": 60,
        "last_n_messages": 3
    }
)
```

### 코드 실행 설정 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `work_dir` | 코드 실행 디렉토리 | "." |
| `use_docker` | Docker 컨테이너 사용 여부 | True |
| `timeout` | 실행 타임아웃 (초) | 60 |
| `last_n_messages` | 코드 추출할 메시지 수 | auto |

## Docker 기반 실행

### 기본 Docker 설정

```python
code_execution_config = {
    "work_dir": "workspace",
    "use_docker": True,
    "timeout": 120
}

user_proxy = UserProxyAgent(
    name="user_proxy",
    code_execution_config=code_execution_config
)
```

### 커스텀 Docker 이미지

```python
# 특정 이미지 지정
code_execution_config = {
    "work_dir": "workspace",
    "use_docker": "python:3.11-slim",
    "timeout": 120
}

# 데이터 과학용 이미지
code_execution_config = {
    "work_dir": "workspace",
    "use_docker": "jupyter/scipy-notebook:latest",
    "timeout": 300
}
```

### Dockerfile로 커스텀 환경

```dockerfile
# Dockerfile.autogen
FROM python:3.11-slim

RUN pip install --no-cache-dir \
    pandas \
    numpy \
    matplotlib \
    scikit-learn \
    requests \
    beautifulsoup4

WORKDIR /workspace
```

```python
import subprocess

# 이미지 빌드
subprocess.run(["docker", "build", "-t", "autogen-custom", "-f", "Dockerfile.autogen", "."])

code_execution_config = {
    "work_dir": "workspace",
    "use_docker": "autogen-custom",
    "timeout": 180
}
```

## LocalCommandLineCodeExecutor

AutoGen 0.2.x의 새로운 코드 실행기입니다.

```python
from autogen.coding import LocalCommandLineCodeExecutor

executor = LocalCommandLineCodeExecutor(
    timeout=60,
    work_dir="workspace"
)

# 코드 실행
code_blocks = [
    {"language": "python", "code": "print('Hello, World!')"}
]

result = executor.execute_code_blocks(code_blocks)
print(result.output)
print(f"Exit code: {result.exit_code}")
```

## DockerCommandLineCodeExecutor

```python
from autogen.coding import DockerCommandLineCodeExecutor

executor = DockerCommandLineCodeExecutor(
    image="python:3.11-slim",
    timeout=120,
    work_dir="workspace"
)

# 에이전트와 함께 사용
user_proxy = UserProxyAgent(
    name="user_proxy",
    code_execution_config={"executor": executor}
)
```

## Jupyter 코드 실행

### JupyterCodeExecutor

```python
from autogen.coding.jupyter import JupyterCodeExecutor, LocalJupyterServer

# Jupyter 서버 시작
server = LocalJupyterServer()

executor = JupyterCodeExecutor(
    jupyter_server=server,
    timeout=60
)

# 에이전트 설정
user_proxy = UserProxyAgent(
    name="user_proxy",
    code_execution_config={"executor": executor}
)
```

### Docker 기반 Jupyter

```python
from autogen.coding.jupyter import DockerJupyterServer

server = DockerJupyterServer(
    image="jupyter/scipy-notebook:latest",
    token="your-secret-token"
)

executor = JupyterCodeExecutor(jupyter_server=server)
```

## 보안 설정

### 샌드박스 환경

```python
# 제한된 Docker 환경
code_execution_config = {
    "work_dir": "workspace",
    "use_docker": True,
    "docker_args": {
        "network_mode": "none",  # 네트워크 비활성화
        "mem_limit": "512m",     # 메모리 제한
        "cpu_period": 100000,    # CPU 제한
        "cpu_quota": 50000,      # CPU 50% 제한
        "read_only": False,
        "security_opt": ["no-new-privileges"]
    },
    "timeout": 60
}
```

### 코드 검증

```python
import re

def validate_code(code: str) -> tuple[bool, str]:
    """코드 보안 검증"""

    # 위험한 패턴
    dangerous_patterns = [
        r"import\s+os",
        r"import\s+subprocess",
        r"import\s+sys",
        r"__import__",
        r"eval\s*\(",
        r"exec\s*\(",
        r"open\s*\([^)]*['\"]w['\"]",
        r"rm\s+-rf",
        r"sudo\s+",
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, code):
            return False, f"Dangerous pattern detected: {pattern}"

    return True, "Code passed validation"

class SafeUserProxyAgent(UserProxyAgent):
    """보안 검증이 포함된 UserProxyAgent"""

    def execute_code_blocks(self, code_blocks):
        for block in code_blocks:
            is_safe, message = validate_code(block["code"])
            if not is_safe:
                return f"Code execution blocked: {message}"

        return super().execute_code_blocks(code_blocks)
```

### 화이트리스트 기반 실행

```python
ALLOWED_IMPORTS = {
    "pandas", "numpy", "matplotlib", "seaborn",
    "sklearn", "json", "datetime", "math", "statistics"
}

def check_imports(code: str) -> bool:
    """허용된 import만 사용하는지 확인"""
    import_pattern = r"(?:from|import)\s+(\w+)"
    imports = re.findall(import_pattern, code)

    for imp in imports:
        if imp not in ALLOWED_IMPORTS:
            return False
    return True
```

## 실행 결과 처리

### 결과 파싱

```python
from autogen.coding import CodeBlock, CodeResult

def parse_execution_result(result: CodeResult) -> dict:
    """실행 결과 파싱"""
    return {
        "success": result.exit_code == 0,
        "exit_code": result.exit_code,
        "output": result.output,
        "code_file": result.code_file,
        "error": None if result.exit_code == 0 else result.output
    }
```

### 파일 출력 처리

```python
import os

def collect_output_files(work_dir: str) -> list[dict]:
    """생성된 파일 수집"""
    output_files = []

    for filename in os.listdir(work_dir):
        filepath = os.path.join(work_dir, filename)
        if os.path.isfile(filepath):
            with open(filepath, 'rb') as f:
                content = f.read()

            output_files.append({
                "filename": filename,
                "size": len(content),
                "is_binary": not is_text_file(filepath)
            })

    return output_files

def is_text_file(filepath: str) -> bool:
    """텍스트 파일 여부 확인"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            f.read(1024)
        return True
    except UnicodeDecodeError:
        return False
```

## 에러 핸들링

### 타임아웃 처리

```python
from autogen.coding import CodeExecutionError

def execute_with_retry(executor, code_blocks, max_retries=3):
    """재시도 로직이 포함된 코드 실행"""

    for attempt in range(max_retries):
        try:
            result = executor.execute_code_blocks(code_blocks)

            if result.exit_code == 0:
                return result

            # 타임아웃 에러인 경우 타임아웃 증가
            if "timeout" in result.output.lower():
                executor.timeout *= 2
                continue

            return result

        except CodeExecutionError as e:
            if attempt == max_retries - 1:
                raise
            continue

    raise Exception("Max retries exceeded")
```

### 에러 복구

```python
def handle_execution_error(error_message: str, assistant, user_proxy):
    """실행 에러 처리 및 복구"""

    recovery_prompt = f"""
The code execution failed with the following error:
{error_message}

Please analyze the error and provide a corrected version of the code.
Focus on:
1. Fixing the specific error
2. Adding error handling
3. Ensuring dependencies are available
"""

    # 에러 복구를 위한 대화 시작
    user_proxy.initiate_chat(
        assistant,
        message=recovery_prompt,
        max_turns=3
    )
```

## 프로덕션 설정 예시

```python
from autogen import AssistantAgent, UserProxyAgent
from autogen.coding import DockerCommandLineCodeExecutor
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProductionCodeExecutor:
    """프로덕션용 코드 실행 환경"""

    def __init__(self, config: dict):
        self.config = config
        self.executor = self._create_executor()

    def _create_executor(self):
        return DockerCommandLineCodeExecutor(
            image=self.config.get("docker_image", "python:3.11-slim"),
            timeout=self.config.get("timeout", 120),
            work_dir=self.config.get("work_dir", "/tmp/workspace"),
        )

    def execute(self, code_blocks: list) -> dict:
        """안전한 코드 실행"""
        # 사전 검증
        for block in code_blocks:
            is_safe, msg = validate_code(block["code"])
            if not is_safe:
                logger.warning(f"Code blocked: {msg}")
                return {"success": False, "error": msg}

        try:
            result = self.executor.execute_code_blocks(code_blocks)

            return {
                "success": result.exit_code == 0,
                "output": result.output,
                "exit_code": result.exit_code
            }

        except Exception as e:
            logger.error(f"Execution failed: {e}")
            return {"success": False, "error": str(e)}

# 사용 예시
executor_config = {
    "docker_image": "python:3.11-slim",
    "timeout": 180,
    "work_dir": "/tmp/autogen_workspace"
}

prod_executor = ProductionCodeExecutor(executor_config)

user_proxy = UserProxyAgent(
    name="executor",
    human_input_mode="NEVER",
    code_execution_config={"executor": prod_executor.executor}
)
```

## 모범 사례

### 1. 항상 Docker 사용 (프로덕션)

```python
# 프로덕션 환경
code_execution_config = {
    "use_docker": True,
    "timeout": 120
}
```

### 2. 적절한 타임아웃 설정

```python
# 작업 유형별 타임아웃
TIMEOUTS = {
    "simple_script": 30,
    "data_processing": 120,
    "ml_training": 600,
    "long_running": 1800
}
```

### 3. 리소스 제한

```python
code_execution_config = {
    "use_docker": True,
    "docker_args": {
        "mem_limit": "1g",
        "cpu_period": 100000,
        "cpu_quota": 100000
    }
}
```

### 4. 출력 크기 제한

```python
MAX_OUTPUT_SIZE = 100000  # 100KB

def truncate_output(output: str) -> str:
    """출력 크기 제한"""
    if len(output) > MAX_OUTPUT_SIZE:
        return output[:MAX_OUTPUT_SIZE] + "\n... (output truncated)"
    return output
```
