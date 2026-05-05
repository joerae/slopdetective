# Slop Detection Research & Roadmap

## 1. High-Priority Markers (Currently Implemented)
*   **The Contrarian Pivot:** "It's not X, it's Y." This is the #1 tell for "Smart Slop" (text that sounds authoritative but is formulaic).
*   **Simulated Edginess:** Use of "Screw that," "Frankly," "Let's be real," "Here's the thing" to feign human emotion.
*   **The LinkedIn Structure:** Single-sentence paragraphs. 
*   **Summary Headers:** "The Bottom Line," "The Verdict," "Key Takeaways."
*   **Vocabulary:** "Delve," "Tapestry," "Realm," "Unleash," "Landscape."

## 2. Research To-Do List
*   [ ] **Perplexity Analysis:** 
    *   *Theory:* AI text has very consistent perplexity (predictability). Human text varies wildly (Burstiness).
    *   *Goal:* Implement a heuristic to measure sentence length variance as a proxy for burstiness.
    
*   [ ] **Metaphor Logic Check:**
    *   *Theory:* AI uses mixed metaphors or metaphors that don't quite land physically (e.g., "The tapestry of the digital ecosystem").
    *   *Goal:* Train the prompt to specifically critique weak metaphors.

*   [ ] **Structural Symmetry:**
    *   *Theory:* AI often outputs exactly 3 bullet points, or paragraphs of exactly equal length.
    *   *Goal:* Detect "perfect symmetry" as a negative signal.

*   [ ] **The "Both Sides" Equivalence:**
    *   *Theory:* AI struggles to take a hard stance without immediately hedging. "While X is bad, it is important to remember Y."
    *   *Goal:* Flag excessive hedging in opinion pieces.

## 3. The "Ikea Effect" Theory
*   Users overvalue AI output because they wrote the prompt.
*   We need to detect *generic* advice disguised as *specific* insight.
*   *Marker:* Advice that applies to literally any industry (e.g., "Communication is key," "It depends on the context").
