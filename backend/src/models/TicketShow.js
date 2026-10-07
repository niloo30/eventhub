import mongoose from 'mongoose';

const ticketSeatSchema = new mongoose.Schema(
  {
    seatId: { type: String, required: true },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    section: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const ticketShowSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['movie', 'concert', 'match'], required: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: String, required: true },
    venue: { type: String, required: true },
    city: { type: String, required: true },
    date: { type: Date, required: true },
    durationMinutes: { type: Number, default: 150 },
    currency: { type: String, default: 'INR' },
    posterUrl: { type: String },
    language: { type: String },
    featured: { type: Boolean, default: false },
    tags: [{ type: String }],
    seats: { type: [ticketSeatSchema], default: [] },
  },
  { timestamps: true }
);

ticketShowSchema.index({ type: 1, date: 1 });

export const TicketShow = mongoose.model('TicketShow', ticketShowSchema);
export default TicketShow;
