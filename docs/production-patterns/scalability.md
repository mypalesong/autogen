---
sidebar_position: 4
---

# 확장성

대규모 트래픽과 복잡한 워크로드를 처리하기 위한 AutoGen 확장 전략을 알아봅니다.

## 아키텍처 패턴

### 마이크로서비스 기반 아키텍처

```python
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import asyncio
import uuid

app = FastAPI()

class TaskRequest(BaseModel):
    task: str
    priority: str = "normal"
    callback_url: str = None

class AgentService:
    """에이전트 서비스"""

    def __init__(self):
        self.task_queue = asyncio.Queue()
        self.results = {}

    async def submit_task(self, task: TaskRequest) -> str:
        """작업 제출"""
        task_id = str(uuid.uuid4())

        await self.task_queue.put({
            "task_id": task_id,
            "request": task
        })

        return task_id

    async def get_result(self, task_id: str) -> dict:
        """결과 조회"""
        return self.results.get(task_id, {"status": "pending"})

    async def process_tasks(self):
        """작업 처리 루프"""
        while True:
            task_data = await self.task_queue.get()
            task_id = task_data["task_id"]

            try:
                result = await self._execute_task(task_data["request"])
                self.results[task_id] = {"status": "completed", "result": result}
            except Exception as e:
                self.results[task_id] = {"status": "failed", "error": str(e)}

    async def _execute_task(self, request: TaskRequest) -> dict:
        """실제 에이전트 작업 실행"""
        # AutoGen 에이전트 실행 로직
        pass

agent_service = AgentService()

@app.post("/tasks")
async def create_task(request: TaskRequest, background_tasks: BackgroundTasks):
    task_id = await agent_service.submit_task(request)
    return {"task_id": task_id}

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    return await agent_service.get_result(task_id)

@app.on_event("startup")
async def startup():
    asyncio.create_task(agent_service.process_tasks())
```

### 워커 풀 패턴

```python
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from typing import Callable, List
import queue

class WorkerPool:
    """워커 풀 관리자"""

    def __init__(self, num_workers: int = 4, use_processes: bool = True):
        self.num_workers = num_workers

        if use_processes:
            self.executor = ProcessPoolExecutor(max_workers=num_workers)
        else:
            self.executor = ThreadPoolExecutor(max_workers=num_workers)

    def submit(self, func: Callable, *args, **kwargs):
        """작업 제출"""
        return self.executor.submit(func, *args, **kwargs)

    def map(self, func: Callable, items: List):
        """병렬 매핑"""
        return list(self.executor.map(func, items))

    def shutdown(self, wait: bool = True):
        """풀 종료"""
        self.executor.shutdown(wait=wait)

# AutoGen 작업을 워커 풀에서 실행
def execute_agent_task(task_config: dict) -> dict:
    """워커에서 실행되는 에이전트 작업"""
    from autogen import AssistantAgent, UserProxyAgent

    assistant = AssistantAgent(
        name="assistant",
        llm_config=task_config["llm_config"]
    )

    user_proxy = UserProxyAgent(
        name="user_proxy",
        human_input_mode="NEVER",
        code_execution_config=task_config.get("code_execution_config")
    )

    result = user_proxy.initiate_chat(
        assistant,
        message=task_config["message"],
        max_turns=task_config.get("max_turns", 10)
    )

    return {
        "summary": result.summary,
        "cost": result.cost,
        "message_count": len(result.chat_history)
    }

# 사용 예시
pool = WorkerPool(num_workers=4)

tasks = [
    {"message": "Task 1", "llm_config": llm_config},
    {"message": "Task 2", "llm_config": llm_config},
    {"message": "Task 3", "llm_config": llm_config}
]

futures = [pool.submit(execute_agent_task, task) for task in tasks]
results = [f.result() for f in futures]
```

## 큐 기반 처리

### Redis Queue 통합

```python
from redis import Redis
from rq import Queue, Worker
import json

# Redis 연결
redis_conn = Redis(host='localhost', port=6379)
task_queue = Queue('autogen_tasks', connection=redis_conn)
priority_queue = Queue('autogen_priority', connection=redis_conn)

def enqueue_agent_task(task_config: dict, priority: bool = False) -> str:
    """작업 큐에 추가"""
    q = priority_queue if priority else task_queue

    job = q.enqueue(
        execute_agent_task,
        task_config,
        job_timeout='30m',
        result_ttl=86400  # 24시간
    )

    return job.id

def get_job_status(job_id: str) -> dict:
    """작업 상태 조회"""
    from rq.job import Job

    job = Job.fetch(job_id, connection=redis_conn)

    return {
        "status": job.get_status(),
        "result": job.result if job.is_finished else None,
        "error": str(job.exc_info) if job.is_failed else None
    }

# 워커 실행 (별도 프로세스)
# rq worker autogen_priority autogen_tasks --with-scheduler
```

### Celery 통합

```python
from celery import Celery

celery_app = Celery(
    'autogen_tasks',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    task_track_started=True,
    task_time_limit=1800,  # 30분
    worker_prefetch_multiplier=1,
    worker_concurrency=4
)

@celery_app.task(bind=True, max_retries=3)
def process_agent_task(self, task_config: dict) -> dict:
    """Celery 태스크로 에이전트 실행"""
    try:
        result = execute_agent_task(task_config)
        return result
    except Exception as e:
        self.retry(exc=e, countdown=60)

# 태스크 체이닝
from celery import chain

workflow = chain(
    process_agent_task.s({"message": "Research", "llm_config": config}),
    process_agent_task.s({"message": "Analyze", "llm_config": config}),
    process_agent_task.s({"message": "Report", "llm_config": config})
)

result = workflow.apply_async()
```

## 부하 분산

### 라운드 로빈 로드 밸런서

```python
import itertools
from typing import List
from dataclasses import dataclass

@dataclass
class AgentInstance:
    """에이전트 인스턴스"""
    id: str
    endpoint: str
    weight: int = 1
    healthy: bool = True
    current_load: int = 0

class LoadBalancer:
    """로드 밸런서"""

    def __init__(self, instances: List[AgentInstance]):
        self.instances = instances
        self._round_robin = itertools.cycle(instances)

    def get_instance(self, strategy: str = "round_robin") -> AgentInstance:
        """인스턴스 선택"""
        if strategy == "round_robin":
            return self._round_robin_select()
        elif strategy == "least_connections":
            return self._least_connections_select()
        elif strategy == "weighted":
            return self._weighted_select()

    def _round_robin_select(self) -> AgentInstance:
        """라운드 로빈"""
        for _ in range(len(self.instances)):
            instance = next(self._round_robin)
            if instance.healthy:
                return instance
        raise Exception("No healthy instances available")

    def _least_connections_select(self) -> AgentInstance:
        """최소 연결"""
        healthy = [i for i in self.instances if i.healthy]
        if not healthy:
            raise Exception("No healthy instances available")
        return min(healthy, key=lambda x: x.current_load)

    def _weighted_select(self) -> AgentInstance:
        """가중치 기반"""
        import random
        healthy = [i for i in self.instances if i.healthy]
        if not healthy:
            raise Exception("No healthy instances available")

        total_weight = sum(i.weight for i in healthy)
        r = random.uniform(0, total_weight)

        current = 0
        for instance in healthy:
            current += instance.weight
            if r <= current:
                return instance

        return healthy[-1]

    def health_check(self):
        """헬스 체크"""
        for instance in self.instances:
            instance.healthy = self._check_health(instance)

    def _check_health(self, instance: AgentInstance) -> bool:
        """개별 헬스 체크"""
        import requests
        try:
            response = requests.get(f"{instance.endpoint}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
```

### API Gateway 패턴

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import httpx
import asyncio

app = FastAPI()

class APIGateway:
    """API 게이트웨이"""

    def __init__(self, load_balancer: LoadBalancer):
        self.lb = load_balancer
        self.rate_limiter = RateLimiter()
        self.circuit_breaker = CircuitBreaker()

    async def route_request(self, request: Request, path: str) -> dict:
        """요청 라우팅"""
        # Rate limiting
        client_id = request.client.host
        if not self.rate_limiter.allow(client_id):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

        # 인스턴스 선택
        instance = self.lb.get_instance()

        # Circuit breaker
        if not self.circuit_breaker.allow(instance.id):
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=request.method,
                    url=f"{instance.endpoint}{path}",
                    headers=dict(request.headers),
                    content=await request.body(),
                    timeout=60.0
                )

                self.circuit_breaker.record_success(instance.id)
                return response.json()

        except Exception as e:
            self.circuit_breaker.record_failure(instance.id)
            raise HTTPException(status_code=502, detail=str(e))

class RateLimiter:
    """레이트 리미터"""

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = {}

    def allow(self, client_id: str) -> bool:
        import time
        current_minute = int(time.time() / 60)

        if client_id not in self.requests:
            self.requests[client_id] = {}

        client_requests = self.requests[client_id]
        client_requests[current_minute] = client_requests.get(current_minute, 0) + 1

        # 이전 분 데이터 정리
        old_minutes = [m for m in client_requests if m < current_minute]
        for m in old_minutes:
            del client_requests[m]

        return client_requests[current_minute] <= self.requests_per_minute

class CircuitBreaker:
    """서킷 브레이커"""

    def __init__(self, failure_threshold: int = 5, recovery_time: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failures = {}
        self.open_time = {}

    def allow(self, instance_id: str) -> bool:
        import time

        if instance_id in self.open_time:
            if time.time() - self.open_time[instance_id] > self.recovery_time:
                # Half-open: 시도 허용
                del self.open_time[instance_id]
                self.failures[instance_id] = 0
            else:
                return False

        return True

    def record_success(self, instance_id: str):
        self.failures[instance_id] = 0

    def record_failure(self, instance_id: str):
        import time
        self.failures[instance_id] = self.failures.get(instance_id, 0) + 1

        if self.failures[instance_id] >= self.failure_threshold:
            self.open_time[instance_id] = time.time()
```

## 캐싱 전략

### 분산 캐시

```python
import redis
import json
import hashlib
from typing import Optional

class DistributedCache:
    """분산 캐시"""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)

    def _make_key(self, namespace: str, data: dict) -> str:
        """캐시 키 생성"""
        content = json.dumps(data, sort_keys=True)
        hash_value = hashlib.sha256(content.encode()).hexdigest()[:16]
        return f"{namespace}:{hash_value}"

    def get(self, namespace: str, data: dict) -> Optional[dict]:
        """캐시 조회"""
        key = self._make_key(namespace, data)
        cached = self.redis.get(key)

        if cached:
            return json.loads(cached)
        return None

    def set(self, namespace: str, data: dict, result: dict,
            ttl: int = 3600):
        """캐시 저장"""
        key = self._make_key(namespace, data)
        self.redis.setex(key, ttl, json.dumps(result))

    def invalidate(self, namespace: str, pattern: str = "*"):
        """캐시 무효화"""
        keys = self.redis.keys(f"{namespace}:{pattern}")
        if keys:
            self.redis.delete(*keys)

class CachedAgentService:
    """캐시가 적용된 에이전트 서비스"""

    def __init__(self, cache: DistributedCache):
        self.cache = cache

    async def execute_task(self, task_config: dict) -> dict:
        # 캐시 확인
        cached = self.cache.get("agent_tasks", task_config)
        if cached:
            return {"cached": True, "result": cached}

        # 실행
        result = execute_agent_task(task_config)

        # 캐시 저장 (성공한 경우만)
        if result.get("status") == "success":
            self.cache.set("agent_tasks", task_config, result, ttl=7200)

        return {"cached": False, "result": result}
```

## 수평 확장

### Kubernetes 배포

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autogen-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: autogen-worker
  template:
    metadata:
      labels:
        app: autogen-worker
    spec:
      containers:
      - name: worker
        image: autogen-worker:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai
        - name: REDIS_URL
          value: "redis://redis-service:6379"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: autogen-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: autogen-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: External
    external:
      metric:
        name: queue_length
      target:
        type: AverageValue
        averageValue: "5"
```

### Docker Compose 멀티 워커

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  worker:
    build: .
    command: python worker.py
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 2G
```

## 모범 사례

1. **무상태 설계**: 워커를 무상태로 설계하여 수평 확장 용이하게
2. **비동기 처리**: 긴 작업은 큐를 통해 비동기 처리
3. **캐시 활용**: 반복적인 쿼리 결과 캐싱
4. **헬스 체크**: 정기적인 인스턴스 상태 확인
5. **그레이스풀 셧다운**: 진행 중인 작업 완료 후 종료
6. **리소스 제한**: 컨테이너별 메모리/CPU 제한 설정
