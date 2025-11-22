/**
 * Scenario Converter
 * 
 * Converts AI-generated scenarios to frontend Scenario format
 */

import { Scenario } from "./scenarios";

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

/**
 * Convert AI-generated scenario to frontend Scenario format
 */
export function convertGeneratedScenario(
  generated: GeneratedScenario,
  id: string = `generated-${Date.now()}`
): Scenario {
  return {
    id,
    name: generated.scenario_title,
    difficulty: capitalizeFirst(generated.difficulty) as "Easy" | "Medium" | "Hard",
    product: {
      name: generated.product.name,
      description: generated.product.description,
      features: generated.product.features,
      price: generated.product.pricing,
    },
    customer: {
      name: generated.customer.name,
      age: generated.customer.age,
      profession: generated.customer.profession,
      knowledge: generated.customer.knowledge,
      attitude: generated.customer.attitude,
      communicationStyle: generated.customer.communicationStyle,
      biases: generated.customer.biases,
      concerns: generated.customer.concerns || [],
      behaviors: generated.customer.behaviors,
    },
    challenge: generated.challenge,
    successCriteria: generated.successCriteria,
  };
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

