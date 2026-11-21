"use client";

import { usePathname } from "next/navigation";

/** Scores are revealed only in step 4 (Profil & plan final); steps 1-3 show neutral progress. */
export function useHideScores() {
  const path = usePathname() ?? "";
  return ["/onboarding", "/analiza", "/investitie"].some((p) => path.startsWith(p));
}
