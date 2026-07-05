import { Schema, model, models, type Model } from "mongoose";

/* ============================================================
   AURA OS — Mongoose Models (real persistence)
   ============================================================ */

const base = { timestamps: true, versionKey: false } as const;

/* ---- User (a login-capable team member) ---- */
export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  employeeId?: string;
  passwordHash: string;
  role: string;
  title: string;
  department: string;
  phone: string;
  location: string;
  avatar?: string;
  status: "active" | "invited" | "inactive";
  joiningDate: string;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    employeeId: { type: String, unique: true, sparse: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, default: "member", index: true },
    title: { type: String, default: "" },
    department: { type: String, default: "Operations" },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    avatar: { type: String },
    status: { type: String, default: "active" },
    joiningDate: { type: String, default: "" },
    lastActiveAt: { type: Date },
  },
  base
);

const ClientSchema = new Schema(
  {
    name: { type: String, required: true },
    industry: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    status: { type: String, default: "active", index: true },
    health: { type: String, default: "green" },
    accountManager: { type: String, default: "" },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
    leadId: { type: String, default: "" },   // source lead this client was converted from
    dealValue: { type: Number, default: 0 }, // deal value carried over from the won lead (USD base)
  },
  base
);

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true },
    clientId: { type: String, default: "", index: true },
    service: { type: String, default: "" },
    status: { type: String, default: "planning", index: true },
    priority: { type: String, default: "medium" },
    budget: { type: Number, default: 0 },
    startDate: { type: String, default: "" },
    deadline: { type: String, default: "" },
    progress: { type: Number, default: 0 },
    team: { type: [String], default: [] },
    lead: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  base
);

const TaskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "todo", index: true },
    priority: { type: String, default: "medium" },
    assignee: { type: String, default: "", index: true },
    projectId: { type: String, default: "", index: true },
    dueDate: { type: String, default: "" },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
  },
  base
);

const LeadSchema = new Schema(
  {
    name: { type: String, required: true },
    company: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    source: { type: String, default: "Other" },
    service: { type: String, default: "Other" },
    status: { type: String, default: "new", index: true },
    priority: { type: String, default: "medium" },
    value: { type: Number, default: 0 },
    assignedTo: { type: String, default: "" },
    followUpDate: { type: String, default: "" },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "" },
    createdBy: { type: String, default: "", index: true }, // user who added the lead
    clientId: { type: String, default: "" },               // set when converted to a client
  },
  base
);

const InvoiceSchema = new Schema(
  {
    number: { type: String, required: true },
    clientId: { type: String, default: "", index: true },
    projectId: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "draft", index: true },
    issueDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
  },
  base
);

const ExpenseSchema = new Schema(
  {
    category: { type: String, default: "Other" },
    vendor: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    date: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  base
);

const NotificationSchema = new Schema(
  {
    userId: { type: String, default: "all", index: true },
    type: { type: String, default: "system" },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    href: { type: String },
    read: { type: Boolean, default: false },
  },
  base
);

/* ---- Content plan (monthly / weekly / daily content planning) ---- */
const ContentPlanSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, default: "other" },
    scope: { type: String, default: "weekly", index: true },
    status: { type: String, default: "planned", index: true },
    date: { type: String, default: "", index: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    assignee: { type: String, default: "", index: true },
    projectId: { type: String, default: "" },
  },
  base
);

/* ---- WeeklyReward (one all-or-nothing reward per ISO week, set by admin) ---- */
const WeeklyRewardSchema = new Schema(
  {
    week: { type: String, required: true, unique: true, index: true }, // "2026-W27"
    title: { type: String, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "🏆" },
    date: { type: String, default: "" },                  // when the reward is planned / to be given
    fulfillment: { type: String, default: "pending" },    // "pending" | "completed" (admin-updated)
    createdBy: { type: String, default: "" },             // admin user id
  },
  base
);

/* ---- Setting (customizable option lists managed from the Config page) ---- */
const SettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    values: { type: [String], default: [] },
  },
  base
);

function defineModel<T>(name: string, schema: Schema): Model<T> {
  return (models[name] as Model<T>) || model<T>(name, schema);
}

export const UserModel = defineModel<UserDoc>("User", UserSchema);
export const SettingModel = defineModel("Setting", SettingSchema);
export const ClientModel = defineModel("Client", ClientSchema);
export const ProjectModel = defineModel("Project", ProjectSchema);
export const TaskModel = defineModel("Task", TaskSchema);
export const LeadModel = defineModel("Lead", LeadSchema);
export const InvoiceModel = defineModel("Invoice", InvoiceSchema);
export const ExpenseModel = defineModel("Expense", ExpenseSchema);
export const NotificationModel = defineModel("Notification", NotificationSchema);
export const ContentPlanModel = defineModel("ContentPlan", ContentPlanSchema);
export const WeeklyRewardModel = defineModel("WeeklyReward", WeeklyRewardSchema);
