# Prompts Collection

This document contains various prompts used for developing the Sales Pitch Practice Platform.

---

## 1. Cursor Base Prompt

**Purpose**: Base system prompt for Cloudflare Workers development

```
<system_context>
You are an advanced assistant specialized in generating Cloudflare Workers code. You have deep knowledge of Cloudflare's platform, APIs, and best practices.
</system_context>

<behavior_guidelines>

- Respond in a friendly and concise manner
- Focus exclusively on Cloudflare Workers solutions
- Provide complete, self-contained solutions
- Default to current best practices
- Ask clarifying questions when requirements are ambiguous

</behavior_guidelines>

----REST OF THE PROMPT REDACTED-----
LINK : https://developers.cloudflare.com/workers/get-started/prompting/
```

---

## 2. Product Specifications Prompt

**Purpose**: Detailed product specifications for the Sales Pitch Practice Platform

### Overview
I'm building a **Sales Pitch Practice Platform** - a web application that helps sales professionals practice and improve their pitching skills through AI-powered interactive scenarios. Here are the high-level product specifications:

### Core Features

#### Interactive Practice Sessions
- Users engage in real-time text and voice conversations with AI-powered customer personas
- 5 predefined sales scenarios with distinct customer profiles (e.g., skeptical buyer, indecisive buyer, technical expert, impatient buyer)
- Each scenario includes product information, customer background, challenge description, and success criteria
- Voice input/output support using Web Speech API (browser-native STT/TTS)

#### AI Customer Personas
- Context-aware AI agents that role-play as different customer types
- Each persona has unique personality traits, communication styles, concerns, and buying behaviors
- Personas adapt their responses based on conversation history and user approach
- Powered by Llama 3.3 70B model via Cloudflare Workers AI

#### Real-Time Chat Interface
- Server-Sent Events (SSE) streaming for real-time AI response display
- Conversation history persistence across sessions
- Sidebar showing scenario information (customer profile, product details, challenge, success criteria)
- Tab navigation between scenario info and chat interface

#### Comprehensive Feedback Generation
- Multi-agent AI workflow that analyzes conversations after completion
- 3-step sequential pipeline:
  - **Transcript Analyzer**: High-level analysis, segmentation, strengths/weaknesses identification
  - **Summary Analyzer**: Overall performance ratings across 8 dimensions (Empathy, Clarity, Assertiveness, Persuasion, Active Listening, Objection Handling, Closing Ability, Flexibility)
  - **Detail Agent**: Phrase-level annotations with specific suggestions for each conversation segment
- Feedback includes annotated transcripts with highlighted segments and inline comments

#### Performance Analytics & Reporting
- Detailed feedback reports with tabbed navigation (Summary, Evaluation, Annotations)
- Score visualization using progress bars for each performance dimension
- Session history dashboard showing overall statistics and average scores across all completed scenarios
- Collapsible session history with conversation summaries and performance analysis
- Chat assistant integrated into report page for asking questions about feedback

#### Data Persistence
- Conversation storage (messages, threads, timestamps)
- Feedback report storage (segmented analysis, summary analysis, detailed feedback)
- User score tracking per session (8 performance dimensions)
- Session state management

### Technical Requirements
- Real-time streaming for AI responses (low latency)
- Persistent storage for conversations, reports, and scores
- Session state management for temporary data
- Global edge distribution for low latency worldwide
- Cost-effective scaling for AI inference workloads
- Voice processing (client-side using Web Speech API)

### Current Implementation (Cloudflare Stack)
- **Frontend**: React 19 + TypeScript, deployed on Cloudflare Pages
- **Backend**: Cloudflare Workers (API endpoints)
- **AI**: Cloudflare Workers AI (Llama 3.3 70B)
- **Database**: Cloudflare D1 (SQLite-based edge database)
- **Session Storage**: Cloudflare KV Namespaces
- **Streaming**: Server-Sent Events (SSE)

---

## 3. System Design Request Prompt

**Purpose**: Request for comprehensive system design architecture recommendations

### Request
Given these product specifications, please consider and recommend a **system design architecture using the Cloudflare Developer Platform** that can effectively implement all these features. Specifically, I'd like you to:

#### Architecture Overview
Propose a high-level architecture diagram showing how different Cloudflare services interact (Workers, Workers AI, D1, KV, Pages, etc.)

#### Data Flow Design
Explain the data flow for:
- Real-time chat interactions
- Feedback generation workflow
- Session management
- Report retrieval and display

#### Storage Strategy
Recommend optimal storage patterns:
- What data should go in D1 vs KV?
- How to structure database schemas for conversations, messages, reports, and scores?
- Caching strategies for frequently accessed data

#### AI Workflow Design
Design the multi-agent feedback generation pipeline:
- How to orchestrate sequential AI agent calls?
- How to handle long-running workflows (30-60 seconds)?
- Error handling and retry strategies for AI inference

#### Performance Optimization
Suggest optimizations for:
- Reducing feedback generation latency
- Improving real-time chat responsiveness
- Scaling AI inference workloads cost-effectively
- Minimizing database query overhead

#### Edge Computing Considerations
Leverage Cloudflare's edge network:
- How to minimize latency for global users?
- Where should computation happen (edge vs origin)?
- How to handle state synchronization across edge locations?

#### Future Scalability
Design for future features:
- User authentication and multi-user support
- Team management dashboard (managers viewing team member reports)
- Custom scenario creation
- Real-time collaboration features

#### Cost Optimization
Recommend strategies to:
- Minimize Workers AI inference costs
- Optimize D1 database usage
- Reduce KV namespace operations
- Cache expensive operations

### Expected Output
Please provide a comprehensive system design that addresses these considerations while leveraging the strengths of Cloudflare's edge computing platform. Include specific recommendations for service selection, data modeling, workflow orchestration, and performance optimization.

**Note**: The application is already partially implemented using the Cloudflare stack, but I'm seeking expert recommendations to optimize the architecture, improve performance, and ensure scalability as we add more features.

---

## 4. Implementation Roadmap Prompt

**Purpose**: Request for step-by-step implementation roadmap and boilerplate code generation

### Context
You are my senior architect and tech lead.

I want to build a small web app that coaches people on sales / negotiation conversations using AI agents. The core loop:

- The app generates a realistic **ROLEPLAY SCENARIO** (e.g., product pitch, upsell, or negotiation).
- It simulates a **CUSTOMER PERSONA** with traits (knowledge level, sentiment, skepticism, etc.).
- I talk to this customer through a chat UI (later voice), and the AI responds in character.
- At the end, an **EVALUATION ENGINE** scores my performance (clarity, empathy, persuasion, handling objections, etc.) and gives an annotated transcript + suggestions and next-scenario ideas.
- Over time, a **DASHBOARD** shows my progress across scenarios and skills.

### Tech Stack
The tech stack is **Cloudflare-first**:
- **Backend**: Cloudflare Workers (TypeScript)
- **Frontend**: React on Cloudflare Pages (minimal but usable UI)
- **AI**: Cloudflare Workers AI (Llama 3.3 or similar)
- **Storage**: D1 (core entities: scenarios, conversations, messages, evaluations, sessions/users) + KV for lightweight session mapping and caching

### Request
Implement the boilerplate code that generates and connects the system components we have discussed.

Your job **right now** is ONLY to generate a **step-by-step implementation roadmap**, not code.

After implementation, generate a report that discusses any issues that arose, for later debugging purposes.

---

## 5. Modular Development Prompt

**Purpose**: Request for phased, modular implementation approach

### Overview
I'm building a small MVP of a **"Sales & Customer Support Practice Platform"** on the Cloudflare stack. You are my lead engineer. I want you to generate code in **small, modular phases**, not in one huge dump.

### App Concept
Goal: A web app where users practice persuasive sales conversations (pitching products, handling objections, closing deals). The flow:

1. User selects one of **5 predefined scenarios** (e.g., "SaaS Productivity App to Indecisive Buyer", "Premium AI Chatbot to Skeptical Technical Buyer", "Warranty Upsell to Annoyed Customer", etc.).
2. App loads an **AI customer persona** with traits: knowledge level, attitude, communication style, biases, concerns, behaviors.
3. User holds a **conversation** (text + voice via Web Speech API), trying to persuade/close.
4. At the end, the app generates:
   - **Structured evaluation**: 8 performance scores (Empathy, Clarity, Assertiveness, Persuasion, Active Listening, Objection Handling, Closing Ability, Flexibility) + narrative feedback.
   - **Annotated transcript**: Segmented conversation with phrase-level comments.
   - **Session history**: Dashboard showing overall stats and past practice sessions.

### Tech Stack
Built on the Cloudflare stack:
- **Frontend**: Cloudflare Pages + React + TypeScript (clean UI with Tailwind CSS)
- **Backend**: Cloudflare Workers (API endpoints)
- **AI**: Workers AI (Llama 3.3 70B) for:
  - Customer persona responses (context-aware, scenario-specific)
  - 3-step feedback pipeline: Transcript Analyzer → Summary Analyzer → Detail Agent
- **Storage**:
  - D1 Database: conversations, messages, feedback reports, user scores
  - KV Namespaces: session state
- **Streaming**: Server-Sent Events (SSE) for real-time AI responses
- **Voice**: Web Speech API (browser-native STT/TTS, not Workers AI)

### Development Approach
You MUST behave like a staff engineer guiding a junior dev:
- First: design & explain
- Then: implement **only the current phase** with code, cleanly separated into files
- Do NOT jump ahead and implement everything in one shot
- Always keep the code modular and consistent across phases

### Phases
1. **Phase 0** – Skeleton & Config
2. **Phase 1** – Static UI + Predefined Scenarios
3. **Phase 2** – Conversation Engine (Text Chat with SSE Streaming)
4. **Phase 3** – Feedback Generation Workflow (3-Step Pipeline)
5. **Phase 4** – Report Page with Annotated Transcript
6. **Phase 5** – Session History & Home Dashboard
7. **Phase 6** – Voice Input/Output (Web Speech API)

---

## Notes

- All prompts assume no prior repository; design everything fresh
- Code should be modular, TypeScript-based, and follow Cloudflare best practices
- Implementation should be phased and incremental
- Each phase should be fully buildable/runnable on its own

[README PROMPT]
generate a read me that specifies product specs, local run instructions, system design architecture, and future improvments, in semi formal style