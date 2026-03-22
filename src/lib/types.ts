export type UserRole = "ADMIN" | "SITE_INCHARGE" | "FOREMAN";
export type AttendanceStatus = "DRAFT" | "SENT_TO_SI" | "SENT_TO_ADMIN" | "APPROVED";

export interface User {
	id: string;
	auth_id: string | null;
	username: string;
	name: string;
	father_name?: string | null;
	role: UserRole;
	phone: string | null;
	photo_url?: string | null;
	site_id: string | null;
	parent_id: string | null;
	created_at: string;
}

export interface Site {
	id: string;
	name: string;
	location: string | null;
	incharge_id: string | null;
	created_at: string;
	incharge?: User | null;
}

export interface Worker {
	id: string;
	name: string;
	father_name: string;
	phone_number: string;
	aadhar_card: string | null;
	worker_type: string | null;
	foreman_id: string;
	site_id: string;
	created_at: string;
}

export interface AttendanceRecord {
	id: string;
	sheet_id: string;
	worker_id: string;
	present: boolean;
	x_value: number;
	y_value: number;
	total_hours: number;
	double_check: boolean;
	created_at: string;
	worker?: Worker | null;
}

export interface AttendanceSheet {
	id: string;
	foreman_id: string;
	site_id: string;
	date: string;
	in_time: string | null;
	out_time: string | null;
	status: AttendanceStatus;
	approved_at?: string | null;
	created_at: string;
	foreman?: User | null;
	site?: Site | null;
	records?: AttendanceRecord[];
}

export interface DraftWorkerRecord {
	worker_id: string;
	worker_name: string;
	father_name?: string;
	present: boolean;
	x_value: number;
	y_value: number;
}

export interface DraftAttendance {
	date: string;
	in_time: string;
	out_time: string;
	workers: DraftWorkerRecord[];
}

export interface AdminDashboardStats {
	totalSites: number;
	totalWorkers: number;
	pendingApprovals: number;
	recentSubmissions: AttendanceSheet[];
}

export interface SiteInchargeRecentSubmission {
	sheet_id: string;
	foreman_name: string;
	submission_time: string;
}

export interface SiteInchargeDashboardStats {
	pendingReviews: number;
	foremenCount: number;
	todayStatus: string;
	recentSubmissions: SiteInchargeRecentSubmission[];
}

export interface ForemanDashboardStats {
	workersCount: number;
	todaySheetStatus: AttendanceStatus | "NOT_STARTED";
}

export type SIAttendanceStatus = "PRESENT" | "ABSENT";

export interface SIAttendanceEntry {
	id: string;
	si_user_id: string;
	site_id: string | null;
	date: string;
	name: string;
	father_name: string | null;
	phone_number: string | null;
	status: SIAttendanceStatus;
	source_sheet_id: string | null;
	created_at: string;
}
