/**
 * Usage Limits Manager
 * 
 * Tracks daily scenario usage and enforces limits
 * Premium users bypass limits
 */

import { Env } from "../../types";
import { SessionManager } from "../session/sessionManager";

export interface UsageLimits {
  dailyScenariosUsed: number;
  dailyLimit: number;
  isPremium: boolean;
  resetDate: string; // YYYY-MM-DD format
}

const DEFAULT_DAILY_LIMIT = 4;
const PREMIUM_DAILY_LIMIT = 999; // Effectively unlimited

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get usage limits for a resource
 */
export async function getUsageLimits(resourceId: string, env: Env): Promise<UsageLimits> {
  try {
    const sessionManager = new SessionManager(env);
    const limitsKey = `usage_limits_${resourceId}`;
    const stored = await sessionManager.getSessionData(resourceId, limitsKey);
    
    const today = getTodayDate();
    
    if (!stored) {
      // First time user, initialize limits
      const initialLimits: UsageLimits = {
        dailyScenariosUsed: 0,
        dailyLimit: DEFAULT_DAILY_LIMIT,
        isPremium: false,
        resetDate: today,
      };
      await sessionManager.setSessionData(resourceId, limitsKey, initialLimits);
      return initialLimits;
    }
    
    const limits = stored as UsageLimits;
    
    // Check if we need to reset (new day)
    if (limits.resetDate !== today) {
      const resetLimits: UsageLimits = {
        dailyScenariosUsed: 0,
        dailyLimit: limits.isPremium ? PREMIUM_DAILY_LIMIT : DEFAULT_DAILY_LIMIT,
        isPremium: limits.isPremium,
        resetDate: today,
      };
      await sessionManager.setSessionData(resourceId, limitsKey, resetLimits);
      return resetLimits;
    }
    
    // Update limit if premium status changed
    if (limits.isPremium && limits.dailyLimit !== PREMIUM_DAILY_LIMIT) {
      limits.dailyLimit = PREMIUM_DAILY_LIMIT;
      await sessionManager.setSessionData(resourceId, limitsKey, limits);
    } else if (!limits.isPremium && limits.dailyLimit !== DEFAULT_DAILY_LIMIT) {
      limits.dailyLimit = DEFAULT_DAILY_LIMIT;
      await sessionManager.setSessionData(resourceId, limitsKey, limits);
    }
    
    return limits;
  } catch (error) {
    console.error('[usageLimits] Error getting usage limits:', error);
    // Return default limits on error
    return {
      dailyScenariosUsed: 0,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      isPremium: false,
      resetDate: getTodayDate(),
    };
  }
}

/**
 * Increment scenario usage count
 */
export async function incrementScenarioUsage(resourceId: string, env: Env): Promise<UsageLimits> {
  try {
    const limits = await getUsageLimits(resourceId, env);
    
    // Don't increment if premium (unlimited)
    if (limits.isPremium) {
      return limits;
    }
    
    limits.dailyScenariosUsed += 1;
    
    const sessionManager = new SessionManager(env);
    const limitsKey = `usage_limits_${resourceId}`;
    await sessionManager.setSessionData(resourceId, limitsKey, limits);
    
    return limits;
  } catch (error) {
    console.error('[usageLimits] Error incrementing usage:', error);
    return await getUsageLimits(resourceId, env);
  }
}

/**
 * Check if user can start a new scenario
 */
export async function canStartScenario(resourceId: string, env: Env): Promise<{
  allowed: boolean;
  limits: UsageLimits;
  reason?: string;
}> {
  const limits = await getUsageLimits(resourceId, env);
  
  if (limits.isPremium) {
    return { allowed: true, limits };
  }
  
  if (limits.dailyScenariosUsed >= limits.dailyLimit) {
    return {
      allowed: false,
      limits,
      reason: `Daily limit reached (${limits.dailyLimit} scenarios). Upgrade to premium for unlimited scenarios.`,
    };
  }
  
  return { allowed: true, limits };
}

/**
 * Set premium status for a user
 */
export async function setPremiumStatus(
  resourceId: string,
  isPremium: boolean,
  env: Env
): Promise<UsageLimits> {
  try {
    const limits = await getUsageLimits(resourceId, env);
    limits.isPremium = isPremium;
    limits.dailyLimit = isPremium ? PREMIUM_DAILY_LIMIT : DEFAULT_DAILY_LIMIT;
    
    const sessionManager = new SessionManager(env);
    const limitsKey = `usage_limits_${resourceId}`;
    await sessionManager.setSessionData(resourceId, limitsKey, limits);
    
    return limits;
  } catch (error) {
    console.error('[usageLimits] Error setting premium status:', error);
    return await getUsageLimits(resourceId, env);
  }
}

