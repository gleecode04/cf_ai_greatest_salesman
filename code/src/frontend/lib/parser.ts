/**
 * Report Parser
 */

type Segment = {
  title: string;
  content: string; // Markdown with bolded speaker labels and comment/highlight tags
};

type ParsedResult = {
  summary: string | null;
  feedback: string | null;
  suggestions: string | null;
  segments: Segment[];
  scores: { category: string; score: number }[];
};

const defaultScores: ParsedResult["scores"] = [
  { category: "Empathy", score: 85 },
  { category: "Clarity", score: 90 },
  { category: "Flexibility", score: 80 },
  { category: "Assertiveness", score: 75 },
  { category: "Active Listening", score: 88 },
  { category: "Conflict Management", score: 99 },
];

const CATEGORY_ALIASES: Record<string, string> = {
  empathy: "Empathy",
  clarity: "Clarity",
  "openmindness": "Flexibility",
  "openmindedness": "Flexibility",
  "open mindness": "Flexibility",
  "open mind": "Flexibility",
  "flexibility": "Flexibility",
  "flexible": "Flexibility",
  assertiveness: "Assertiveness",
  persuasion: "Persuasion",
  activelistening: "Active Listening",
  "active listening": "Active Listening",
  objectionhandling: "Objection Handling",
  "objection handling": "Objection Handling",
  closingability: "Closing Ability",
  "closing ability": "Closing Ability",
  conflictmanagement: "Conflict Management",
  "conflict management": "Conflict Management",
};

export default function Parser(rawText: string): ParsedResult {
  console.log('[Parser] Input length:', rawText.length);
  
  const result: ParsedResult = {
    summary: null,
    feedback: null,
    suggestions: null,
    segments: [],
    scores: defaultScores.map((s) => ({ ...s })),
  };

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
    console.log('[Parser] Parsed JSON successfully:', {
      hasSummaryAnalysis: !!parsed.summaryAnalysis,
      hasDetailedFeedback: !!parsed.detailedFeedback,
      summaryAnalysisLength: parsed.summaryAnalysis?.length || 0,
      detailedFeedbackLength: parsed.detailedFeedback?.length || 0,
    });
  } catch (e) {
    console.error("[Parser] Invalid JSON string:", e);
    return result;
  }

  const summaryText = parsed.summaryAnalysis || parsed.summary || "";
  const detailText = parsed.detailedFeedback || parsed.detail || "";
  
  console.log('[Parser] Extracting data:', {
    summaryTextLength: summaryText.length,
    detailTextLength: detailText.length,
  });

  // --- Summary --- ()
  const summaryMatch = summaryText.match(
    /##\s*CONVERSATION OVERVIEW\s*([\s\S]*?)(?=##|$)/i
  );
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
    console.log('[Parser] Extracted summary, length:', result.summary.length);
  } else {
    console.warn('[Parser] No CONVERSATION OVERVIEW found in summaryText');
    // Fallback: use first part of summaryText if no match
    if (summaryText.trim()) {
      result.summary = summaryText.split('##')[0].trim() || summaryText.substring(0, 500);
    }
  }

  // --- Feedback --- ()
  const feedbackMatch = summaryText.match(
    /##\s*USER PERFORMANCE ANALYSIS\s*([\s\S]*?)(?=(?:##|$))/i
  );
  if (feedbackMatch) {
    result.feedback = feedbackMatch[1].trim();
    console.log('[Parser] Extracted feedback, length:', result.feedback.length);
  } else {
    console.warn('[Parser] No USER PERFORMANCE ANALYSIS found');
    // Fallback: use summaryText as feedback if no match
    if (summaryText.trim() && !result.summary) {
      result.feedback = summaryText.substring(0, 500);
    }
  }

  // --- Suggestions --- ()
  const suggestionsMatch = summaryText.match(
    /##\s*IMPROVEMENT RECOMMENDATIONS\s*([\s\S]*?)(?=##|$)/i
  );
  if (suggestionsMatch) {
    result.suggestions = suggestionsMatch[1].trim();
    console.log('[Parser] Extracted suggestions, length:', result.suggestions.length);
  } else {
    console.warn('[Parser] No IMPROVEMENT RECOMMENDATIONS found');
  }

  // --- Scores --- ()
  const ratingMatch = summaryText.match(/##\s*RATING\s*([\s\S]*?)(?=##|$)/i);
  if (ratingMatch) {
    const lines = ratingMatch[1]
      .split("\n")
      .map((l: string) => l.replace(/^\*+/g, "").trim())
      .filter(Boolean);

    const parsedScores: { category: string; score: number }[] = [];
    for (const line of lines) {
      const m = line.match(/-?\s*([^:]+):\s*(\d+)/i);
      if (m) {
        const rawCat = m[1].trim().toLowerCase().replace(/[\s\-_]+/g, "");
        const canonicalCat = CATEGORY_ALIASES[rawCat] || m[1].trim();
        parsedScores.push({ category: canonicalCat, score: Number(m[2]) });
      }
    }

    const defaultMap = new Map<string, number>();
    result.scores.forEach((s, i) => defaultMap.set(s.category, i));

    for (const ps of parsedScores) {
      const idx = defaultMap.get(ps.category);
      if (idx !== undefined) {
        result.scores[idx] = { category: ps.category, score: ps.score };
      } else {
        result.scores.push(ps);
      }
    }
  }

  // --- Segments --- ( exactly)
  // Try multiple regex patterns to handle different formats
  const segRegex1 = /<segment:\s*([^>]+)>([\s\S]*?)<\/segment:\s*\1>/gi;
  const segRegex2 = /<segment:\s*([^>]+)>([\s\S]*?)<\/segment:[^>]+>/gi;
  const segRegex3 = /<segment:\s*([^>]+)>([\s\S]*?)<\/segment>/gi;
  
  let segMatch;
  let segmentCount = 0;
  let usedRegex = '';
  
  // Try first regex (exact match) - XML format
  while ((segMatch = segRegex1.exec(detailText)) !== null) {
    const title = segMatch[1].trim();
    let content = segMatch[2].trim();

    // --- Keep <comment> and <highlight> tags intact ---
    // Bold speaker labels (first letter capitalized) ()
    content = content.replace(
      /^(\s*)(\w+):/gim,
      (_, ws, speaker) =>
        `${ws}**${speaker.charAt(0).toUpperCase()}${speaker.slice(1)}:**`
    );

    result.segments.push({ title, content });
    segmentCount++;
    usedRegex = 'regex1';
  }
  
  // If no segments found, try second regex (looser match)
  if (segmentCount === 0) {
    while ((segMatch = segRegex2.exec(detailText)) !== null) {
      const title = segMatch[1].trim();
      let content = segMatch[2].trim();

      content = content.replace(
        /^(\s*)(\w+):/gim,
        (_, ws, speaker) =>
          `${ws}**${speaker.charAt(0).toUpperCase()}${speaker.slice(1)}:**`
      );

      result.segments.push({ title, content });
      segmentCount++;
      usedRegex = 'regex2';
    }
  }
  
  // If still no segments, try third regex (most lenient)
  if (segmentCount === 0) {
    while ((segMatch = segRegex3.exec(detailText)) !== null) {
      const title = segMatch[1].trim();
      let content = segMatch[2].trim();

      content = content.replace(
        /^(\s*)(\w+):/gim,
        (_, ws, speaker) =>
          `${ws}**${speaker.charAt(0).toUpperCase()}${speaker.slice(1)}:**`
      );

      result.segments.push({ title, content });
      segmentCount++;
      usedRegex = 'regex3';
    }
  }
  
  // If still no segments, try plain text format (what the backend is actually generating)
  // Format: "Segment: Title\ncontent..."
  if (segmentCount === 0) {
    console.log('[Parser] Trying plain text segment format');
    const plainTextRegex = /Segment:\s*([^\n]+)\n([\s\S]*?)(?=Segment:|$)/gi;
    while ((segMatch = plainTextRegex.exec(detailText)) !== null) {
      const title = segMatch[1].trim();
      let content = segMatch[2].trim();
      
      // Skip if content is too short (likely not a real segment)
      if (content.length < 10) continue;

      // Bold speaker labels (first letter capitalized)
      content = content.replace(
        /^(\s*)(\w+):/gim,
        (_, ws, speaker) =>
          `${ws}**${speaker.charAt(0).toUpperCase()}${speaker.slice(1)}:**`
      );

      result.segments.push({ title, content });
      segmentCount++;
      usedRegex = 'plainText';
    }
  }
  
  console.log('[Parser] Extracted segments:', segmentCount, 'using', usedRegex || 'none');
  console.log('[Parser] detailText length:', detailText.length);
  console.log('[Parser] detailText contains <segment:', detailText.includes('<segment:'));
  
  if (segmentCount === 0 && detailText.length > 0) {
    console.warn('[Parser] No segments found. detailText preview:', detailText.substring(0, 500));
  }
  
  console.log('[Parser] Final result:', {
    hasSummary: !!result.summary,
    hasFeedback: !!result.feedback,
    hasSuggestions: !!result.suggestions,
    segmentsCount: result.segments.length,
    scoresCount: result.scores.length,
  });

  return result;
}

