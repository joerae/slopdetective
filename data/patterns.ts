
import { PatternDefinition } from "../types";

export const DETECTION_PATTERNS: PatternDefinition[] = [
  {
    "id": "ai_signoff",
    "name": "The Robot Slip-up",
    "description": "Obvious artifacts like 'ChatGPT said:', 'As an AI...', or 'I can help with that'.",
    "promptInstruction": "Look for copy-paste artifacts at the START or END. Specifically: 'ChatGPT said:', 'Claude said:', 'Here is a draft:', 'Sure, here is...', 'As an AI language model', 'I cannot browse'. Also look for placeholders like '[Insert name here]','If you tell me [X] then I can give you a [Y].",
    "weight": 3,
    "defaultTolerance": 0.1
  },
  {
    "id": "contrarian_pivot",
    "name": "The Contrarian Pivot",
    "description": "The 'It's not X, it's Y' or 'Not just X, but Y' rhetorical structure.",
    "promptInstruction": "Look for the structure 'It isn't X. It's Y.' or 'Most people think X. Wrong. It's Y.' Also look for the Additive Reveal: 'It doesn't just X. It Y.' or 'It's not just about X. It's about Y.' This 'Strawman -> Negation -> Revelation' rhythm is a major tell. Or 'this is more than X, it's Y'",
    "weight": 1.2,
    "defaultTolerance": 5
  },
  {
    "id": "simulated_edginess",
    "name": "Forced Casualness",
    "description": "Theatrical transitions and unnatural attempts to sound 'voicey'.",
    "promptInstruction": "Look for theatrical stage directions starting sentences: 'Right then', 'Now:', 'Well.', 'Here's the thing:', 'Picture this:'. Also flag cringe casualness like 'Let's be real'. Flag it if it feels like a robot performing a caricature of a human.",
    "weight": 0.5,
    "defaultTolerance": 10
  },
  {
    "id": "formulaic_transitions",
    "name": "Formulaic Transitions",
    "description": "Transitions that are overused in LLM writing, such as 'The Bottom Line'.",
    "promptInstruction": "Look for the telltale LLM transitions such as 'The Bottom Line', 'Ultimately', 'In contrast', 'On the other hand','The real story is'.",
    "weight": 1.2,
    "defaultTolerance": 6
  },
  {
    "id": "vocab_slop",
    "name": "Vocabulary Slop",
    "description": "The 'Dead Giveaways': Tapestry, Delve, Realm, Unleash.",
    "promptInstruction": "CRITICAL: Look for these specific words. Finding 'Tapestry' or 'Delve' is a major indicator. Others: 'Realm', 'Unleash', 'Harness', 'Testament to', 'Landscape', 'Intersection of', 'Symphony of', 'Resonate'.",
    "weight": 1.8,
    "defaultTolerance": 5
  },
  {
    "id": "hedging",
    "name": "The 'Both Sides' Hedge",
    "description": "Refusal to take a hard stance.",
    "promptInstruction": "Look for excessive hedging, such as 'It is important to consider both sides,' or 'Context matters,' used to dilute a strong opinion.",
    "weight": 0.7,
    "defaultTolerance": 10
  },
  {
    "id": "dramatic_dashes",
    "name": "Dramatic Dashes",
    "description": "Abuse of em-dashes and semicolons to force rhythm.",
    "promptInstruction": "Flag usage of em-dashes (—), hyphens as dashes (-), and semicolons (;). CRITICAL COUNTING RULES: 1. A PAIR of dashes acting as parenthetical brackets counts as ONE instance. 2. Do NOT count colons. 3. Do NOT count commas. 4. Do not count compound words made with dashes such as high-stakes",
    "weight": 1.5,
    "defaultTolerance": 6
  },
  {
    "id": "dramatic_colons",
    "name": "Dramatic Colon Use",
    "description": "Using colons for a 'Setup: Reveal' effect.",
    "promptInstruction": "Look for colons used purely for dramatic effect, separating a statement from a punchline or conclusion. Do NOT count colons introducing lists or definitions.",
    "weight": 0.5,
    "defaultTolerance": 13
  }
];
