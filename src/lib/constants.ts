export const APP_NAME = "Construction ERP";

export const X_MAX = 48;
export const Y_MAX = 7;
export const CLEANUP_DAYS = 90;
export const DEFAULT_DRAFT_STORAGE_KEY = "erp_attendance_draft";

export const ROLE_LABELS = {
	ADMIN: "Admin",
	SITE_INCHARGE: "Site Incharge",
	FOREMAN: "Foreman",
} as const;

export const STATUS_LABELS = {
	DRAFT: "Draft",
	SENT_TO_SI: "Sent to SI",
	SENT_TO_ADMIN: "Sent to Admin",
	APPROVED: "Approved",
} as const;

export const STATUS_COLOR_CLASSES = {
	DRAFT: "bg-slate-200 text-slate-700",
	SENT_TO_SI: "bg-amber-100 text-amber-700",
	SENT_TO_ADMIN: "bg-sky-100 text-sky-700",
	APPROVED: "bg-green-100 text-green-700",
} as const;

export const ADMIN_NAV_ITEMS = [
	{ href: "/admin", label: "Home" },
	{ href: "/admin/approval", label: "Admin Approval" },
	{ href: "/admin/sites", label: "Manage Sites" },
	{ href: "/admin/add-user", label: "Add User" },
	{ href: "/admin/manage-users", label: "Manage Users" },
	{ href: "/admin/attendance", label: "Attendance" },
	{ href: "/admin/attendance-records", label: "Attendance Records" },
	{ href: "/admin/si-attendance", label: "SI Attendance" },
	{ href: "/admin/profile", label: "Profile" },
] as const;

export const SITE_INCHARGE_NAV_ITEMS = [
	{ href: "/site-incharge", label: "Home" },
	{ href: "/site-incharge/review", label: "Review Attendance" },
	{ href: "/site-incharge/foremen", label: "Manage Foremen" },
	{ href: "/site-incharge/profile", label: "Profile" },
] as const;

export const FOREMAN_NAV_ITEMS = [
	{ href: "/foreman", label: "Home" },
	{ href: "/foreman/attendance", label: "Attendance" },
	{ href: "/foreman/profile", label: "Profile" },
] as const;
