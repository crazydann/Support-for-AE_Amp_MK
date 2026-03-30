---
name: agent-analytics-audit
description: >
  Runs a comprehensive AI agent adoption and quality audit for any Amplitude customer org. Analyses Global Chat usage, user adoption tiers, failure root causes, sentiment, and generates AI context recommendations to improve accuracy.
---

# Agent Analytics Audit

## Purpose

Generate a comprehensive adoption and quality audit of Amplitude's AI agents for any customer
org. The audit profiles every user, categorises them into adoption tiers, maps use-case themes,
identifies failure patterns, and produces actionable recommendations for improving AI context
configuration to boost accuracy.

This skill is designed for CSMs, PSPs, and Solutions Architects who need to understand whether
AI features are delivering value for their accounts and what to do if they're not.

---

## Critical Rules

1. **Never assume a customer.** Always ask for the org name or org ID before running any queries.
2. **Never hardcode property names, event names, or project IDs.** Every customer's taxonomy is different — extract these from the data.
3. **Start broad, then drill deep.** Get the full picture first, then zoom into the interesting segments.
4. **Always filter to Global Chat** (or whichever agent the user specifies) for the detailed analysis. The overview can include all agents.
5. **Present findings with a visualisation** using the Visualizer tool before the prose summary.

---

## Workflow

### Phase 0: Identify the customer

Before doing anything, ask the user:

> "Which customer would you like me to audit? Please provide the **org name** (e.g., 'Acme Corp') or the **org ID** (e.g., '326664'). I'll also need to know the time range — default is last 90 days."

Wait for the user's response. Do not proceed until you have at minimum:
- A customer name OR org ID
- A time range (default to last 90 days if not specified)

If the user also specifies a particular agent (e.g., "just Global Chat" or "all agents"), note that for Phase 2.

---

### Phase 1: High-level overview (all agents)

Run these queries to get the full picture across all agents:

**Query 1 — User-level aggregation:**
```
query_agent_analytics_sessions:
  customerName: "<customer>"  (OR customerOrgIds: ["<org_id>"])
  groupBy: ["user_id"]
  limit: 200
  startDate: "<start_date>"
```

**Query 2 — Agent-level aggregation:**
```
query_agent_analytics_sessions:
  customerName: "<customer>"
  groupBy: ["agent_name"]
  limit: 200
  startDate: "<start_date>"
```

**Query 3 — Topic-level aggregation:**
```
query_agent_analytics_sessions:
  customerName: "<customer>"
  groupBy: ["primary_topic"]
  limit: 200
  startDate: "<start_date>"
```

From these three queries, extract:
- **Total sessions** and **unique users**
- **Agent distribution** — which agents are being used and how much
- **Top users** — sorted by session count
- **Top topics** — what use cases are being solved
- **Overall quality score**, **failure rate**, and **total cost**

---

### Phase 2: Deep-dive on the target agent

Default to **Global Chat** unless the user specified otherwise. Filter all queries in this phase to the target agent.

**Query 4 — User-level detail for target agent:**
```
query_agent_analytics_sessions:
  agentNames: ["Global Chat"]
  customerName: "<customer>"
  groupBy: ["user_id"]
  limit: 200
  startDate: "<start_date>"
```

**Query 5 — Negative feedback sessions (detailed):**
```
query_agent_analytics_sessions:
  agentNames: ["Global Chat"]
  customerName: "<customer>"
  hasNegativeFeedback: true
  limit: 15
  responseFormat: "detailed"
  startDate: "<start_date>"
```

**Query 6 — Failed sessions (detailed):**
```
query_agent_analytics_sessions:
  agentNames: ["Global Chat"]
  customerName: "<customer>"
  hasTaskFailure: true
  limit: 15
  responseFormat: "detailed"
  startDate: "<start_date>"
```

Build a **User Adoption Profile** for each user with 3+ sessions:
- Name / email
- Session count, quality score, failure rate
- Top use cases, top failure reasons
- Negative feedback phrases

**Classify users into adoption tiers:**
- **Power users**: 5+ sessions
- **Moderate users**: 2–4 sessions
- **One-time users**: 1 session (retention risk)

---

### Phase 3: Failure root cause analysis

Categorise every failure into:
1. **Invalid chart definitions** — wrong properties, invalid types
2. **Tool timeouts / errors** — backend tool call failures
3. **Truncated / incomplete responses**
4. **Missing properties in taxonomy**
5. **Incorrect data in responses**
6. **Capability gaps** — user asks for unsupported actions

---

### Phase 4: AI context recommendations

Generate specific recommendations:
1. Taxonomy mapping document (if invalid chart definition failures > 20%)
2. Common KPI definitions
3. Property availability disclaimer
4. Entity name lookup guidance
5. Multi-project awareness
6. Feature limitation clarity

---

### Phase 5: Final report

1. **Executive summary** — 3-sentence headline
2. **Adoption scorecard** — users, sessions, tier breakdown, quality, failure rate
3. **User profiles** — top power users with success/failure patterns
4. **Use case themes** — categorised list
5. **Failure root causes** — categorised with counts, percentages, examples
6. **Sentiment analysis** — negative feedback themes
7. **AI context recommendations** — specific implementable changes
8. **Retention risk assessment** — at-risk users

---

## Quality Score Reference
- Above 0.7 = good
- 0.4–0.7 = average
- Below 0.4 = poor
- Below 0.4 sentiment = frustrated user

## Tips
- Default time range: 90 days
- Agent name casing matters — use exact names from schema
- Detailed format cap: 15 sessions per query
