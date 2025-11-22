/**
 * Scenario Generator Agent
 * 
 * Generates dynamic sales-training scenarios using LLM
 * Ensures difficulty distribution: ~33% Easy, ~33% Medium, ~33% Hard
 */

import { Env } from "../../types";
import { retryWithBackoff } from "../utils/retryUtils";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT = `You are ScenarioGeneratorAgent.

Your job is to generate a SINGLE sales-training scenario each time you are called.

The scenario must:
- Be realistic, detailed, and roleplay-ready.
- Include a product/service to sell (NOT always software).
- Include a customer persona with varied and randomized traits.
- Include context, constraints, emotional dynamics, and success criteria.
- Be structured and rich enough for downstream agents to run conversations.

DIFFICULTY DISTRIBUTION REQUIREMENT:
To ensure balanced training, distribute difficulty evenly across scenarios:
- **Easy (~33%)**: Customer is curious/friendly, novice knowledge level, no major objections, straightforward needs, low stakes
- **Medium (~33%)**: Customer has some skepticism or past experience, intermediate knowledge, some objections to handle, moderate stakes
- **Hard (~33%)**: Customer is expert/misinformed, hostile/skeptical, complex emotional dynamics, high-stakes objections, high time pressure

When generating scenarios:
1. Randomly select difficulty level (easy/medium/hard)
2. Match customer traits to difficulty:
   - Easy: curious + novice + friendly
   - Medium: skeptical + intermediate + had past experience
   - Hard: expert/misinformed + hostile + personal trauma
3. Ensure product complexity matches difficulty
4. Ensure success criteria match difficulty level

MANDATORY RANDOMIZATION CATEGORIES
Every scenario MUST randomly vary the following:

1. DOMAIN (choose one):
   - consumer_product (e.g., blender, vacuum, skincare)
   - subscription_service (gym plan, tutoring membership)
   - travel_or_experience (hotel stay, retreat, tour)
   - automotive (car sale, warranty)
   - home_service (cleaning, lawn care, home security)
   - education_or_coaching (mentorship, online course)
   - financial_or_insurance (credit card, insurance plan)

2. CUSTOMER KNOWLEDGE LEVEL:
   - novice
   - intermediate
   - expert
   - misinformed (confident but wrong)

3. EMOTIONAL ORIENTATION (pick 1–2):
   - curious, excited, friendly
   - anxious, overwhelmed, embarrassed
   - skeptical, distrustful, hostile
   - impatient, sarcastic, overconfident

4. PREVIOUS EXPOSURE / ATTITUDE:
   - loved a competitor
   - had a horrible past experience
   - never used anything similar
   - tried once and failed
   - pushed into the meeting by boss/family
   - nostalgic or sentimental connection
   - personal trauma tied to product category

5. RELATIONSHIP TO SELLER:
   - stranger
   - repeat_customer
   - referred_by_friend
   - family_member
   - coworker
   - boss_or_manager

6. CONTEXT COMPLEXITY:
   - time_pressure: low | moderate | high
   - stakes: low | medium | high
   - setting: (randomized environment)
       • retail store
       • phone call
       • kiosk booth
       • doorstep pitch
       • car dealership
       • Zoom meeting
       • farmer's market
       • airport lounge, etc.

WHAT TO OUTPUT
Always output a single JSON object with these sections:

{
  "scenario_title": "...",
  "difficulty": "easy|medium|hard",
  "product": {
    "name": "...",
    "description": "...",
    "features": ["...", "..."],
    "pricing": "...",
    "keyBenefits": ["...", "..."]
  },
  "customer": {
    "name": "...",
    "age": number,
    "profession": "...",
    "knowledge": "...",
    "attitude": "...",
    "communicationStyle": "...",
    "biases": "...",
    "concerns": ["...", "..."],
    "behaviors": ["...", "..."],
    "history": "..."
  },
  "challenge": "...",
  "successCriteria": ["...", "..."],
  "interaction_context": {
    "setting": "...",
    "time_pressure": "...",
    "stakes": "..."
  },
  "training_objectives": ["...", "..."],
  "welcomeMessage": "..."
}

SCENARIO DESIGN RULES
- Make the customer HUMAN (quirks, thinking patterns, biases).
- Include emotional/behavioral triggers the trainee must navigate.
- Include hidden factors only the agent knows.
- Make scenarios diverse across runs.
- Keep product descriptions realistic and specific.
- REPEAT NOTHING from previous scenarios unless the user requests.
- Match difficulty to complexity: Easy = simple needs, Medium = some objections, Hard = expert/hostile/complex

DO NOT EXPLAIN YOURSELF.
DO NOT ADD TEXT OUTSIDE THE JSON.
Return ONLY the scenario JSON object.`;

export interface GeneratedScenario {
  scenario_title: string;
  difficulty: "easy" | "medium" | "hard";
  product: {
    name: string;
    description: string;
    features: string[];
    pricing: string;
    keyBenefits: string[];
  };
  customer: {
    name: string;
    age?: number;
    profession?: string;
    knowledge: string;
    attitude: string;
    communicationStyle: string;
    biases: string;
    concerns?: string[];
    behaviors: string[];
    history?: string;
  };
  challenge: string;
  successCriteria: string[];
  interaction_context: {
    setting: string;
    time_pressure: string;
    stakes: string;
  };
  training_objectives: string[];
  welcomeMessage: string;
}

export interface GenerateScenarioInput {
  previousScenarios?: string[]; // Titles of previously generated scenarios to avoid duplicates
  preferredDifficulty?: "easy" | "medium" | "hard"; // Optional: request specific difficulty
}

/**
 * Generate a new sales training scenario
 */
export async function generateScenario(
  input: GenerateScenarioInput,
  env: Env
): Promise<GeneratedScenario> {
  try {
    const { previousScenarios = [], preferredDifficulty } = input;

    // Build prompt with context
    let prompt = "Generate a new sales training scenario.";
    
    if (previousScenarios.length > 0) {
      prompt += `\n\nPreviously generated scenarios (DO NOT repeat these):\n${previousScenarios.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    }
    
    if (preferredDifficulty) {
      prompt += `\n\nPreferred difficulty: ${preferredDifficulty}`;
    }

    // Build messages for Workers AI
    const messages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: prompt,
      },
    ];

    // Call Workers AI
    if (!env.AI) {
      throw new Error("Workers AI binding not available. Run with 'npm run dev:remote' for AI testing.");
    }

    const response = await retryWithBackoff(
      async () => {
        return await env.AI.run(MODEL_ID, {
          messages: messages,
          max_tokens: 2048,
          temperature: 0.8, // Higher temperature for creativity
        });
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
      }
    );

    // Parse response
    let responseText = "";
    const responseObj = response as any;

    if (typeof responseObj === "string") {
      responseText = responseObj;
    } else if (responseObj.response) {
      if (typeof responseObj.response === "string") {
        responseText = responseObj.response;
      } else if (responseObj.response.text) {
        responseText = responseObj.response.text;
      } else if (responseObj.response.response) {
        responseText = typeof responseObj.response.response === "string"
          ? responseObj.response.response
          : responseObj.response.response.text || "";
      }
    } else if (responseObj.text) {
      responseText = responseObj.text;
    } else if (responseObj.content) {
      responseText = responseObj.content;
    } else if (responseObj.message) {
      responseText = typeof responseObj.message === "string"
        ? responseObj.message
        : responseObj.message.content || "";
    } else if (responseObj.choices && responseObj.choices[0]) {
      responseText = responseObj.choices[0].message?.content || "";
    }

    if (!responseText) {
      console.error("[scenarioGenerator] Failed to extract text from AI response:", responseObj);
      throw new Error("Failed to extract text from AI response");
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find JSON object directly
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonText = jsonObjectMatch[0];
      }
    }

    // Parse JSON
    try {
      const scenario = JSON.parse(jsonText) as GeneratedScenario;
      
      // Validate required fields
      if (!scenario.scenario_title || !scenario.product || !scenario.customer) {
        throw new Error("Generated scenario missing required fields");
      }

      return scenario;
    } catch (parseError) {
      console.error("[scenarioGenerator] JSON parse error:", parseError);
      console.error("[scenarioGenerator] Response text:", responseText);
      throw new Error(`Failed to parse scenario JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("[scenarioGenerator] Error generating scenario:", error);
    throw error;
  }
}

