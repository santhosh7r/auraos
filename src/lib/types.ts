/* ============================================================
   AURA OS — Internal Company CRM · Domain Types
   Lean, real entities. No demo fluff.
   ============================================================ */

export type Role =
  | "admin"
  | "manager"
  | "sales"
  | "developer"
  | "designer"
  | "marketing"
  | "finance";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Project Manager",
  sales: "Sales",
  developer: "Developer",
  designer: "Designer",
  marketing: "Marketing",
  finance: "Finance",
};

export const ROLES: Role[] = [
  "admin", "manager", "sales", "developer", "designer", "marketing", "finance",
];

export type Department =
  | "Leadership"
  | "Sales"
  | "Engineering"
  | "Design"
  | "Marketing"
  | "Finance"
  | "Operations";

export const DEPARTMENTS: Department[] = [
  "Leadership", "Sales", "Engineering", "Design", "Marketing", "Finance", "Operations",
];

export type MemberStatus = "active" | "invited" | "inactive";

/** A team member = a login-capable user. passwordHash never leaves the server. */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: Role;
  title: string;
  department: Department;
  phone: string;
  location: string;
  avatar?: string;
  status: MemberStatus;
  joiningDate: string;
  lastActiveAt?: string;
  createdAt: string;
}

export type ClientStatus = "active" | "prospect" | "archived";
export type ClientHealth = "green" | "yellow" | "red";

export interface Client {
  id: string;
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  status: ClientStatus;
  health: ClientHealth;
  accountManager: string; // member id
  address: string;
  notes: string;
  createdAt: string;
}

export type Priority = "low" | "medium" | "high" | "urgent";
export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "review"
  | "completed"
  | "on_hold";

// Mild, desaturated state colors — gentle on the dark surface, shared by
// badges and the calendar so a stage looks identical everywhere.
export const PROJECT_STAGES: { id: ProjectStatus; label: string; color: string }[] = [
  { id: "planning", label: "Planning", color: "hsl(220 9% 62%)" },      // slate
  { id: "in_progress", label: "In Progress", color: "hsl(213 50% 62%)" }, // mild blue
  { id: "review", label: "Review", color: "hsl(40 48% 60%)" },          // mild amber
  { id: "completed", label: "Completed", color: "hsl(150 30% 55%)" },   // mild green
  { id: "on_hold", label: "On Hold", color: "hsl(26 52% 60%)" },        // mild orange
];

export interface Project {
  id: string;
  name: string;
  clientId: string;
  service: string; // service type (from config "Service types")
  status: ProjectStatus;
  priority: Priority;
  budget: number;
  startDate: string;
  deadline: string;
  progress: number; // 0-100
  team: string[]; // member ids
  lead: string; // member id
  description: string;
  createdAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export const TASK_STATUSES: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "To Do", color: "hsl(220 9% 62%)" },            // slate
  { id: "in_progress", label: "In Progress", color: "hsl(213 50% 62%)" }, // mild blue
  { id: "review", label: "Review", color: "hsl(40 48% 60%)" },          // mild amber
  { id: "done", label: "Done", color: "hsl(150 30% 55%)" },            // mild green
];

/** Project-deadline accent for the calendar — mild red. */
export const DEADLINE_COLOR = "hsl(0 55% 65%)";
/** Lead follow-up accent for the calendar — mild violet (distinct from stages). */
export const FOLLOWUP_COLOR = "hsl(268 45% 68%)";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string; // member id
  projectId: string;
  dueDate: string;
  startTime?: string; // optional "HH:MM" — renders as a time block on the calendar
  endTime?: string;   // optional "HH:MM"
  createdAt: string;
}

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost";

export const LEAD_STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "new", label: "New", color: "hsl(var(--chart-4))" },
  { id: "contacted", label: "Contacted", color: "hsl(var(--chart-2))" },
  { id: "qualified", label: "Qualified", color: "hsl(var(--chart-1))" },
  { id: "proposal", label: "Proposal Sent", color: "hsl(var(--chart-3))" },
  { id: "won", label: "Won", color: "hsl(var(--success))" },
  { id: "lost", label: "Lost", color: "hsl(var(--destructive))" },
];

export type LeadSource =
  | "Website"
  | "Referral"
  | "LinkedIn"
  | "Instagram"
  | "WhatsApp"
  | "Other";

export const LEAD_SOURCES: LeadSource[] = [
  "Website", "Referral", "LinkedIn", "Instagram", "WhatsApp", "Other",
];

export type LeadService =
  | "Website"
  | "Web App"
  | "SaaS"
  | "E-commerce"
  | "Branding"
  | "Automation"
  | "Other";

export const LEAD_SERVICES: LeadService[] = [
  "Website", "Web App", "SaaS", "E-commerce", "Branding", "Automation", "Other",
];

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  source: LeadSource;
  service: LeadService;
  status: LeadStatus;
  priority: Priority;
  value: number; // estimated budget / expected deal value
  assignedTo: string; // member id
  followUpDate: string; // next follow-up (YYYY-MM-DD)
  tags: string[];
  notes: string;
  createdAt: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  projectId?: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  createdAt: string;
}

export type ExpenseCategory =
  | "Salaries"
  | "Software"
  | "Marketing"
  | "Office"
  | "Contractors"
  | "Other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Salaries", "Software", "Marketing", "Office", "Contractors", "Other",
];

/** Default client industries. Editable on the Config page under "Client industries". */
export const INDUSTRIES: string[] = [
  "Healthtech", "Fintech", "E-commerce", "SaaS", "Media", "Logistics",
  "Cleantech", "Education", "Hospitality", "Real Estate", "Other",
];

export interface Expense {
  id: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number;
  date: string;
  notes: string;
  createdAt: string;
}

/* ============================================================
   Content Planning
   ============================================================ */

/** Planning horizon for a content item — drives the scope icon/badge. */
export type ContentScope = "monthly" | "weekly" | "daily";

export const CONTENT_SCOPES: { id: ContentScope; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
];

/** Content type / platform — the color drives the calendar chip. Mild, desaturated palette. */
export const CONTENT_TYPES: { id: string; label: string; color: string }[] = [
  { id: "blog", label: "Blog / Article", color: "hsl(213 50% 62%)" },   // mild blue
  { id: "social", label: "Social Post", color: "hsl(330 45% 65%)" },     // mild pink
  { id: "video", label: "Video", color: "hsl(0 55% 65%)" },             // mild red
  { id: "newsletter", label: "Newsletter", color: "hsl(40 48% 60%)" },  // mild amber
  { id: "campaign", label: "Campaign / Ad", color: "hsl(268 45% 68%)" },// mild violet
  { id: "other", label: "Other", color: "hsl(220 9% 62%)" },           // slate
];

export type ContentStatus = "idea" | "planned" | "in_progress" | "published";

export const CONTENT_STATUSES: { id: ContentStatus; label: string; color: string }[] = [
  { id: "idea", label: "Idea", color: "hsl(220 9% 62%)" },             // slate
  { id: "planned", label: "Planned", color: "hsl(213 50% 62%)" },       // mild blue
  { id: "in_progress", label: "In Progress", color: "hsl(40 48% 60%)" },// mild amber
  { id: "published", label: "Published", color: "hsl(150 30% 55%)" },   // mild green
];

export interface ContentPlan {
  id: string;
  title: string;
  description: string;
  type: string;           // CONTENT_TYPES id
  scope: ContentScope;
  status: ContentStatus;
  date: string;           // planned/publish date (YYYY-MM-DD)
  startTime?: string;     // optional "HH:MM" — renders as a time block on the calendar
  endTime?: string;       // optional "HH:MM"
  assignee: string;       // member id
  projectId: string;      // optional
  createdAt: string;
}

export type NotificationType =
  | "task"
  | "project"
  | "lead"
  | "client"
  | "invoice"
  | "system";

export interface AppNotification {
  id: string;
  userId: string; // recipient member id (or "all")
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  avatar?: string;
}

/** A single point in a chart series. `label` is the x-axis; any other key is a numeric measure. */
export interface SeriesPoint {
  label: string;
  [key: string]: string | number;
}
