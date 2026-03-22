import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { STATUS_COLOR_CLASSES, X_MAX, Y_MAX } from "@/lib/constants"
import type { AttendanceStatus, UserRole } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateTotalHours(x: number, y: number) {
  return x * 8 + y
}

export function clampXValue(value: number) {
  return Math.min(Math.max(value, 0), X_MAX)
}

export function clampYValue(value: number) {
  return Math.min(Math.max(value, 0), Y_MAX)
}

export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value
  return format(date, "dd MMM yyyy")
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "--:--"

  const normalized = value.length === 5 ? `${value}:00` : value
  return format(new Date(`1970-01-01T${normalized}`), "hh:mm a")
}

export function getStatusColor(status: AttendanceStatus) {
  return STATUS_COLOR_CLASSES[status]
}

export function getRoleRedirectPath(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "/admin"
    case "SITE_INCHARGE":
      return "/site-incharge"
    case "FOREMAN":
      return "/foreman"
  }
}

export function getDraftStorageKey(foremanId: string, date: string) {
  return `erp_attendance_draft_${foremanId}_${date}`
}
