import mongoose from "mongoose";

const eventTicketOptionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, default: 0, min: 0 },
    capacity: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    capacity: { type: Number, default: 0 },
    permanentBookingPrice: { type: Number, default: 0, min: 0 },
    ticketOptions: { type: [eventTicketOptionSchema], default: [] },
    currency: { type: String, default: "INR", uppercase: true, trim: true },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    posterUrl: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    sentForApprovalAt: { type: Date },
    tags: [{ type: String }],
    averageRating: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Event = mongoose.model("Event", eventSchema);
export default Event;
