export interface ReleaseNote {
  version: string;
  date: string;
  note: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.1",
    date: "2026-05-14",
    note: "Stronger error logging and retries added.",
  },
  {
    version: "1.0",
    date: "2026-05-14",
    note: "Initial release of AI Slop Detective.",
  },
];

export const CURRENT_RELEASE = RELEASE_NOTES[0];
