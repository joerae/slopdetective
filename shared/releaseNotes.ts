export interface ReleaseNote {
  version: string;
  date: string;
  note: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
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
