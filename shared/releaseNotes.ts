export interface ReleaseNote {
  version: string;
  date: string;
  note: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.34",
    date: "2026-05-15",
    note: "Shareable analysis links, Gemini retries, and 30-day cleanup.",
  },

  {
    version: "1.33",
    date: "2026-05-14",
    note: "Compact evidence view with full instance counting.",
  },
 
  {
    version: "1.32",
    date: "2026-05-14",
    note: "Bring back all evidence",
  },
 
  {
    version: "1.3",
    date: "2026-05-14",
    note: "Changed to using Gemini Flash 2.5",
  },


  {
    version: "1.2",
    date: "2026-05-14",
    note: "Longer timeouts through background functions.",
  },

  {
    version: "1.1",
    date: "2026-05-14",
    note: "Stronger error logging and retries added.",
  },
  {
    version: "1.0",
    date: "2026-01-28",
    note: "Initial release of AI Slop Detective.",
  },
];

export const CURRENT_RELEASE = RELEASE_NOTES[0];
