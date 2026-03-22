"use client";

import { useCallback, useMemo } from "react";
import { getDraftStorageKey } from "@/lib/utils";
import type { DraftAttendance } from "@/lib/types";

export function useDraft(foremanId: string | null, date: string) {
  const storageKey = useMemo(() => {
    if (!foremanId || !date) return "";
    return getDraftStorageKey(foremanId, date);
  }, [foremanId, date]);

  const saveDraft = useCallback((data: DraftAttendance) => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  }, [storageKey]);

  const loadDraft = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as DraftAttendance;
    } catch {
      return null;
    }
  }, [storageKey]);

  const deleteDraft = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const hasDraft = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return false;
    return !!window.localStorage.getItem(storageKey);
  }, [storageKey]);

  return {
    saveDraft,
    loadDraft,
    deleteDraft,
    hasDraft,
  };
}
