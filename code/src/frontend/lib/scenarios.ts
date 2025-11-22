/**
 * Scenario Definitions
 * 
 * Five predefined sales scenarios with customer profiles and product information
 */

export interface CustomerProfile {
  name: string;
  age?: number;
  profession?: string;
  knowledge: string;
  attitude: string;
  communicationStyle: string;
  biases?: string;
  concerns?: string[];
  behaviors: string[];
  traits?: string[];
  context?: string;
}

export interface ProductInfo {
  name: string;
  description: string;
  features: string[];
  pricing: string;
  keyBenefits?: string[];
}

export interface Scenario {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Medium-Hard";
  customer: CustomerProfile;
  product: ProductInfo & { price: string }; // Ensure price field exists
  challenge: string;
  successCriteria: string[];
  welcomeMessage: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "scenario-1",
    title: "Selling a SaaS Productivity App to a Friendly but Indecisive Buyer",
    difficulty: "Easy",
    customer: {
      name: "Customer",
      profession: "Operations Manager",
      knowledge: "Moderate - familiar with productivity tools but cautious",
      attitude: "Agreeable and polite, but risk-averse and slow to commit",
      communicationStyle: "Patient listener, asks gentle but probing questions",
      traits: [
        "Agreeable and polite",
        "Risk-averse and slow to commit",
        "Needs reassurance, hates being 'sold to'",
        "Values practicality and reliability"
      ],
      behaviors: [
        "Will listen patiently",
        "Will ask gentle but probing 'Is this realistic?' type questions",
        "Highly budget-conscious"
      ],
      concerns: [
        "Budget constraints",
        "Whether the solution is realistic for her team",
        "Risk of commitment"
      ],
      context: "Rachel's team currently uses spreadsheets + manual coordination. They've missed deadlines twice this quarter. Her director told her to 'find something better, but don't overspend.'"
    },
    product: {
      name: "FlowPilot",
      description: "A team productivity platform with AI-driven task prioritization, automatic meeting summarization, team analytics dashboard, and Slack & email integrations.",
      features: [
        "AI-driven task prioritization",
        "Automatic meeting summarization",
        "Team analytics dashboard",
        "Slack & email integrations"
      ],
      pricing: "$20/user/mo",
      keyBenefits: [
        "Improve team coordination",
        "Reduce missed deadlines",
        "Better visibility into team workload"
      ]
    },
    challenge: "Motivate the customer with low-pressure persuasion, address concerns without overwhelming them, and move them from 'maybe later' to 'worth trying' (trial sign-up).",
    successCriteria: [
      "Motivate the customer with low-pressure persuasion",
      "Address concerns without overwhelming them",
      "Move them from 'maybe later' → 'worth trying' (trial sign-up)"
    ],
    welcomeMessage: "Hello! I'm an Operations Manager. I'm looking for a productivity solution for my team, but I need to be careful about budget. Can you tell me about FlowPilot?"
  },
  {
    id: "scenario-2",
    title: "Selling a Premium AI Chatbot System to a Skeptical Technical Buyer",
    difficulty: "Medium",
    customer: {
      name: "Customer",
      profession: "CTO of a mid-size e-commerce brand",
      knowledge: "Highly technical - expert in AI/ML systems",
      attitude: "Highly analytical, skeptical by default, direct and blunt",
      communicationStyle: "Direct, blunt, interrupts if you ramble",
      traits: [
        "Highly analytical",
        "Skeptical by default",
        "Direct, blunt communicator",
        "Hates 'fluffy marketing claims'",
        "Will test your technical knowledge"
      ],
      behaviors: [
        "Pushes back on unclear claims",
        "Interrupts if you ramble",
        "Asks questions like 'What's the actual LLM latency? Don't give me marketing fluff.'"
      ],
      concerns: [
        "Technical accuracy and reliability",
        "Integration complexity",
        "Past failures with similar products"
      ],
      context: "The customer previously bought a chatbot product that failed miserably— hallucinations, slow responses, poor integration. Their trust is low."
    },
    product: {
      name: "ConversoAI",
      description: "An AI chatbot platform for customer service with retrieval-augmented Q&A, customizable persona + tone, integration with CRM + billing systems, and automatic escalation detection.",
      features: [
        "Retrieval-augmented Q&A",
        "Customizable persona + tone",
        "Integration with CRM + billing systems",
        "Automatic escalation detection"
      ],
      pricing: "$8k annual license",
      keyBenefits: [
        "Accurate, reliable customer service automation",
        "Seamless integration with existing systems",
        "Proven technical performance"
      ]
    },
    challenge: "Demonstrate technical credibility, provide real metrics (latency, accuracy, downtime guarantees), rebuild trust by acknowledging concerns, and get them to agree to a technical demo.",
    successCriteria: [
      "Demonstrate technical credibility",
      "Provide real metrics (latency, accuracy, downtime guarantees)",
      "Rebuild trust by acknowledging concerns",
      "Get him to agree to a technical demo"
    ],
    welcomeMessage: "Hi, I'm a CTO. I'm evaluating ConversoAI, but I've been burned by chatbot products before. I need real technical details, not marketing fluff. What can you tell me?"
  },
  {
    id: "scenario-3",
    title: "Selling a Warranty Upsell at a Retail Electronics Store (Annoyed Customer)",
    difficulty: "Medium",
    customer: {
      name: "Customer",
      profession: "Customer buying a laptop",
      knowledge: "Basic consumer knowledge",
      attitude: "Irritable and impatient",
      communicationStyle: "Short, clipped responses",
      traits: [
        "Irritable and impatient",
        "Feels salespeople 'always try to upsell BS'",
        "Values time over money"
      ],
      behaviors: [
        "Short, clipped responses",
        "Quick to dismiss offers",
        "Might say things like 'Just ring it up, man.'"
      ],
      concerns: [
        "Wasting more time",
        "Being upsold unnecessary products"
      ],
      context: "The customer already waited 25 minutes in line. They're frustrated. You have 20 seconds to pitch an upsell that doesn't feel pushy."
    },
    product: {
      name: "3-Year Device Protection Plan",
      description: "Comprehensive protection including accidental damage coverage, battery replacement, and express repair service.",
      features: [
        "Accidental damage coverage",
        "Battery replacement",
        "Express repair service"
      ],
      pricing: "$79 flat price",
      keyBenefits: [
        "Peace of mind",
        "Quick repair service",
        "Battery replacement included"
      ]
    },
    challenge: "Stay calm, polite, and concise. Provide value in under 2 sentences. Avoid triggering defensiveness. Ideally: get him to say 'Fine, I'll add it.'",
    successCriteria: [
      "Stay calm, polite, and concise",
      "Provide value in under 2 sentences",
      "Avoid triggering defensiveness",
      "Ideally: get him to say 'Fine, I'll add it.'"
    ],
    welcomeMessage: "Look, I've been waiting 25 minutes. I just want this laptop. Can we just ring it up?"
  },
  {
    id: "scenario-4",
    title: "Negotiating Price With a Hardball B2B Procurement Manager",
    difficulty: "Medium",
    customer: {
      name: "Customer",
      profession: "Procurement Lead at logistics company",
      knowledge: "Expert in procurement and negotiation",
      attitude: "Classic hard negotiator, emotionally detached",
      communicationStyle: "Uses silence as a tactic, skilled at 'anchoring' low",
      traits: [
        "Classic hard negotiator",
        "Emotionally detached",
        "Will use silence as a tactic",
        "Skilled at 'anchoring' low"
      ],
      behaviors: [
        "Starts by saying: 'Your competitors offer the same for 30% less.'",
        "Claims she has alternatives even when she doesn't",
        "Will pressure you about price, terms, and discounts"
      ],
      concerns: [
        "Getting the best price",
        "Reporting cost savings to management"
      ],
      context: "The customer wants a discount to report 'cost savings.' Your company discourages discounts >10%."
    },
    product: {
      name: "FleetSense",
      description: "GPS & telematics for delivery fleets with driver behavior scoring, real-time route optimization, and fuel savings analytics.",
      features: [
        "Driver behavior scoring",
        "Real-time route optimization",
        "Fuel savings analytics"
      ],
      pricing: "$50k annual contract",
      keyBenefits: [
        "Reduced fuel costs",
        "Improved driver safety",
        "Better route efficiency"
      ]
    },
    challenge: "Hold your ground while staying professional. Justify value with ROI and unique differentiators. Offer structured concessions (not blanket discounts). Win the deal at no more than 10% off.",
    successCriteria: [
      "Hold your ground while staying professional",
      "Justify value with ROI and unique differentiators",
      "Offer structured concessions (not blanket discounts)",
      "Win the deal at no more than 10% off"
    ],
    welcomeMessage: "Hi, I'm a Procurement Lead. I'm interested in FleetSense, but your competitors offer the same for 30% less. What can you do on price?"
  },
  {
    id: "scenario-5",
    title: "Selling a Job Candidate on a Startup Offer (Reverse Sales, High Stakes)",
    difficulty: "Medium",
    customer: {
      name: "Customer",
      profession: "Senior Engineer candidate",
      knowledge: "Highly talented, in-demand engineer",
      attitude: "Cautious about startup risk, wants long-term stability",
      communicationStyle: "Quiet but observant, asks thoughtful 'culture' questions",
      traits: [
        "Highly talented, in-demand",
        "Cautious about startup risk",
        "Asks thoughtful 'culture' questions",
        "Wants long-term stability"
      ],
      behaviors: [
        "Will challenge vague claims",
        "Will say things like 'How do I know this startup won't fold in 2 years?'",
        "Quiet but observant"
      ],
      concerns: [
        "Startup stability and risk",
        "Long-term career growth",
        "Comparing to FAANG offer"
      ],
      context: "The customer has an offer from a FAANG company already. You want to persuade them that your opportunity is more impactful."
    },
    product: {
      name: "Your Company's Job Offer",
      description: "A startup opportunity with rapid career growth potential, hybrid culture, and wear-many-hats environment.",
      features: [
        "$120k salary",
        "0.15% equity",
        "Hybrid culture",
        "Wear-many-hats environment",
        "Rapid career growth potential"
      ],
      pricing: "Total comp: $120k + 0.15% equity",
      keyBenefits: [
        "Ownership and impact",
        "Rapid career growth",
        "Mission-driven work"
      ]
    },
    challenge: "Emphasize mission, ownership, impact. Show transparency about risk & growth trajectory. Tailor arguments to her motivations. Get her to seriously consider your offer (not necessarily close).",
    successCriteria: [
      "Emphasize mission, ownership, impact",
      "Show transparency about risk & growth trajectory",
      "Tailor arguments to her motivations",
      "Get her to seriously consider your offer (not necessarily close)"
    ],
    welcomeMessage: "Hello, I'm a Senior Engineer. I'm considering your startup offer, but I also have an offer from a FAANG company. I'm concerned about startup risk. Can you help me understand why this opportunity might be better for my career?"
  }
];

// Helper functions for scenario management
const CURRENT_SCENARIO_KEY = "currentScenarioId";
const COMPLETED_SCENARIOS_KEY = "completedScenarios";

export function getCurrentScenarioId(): string | null {
  return localStorage.getItem(CURRENT_SCENARIO_KEY);
}

export function setCurrentScenarioId(id: string) {
  localStorage.setItem(CURRENT_SCENARIO_KEY, id);
}

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function getCompletedScenarios(): string[] {
  const stored = localStorage.getItem(COMPLETED_SCENARIOS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function markScenarioCompleted(scenarioId: string) {
  const completed = getCompletedScenarios();
  if (!completed.includes(scenarioId)) {
    completed.push(scenarioId);
    localStorage.setItem(COMPLETED_SCENARIOS_KEY, JSON.stringify(completed));
  }
}

export function getNextScenarioId(currentId: string): string | null {
  const currentIndex = SCENARIOS.findIndex(s => s.id === currentId);
  
  if (currentIndex === -1) {
    // If current scenario not found, return first scenario
    return SCENARIOS[0].id;
  }
  
  // If we're at the last scenario (index 4), cycle back to first (index 0)
  if (currentIndex === SCENARIOS.length - 1) {
    return SCENARIOS[0].id;
  }
  
  // Otherwise, return next scenario
  return SCENARIOS[currentIndex + 1].id;
}

export function areAllScenariosCompleted(): boolean {
  const completed = getCompletedScenarios();
  return completed.length >= SCENARIOS.length;
}

export function resetScenarios() {
  localStorage.removeItem(CURRENT_SCENARIO_KEY);
  localStorage.removeItem(COMPLETED_SCENARIOS_KEY);
}
