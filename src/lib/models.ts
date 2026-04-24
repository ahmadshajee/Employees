import mongoose, { Schema, Types } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const LeadLogSchema = new Schema(
  {
    type: { type: String, required: true },
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LeadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    position: { type: String, default: "" },
    company: { type: String, required: true },
    location: { type: String, default: "" },
    email: { type: String, default: "" },
    platform: { type: String, default: "Direct" },
    status: { type: String, default: "Contacted" },
    logs: { type: [LeadLogSchema], default: [] },
  },
  { timestamps: true }
);

const DailyReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    coldCalls: { type: Number, default: 0 },
    emailsSent: { type: Number, default: 0 },
    linkedInMessages: { type: Number, default: 0 },
    newLeads: { type: Number, default: 0 },
    followupsDone: { type: Number, default: 0 },
    demosScheduled: { type: Number, default: 0 },
    demosCompleted: { type: Number, default: 0 },
    proposalsSent: { type: Number, default: 0 },
    dealsClosed: { type: Number, default: 0 },
    dealValueInr: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

const DealSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientCompany: { type: String, required: true },
    contactPerson: { type: String, default: "" },
    services: { type: [String], default: [] },
    pricingPerCheck: { type: Number, default: 0 },
    monthlyVolume: { type: Number, default: 0 },
    contractDuration: { type: String, default: "" },
    totalValueInr: { type: Number, default: 0 },
    paymentTerms: { type: String, default: "" },
    specialTerms: { type: String, default: "" },
    onboardingDate: { type: String, default: "" },
  },
  { timestamps: true }
);

const FollowUpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    clientName: { type: String, required: true },
    contactPerson: { type: String, default: "" },
    mode: { type: String, default: "Phone Call" },
    summary: { type: String, default: "" },
    responseStatus: { type: String, default: "No Response" },
    nextAction: { type: String, default: "" },
    nextFollowUpDate: { type: String, default: "" },
  },
  { timestamps: true }
);

const ExpenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    expenseType: { type: String, required: true },
    amountInr: { type: Number, required: true },
    paymentMethod: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

const EmailLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: String, required: true },
    cc: { type: String, default: "" },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, default: "Sent" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const AttendanceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "leave", "halfday", "weekend"],
      required: true,
    },
    loginTime: { type: String, default: "" },
    logoutTime: { type: String, default: "" },
    tasks: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
export const Lead = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
export const DailyReport = mongoose.models.DailyReport || mongoose.model("DailyReport", DailyReportSchema);
export const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);
export const FollowUp = mongoose.models.FollowUp || mongoose.model("FollowUp", FollowUpSchema);
export const Expense = mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
export const EmailLog = mongoose.models.EmailLog || mongoose.model("EmailLog", EmailLogSchema);
export const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);

export function toObjectId(id: string) {
  return new Types.ObjectId(id);
}
