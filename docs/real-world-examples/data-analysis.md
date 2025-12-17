---
sidebar_position: 2
---

# 데이터 분석 파이프라인

AutoGen을 활용한 자동화된 데이터 분석 시스템 구축 사례입니다.

## 시스템 아키텍처

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Data      │────▶│   Analyst   │────▶│  Visualizer │────▶│   Report    │
│   Agent     │     │   Agent     │     │   Agent     │     │   Agent     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Code Executor  │
                           └─────────────────┘
```

## 에이전트 구현

### Data Agent (데이터 로드 에이전트)

```python
from autogen import AssistantAgent, UserProxyAgent
import pandas as pd

data_agent = AssistantAgent(
    name="data_agent",
    system_message="""You are a data engineering expert.
Your responsibilities:
1. Load and validate data from various sources
2. Clean and preprocess data
3. Handle missing values and outliers
4. Create derived features when useful

Always use pandas for data manipulation.
Output clean, well-documented code.

When loading data, always:
- Check data types
- Report basic statistics
- Identify potential data quality issues
""",
    llm_config={
        "config_list": config_list,
        "temperature": 0.2
    }
)
```

### Analyst Agent (분석 에이전트)

```python
analyst_agent = AssistantAgent(
    name="analyst_agent",
    system_message="""You are a senior data analyst with expertise in statistical analysis.

Your responsibilities:
1. Perform exploratory data analysis (EDA)
2. Identify patterns and correlations
3. Conduct statistical tests when appropriate
4. Generate actionable insights

Analysis approach:
- Start with descriptive statistics
- Look for distributions and outliers
- Check correlations between variables
- Test hypotheses when relevant

Libraries to use:
- pandas for data manipulation
- numpy for numerical operations
- scipy for statistical tests
- Use appropriate statistical methods based on data characteristics

Always explain your findings in business terms.
""",
    llm_config={
        "config_list": config_list,
        "temperature": 0.3
    }
)
```

### Visualizer Agent (시각화 에이전트)

```python
visualizer_agent = AssistantAgent(
    name="visualizer_agent",
    system_message="""You are a data visualization specialist.

Your responsibilities:
1. Create clear, informative visualizations
2. Choose appropriate chart types for the data
3. Follow visualization best practices
4. Make charts publication-ready

Guidelines:
- Use matplotlib or seaborn
- Always include titles, labels, and legends
- Use color-blind friendly palettes
- Save figures to files

Chart selection:
- Distributions: histograms, box plots, violin plots
- Relationships: scatter plots, heatmaps
- Comparisons: bar charts, grouped bar charts
- Time series: line plots with proper date formatting
- Proportions: pie charts (sparingly), stacked bars

Always save plots as PNG files with descriptive names.
""",
    llm_config={
        "config_list": config_list,
        "temperature": 0.3
    }
)
```

### Report Agent (보고서 에이전트)

```python
report_agent = AssistantAgent(
    name="report_agent",
    system_message="""You are a business intelligence specialist.

Your responsibilities:
1. Synthesize analysis results into coherent narratives
2. Highlight key findings and insights
3. Provide actionable recommendations
4. Create executive summaries

Report structure:
1. Executive Summary (2-3 sentences)
2. Key Findings (bullet points)
3. Detailed Analysis (with supporting visualizations)
4. Recommendations (prioritized list)
5. Next Steps

Writing style:
- Clear and concise
- Business-focused language
- Data-driven conclusions
- Avoid technical jargon unless necessary
""",
    llm_config={
        "config_list": config_list,
        "temperature": 0.5
    }
)
```

## 분석 파이프라인 구현

```python
from autogen import GroupChat, GroupChatManager
import os
from datetime import datetime

class DataAnalysisPipeline:
    """데이터 분석 파이프라인"""

    def __init__(self, config_list: list, workspace: str = "analysis_workspace"):
        self.config_list = config_list
        self.workspace = workspace
        os.makedirs(workspace, exist_ok=True)

        self._setup_agents()

    def _setup_agents(self):
        """에이전트 설정"""
        self.data_agent = data_agent
        self.analyst_agent = analyst_agent
        self.visualizer_agent = visualizer_agent
        self.report_agent = report_agent

        self.executor = UserProxyAgent(
            name="executor",
            human_input_mode="NEVER",
            code_execution_config={
                "work_dir": self.workspace,
                "use_docker": False,
                "timeout": 120
            },
            is_termination_msg=lambda x: "ANALYSIS COMPLETE" in x.get("content", "")
        )

    def analyze(self, data_source: str, analysis_request: str) -> dict:
        """데이터 분석 실행"""
        # 그룹 채팅 설정
        groupchat = GroupChat(
            agents=[
                self.executor,
                self.data_agent,
                self.analyst_agent,
                self.visualizer_agent,
                self.report_agent
            ],
            messages=[],
            max_round=30,
            speaker_selection_method=self._select_speaker
        )

        manager = GroupChatManager(
            groupchat=groupchat,
            llm_config={"config_list": self.config_list}
        )

        # 분석 요청 메시지
        analysis_prompt = f"""
DATA ANALYSIS REQUEST

Data Source: {data_source}
Analysis Request: {analysis_request}

Please perform the following:
1. DATA_AGENT: Load and prepare the data
2. ANALYST_AGENT: Conduct statistical analysis
3. VISUALIZER_AGENT: Create visualizations
4. REPORT_AGENT: Generate the final report

Save all outputs to the workspace directory.
End with "ANALYSIS COMPLETE" when finished.
"""

        result = self.executor.initiate_chat(
            manager,
            message=analysis_prompt
        )

        return self._collect_results(result)

    def _select_speaker(self, last_speaker, groupchat) -> 'Agent':
        """발화자 선택 로직"""
        messages = groupchat.messages

        if not messages:
            return self.data_agent

        last_content = messages[-1].get("content", "").lower()

        # 워크플로우 기반 선택
        if last_speaker == self.data_agent:
            if "data loaded" in last_content or "data ready" in last_content:
                return self.analyst_agent
            return self.executor

        elif last_speaker == self.analyst_agent:
            if "analysis complete" in last_content:
                return self.visualizer_agent
            return self.executor

        elif last_speaker == self.visualizer_agent:
            if "visualization" in last_content and "saved" in last_content:
                return self.report_agent
            return self.executor

        elif last_speaker == self.report_agent:
            return self.executor

        elif last_speaker == self.executor:
            # 코드 실행 후 적절한 에이전트로 복귀
            for msg in reversed(messages[:-1]):
                if msg.get("name") in ["data_agent", "analyst_agent",
                                        "visualizer_agent", "report_agent"]:
                    name = msg.get("name")
                    return getattr(self, name)

        return self.data_agent

    def _collect_results(self, chat_result) -> dict:
        """결과 수집"""
        results = {
            "conversation": chat_result.chat_history,
            "summary": chat_result.summary,
            "cost": chat_result.cost,
            "files": []
        }

        # 생성된 파일 수집
        for filename in os.listdir(self.workspace):
            filepath = os.path.join(self.workspace, filename)
            if os.path.isfile(filepath):
                results["files"].append({
                    "name": filename,
                    "path": filepath,
                    "size": os.path.getsize(filepath)
                })

        return results

# 사용 예시
pipeline = DataAnalysisPipeline(config_list)

result = pipeline.analyze(
    data_source="sales_data.csv",
    analysis_request="""
    Analyze the sales data to answer:
    1. What are the overall sales trends?
    2. Which products are top performers?
    3. Are there seasonal patterns?
    4. What are the key factors affecting sales?

    Provide actionable recommendations for improving sales.
    """
)
```

## 구체적 분석 예시

### 매출 분석

```python
def analyze_sales_data():
    """매출 데이터 분석"""

    analysis_prompt = """
SALES DATA ANALYSIS

Data file: sales_2024.csv

Required analysis:
1. Monthly revenue trends
2. Product category performance
3. Regional sales comparison
4. Customer segment analysis
5. Year-over-year growth

Create the following visualizations:
- Monthly revenue trend line chart
- Product category bar chart
- Regional heatmap
- Customer segment pie chart

Generate an executive summary with:
- Top 3 insights
- Key performance indicators
- Recommendations for Q4
"""

    # 데이터 로드 코드 예시
    data_loading_code = '''
import pandas as pd
import numpy as np

# 데이터 로드
df = pd.read_csv('sales_2024.csv')

# 기본 정보 확인
print("=== Data Overview ===")
print(f"Shape: {df.shape}")
print(f"\\nColumns: {df.columns.tolist()}")
print(f"\\nData types:\\n{df.dtypes}")
print(f"\\nMissing values:\\n{df.isnull().sum()}")
print(f"\\nBasic statistics:\\n{df.describe()}")

# 날짜 변환
df['date'] = pd.to_datetime(df['date'])
df['month'] = df['date'].dt.month
df['year'] = df['date'].dt.year

# 데이터 품질 확인
print("\\n=== Data Quality Check ===")
print(f"Date range: {df['date'].min()} to {df['date'].max()}")
print(f"Unique products: {df['product'].nunique()}")
print(f"Unique regions: {df['region'].nunique()}")

print("\\nData loaded and validated successfully.")
'''

    # 분석 코드 예시
    analysis_code = '''
# 월별 매출 분석
monthly_revenue = df.groupby('month')['revenue'].sum()
print("=== Monthly Revenue ===")
print(monthly_revenue)

# 제품 카테고리별 분석
category_performance = df.groupby('category').agg({
    'revenue': 'sum',
    'quantity': 'sum',
    'order_id': 'count'
}).rename(columns={'order_id': 'orders'})
print("\\n=== Category Performance ===")
print(category_performance.sort_values('revenue', ascending=False))

# 지역별 분석
regional_sales = df.groupby('region')['revenue'].sum().sort_values(ascending=False)
print("\\n=== Regional Sales ===")
print(regional_sales)

# 통계적 분석
from scipy import stats

# 지역 간 매출 차이 검정 (ANOVA)
regions = df['region'].unique()
region_revenues = [df[df['region'] == r]['revenue'] for r in regions]
f_stat, p_value = stats.f_oneway(*region_revenues)
print(f"\\n=== Statistical Test: Regional Difference ===")
print(f"ANOVA F-statistic: {f_stat:.2f}, p-value: {p_value:.4f}")

print("\\nAnalysis complete.")
'''

    return analysis_prompt
```

### 고객 세그먼트 분석

```python
def customer_segmentation_analysis():
    """고객 세그먼트 분석"""

    prompt = """
CUSTOMER SEGMENTATION ANALYSIS

Perform RFM (Recency, Frequency, Monetary) analysis:

1. Calculate RFM metrics for each customer:
   - Recency: Days since last purchase
   - Frequency: Number of purchases
   - Monetary: Total spend

2. Create RFM segments:
   - Champions: High R, F, M
   - Loyal Customers: High F, M
   - At Risk: Low R, previously high F
   - Lost: Low R, F, M

3. Visualizations:
   - RFM score distribution
   - Segment size comparison
   - Segment characteristics radar chart

4. Recommendations:
   - Strategies for each segment
   - Retention priorities
   - Upselling opportunities
"""

    rfm_analysis_code = '''
import pandas as pd
import numpy as np
from datetime import datetime

# RFM 계산
reference_date = df['date'].max() + pd.Timedelta(days=1)

rfm = df.groupby('customer_id').agg({
    'date': lambda x: (reference_date - x.max()).days,  # Recency
    'order_id': 'count',  # Frequency
    'revenue': 'sum'  # Monetary
}).rename(columns={
    'date': 'recency',
    'order_id': 'frequency',
    'revenue': 'monetary'
})

# RFM 점수 부여 (1-5)
rfm['R_score'] = pd.qcut(rfm['recency'], 5, labels=[5,4,3,2,1])
rfm['F_score'] = pd.qcut(rfm['frequency'].rank(method='first'), 5, labels=[1,2,3,4,5])
rfm['M_score'] = pd.qcut(rfm['monetary'], 5, labels=[1,2,3,4,5])

# RFM 세그먼트 정의
def segment_customer(row):
    r, f, m = int(row['R_score']), int(row['F_score']), int(row['M_score'])

    if r >= 4 and f >= 4 and m >= 4:
        return 'Champions'
    elif f >= 4 and m >= 4:
        return 'Loyal Customers'
    elif r >= 4 and f <= 2:
        return 'New Customers'
    elif r <= 2 and f >= 3:
        return 'At Risk'
    elif r <= 2 and f <= 2:
        return 'Lost'
    else:
        return 'Regular'

rfm['segment'] = rfm.apply(segment_customer, axis=1)

# 세그먼트 분포
segment_dist = rfm['segment'].value_counts()
print("=== Customer Segments ===")
print(segment_dist)

# 세그먼트별 특성
segment_stats = rfm.groupby('segment').agg({
    'recency': 'mean',
    'frequency': 'mean',
    'monetary': ['mean', 'sum']
})
print("\\n=== Segment Characteristics ===")
print(segment_stats)
'''

    return prompt, rfm_analysis_code
```

## 자동 리포트 생성

```python
def generate_analysis_report(analysis_results: dict) -> str:
    """분석 결과 리포트 생성"""

    report_template = """
# Data Analysis Report
Generated: {timestamp}

## Executive Summary
{executive_summary}

## Key Findings
{key_findings}

## Detailed Analysis

### Data Overview
{data_overview}

### Statistical Analysis
{statistical_analysis}

### Visualizations
{visualizations}

## Recommendations
{recommendations}

## Appendix
- Analysis Cost: ${cost:.4f}
- Processing Time: {processing_time}
- Files Generated: {files_count}
"""

    report_agent_prompt = f"""
Based on the analysis conversation, generate a professional report.

Conversation summary:
{analysis_results.get('summary', '')}

Key metrics:
{analysis_results.get('metrics', {})}

Please provide:
1. A 2-3 sentence executive summary
2. Top 5 key findings as bullet points
3. 3-5 actionable recommendations prioritized by impact
"""

    # 리포트 생성
    user_proxy = UserProxyAgent(name="reporter", human_input_mode="NEVER")

    result = user_proxy.initiate_chat(
        report_agent,
        message=report_agent_prompt,
        max_turns=2
    )

    return result.chat_history[-1]["content"]
```

## 스케줄링 및 자동화

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

class ScheduledAnalysisPipeline:
    """스케줄된 분석 파이프라인"""

    def __init__(self, pipeline: DataAnalysisPipeline):
        self.pipeline = pipeline
        self.scheduler = BackgroundScheduler()

    def schedule_daily_analysis(self, data_source: str, analysis_type: str,
                                 hour: int = 6, minute: int = 0):
        """일일 분석 스케줄"""
        self.scheduler.add_job(
            func=self._run_analysis,
            trigger=CronTrigger(hour=hour, minute=minute),
            args=[data_source, analysis_type],
            id=f"daily_{analysis_type}",
            replace_existing=True
        )

    def schedule_weekly_report(self, data_source: str, day_of_week: str = 'mon',
                               hour: int = 9):
        """주간 리포트 스케줄"""
        self.scheduler.add_job(
            func=self._run_weekly_report,
            trigger=CronTrigger(day_of_week=day_of_week, hour=hour),
            args=[data_source],
            id="weekly_report",
            replace_existing=True
        )

    def _run_analysis(self, data_source: str, analysis_type: str):
        """분석 실행"""
        result = self.pipeline.analyze(data_source, analysis_type)
        self._notify_completion(result)

    def _run_weekly_report(self, data_source: str):
        """주간 리포트 실행"""
        result = self.pipeline.analyze(
            data_source,
            "Generate comprehensive weekly performance report"
        )
        self._send_report(result)

    def _notify_completion(self, result: dict):
        """완료 알림"""
        # Slack, Email 등으로 알림
        pass

    def _send_report(self, result: dict):
        """리포트 전송"""
        # 리포트 PDF 생성 및 이메일 전송
        pass

    def start(self):
        self.scheduler.start()

    def stop(self):
        self.scheduler.shutdown()

# 사용 예시
scheduled_pipeline = ScheduledAnalysisPipeline(pipeline)
scheduled_pipeline.schedule_daily_analysis("sales_data.csv", "daily_sales_summary", hour=7)
scheduled_pipeline.schedule_weekly_report("sales_data.csv", day_of_week='mon', hour=9)
scheduled_pipeline.start()
```

## 배포 고려사항

- 대용량 데이터는 샘플링 또는 청크 처리
- 코드 실행 환경 보안 (Docker 권장)
- 분석 결과 버전 관리
- 민감 데이터 마스킹
- 분석 재현성 보장 (시드 설정)
