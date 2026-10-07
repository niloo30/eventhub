import mongoose from 'mongoose';

const ticketSeatReservationSchema = new mongoose.Schema(
  {
    show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketBooking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seatId: { type: String, required: true },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    section: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ['held', 'booked'], default: 'held' },
    holdExpiresAt: { type: Date },
  },
  { timestamps: true }
);

ticketSeatReservationSchema.index({ show: 1, seatId: 1 }, { unique: true });
ticketSeatReservationSchema.index({ show: 1, status: 1, holdExpiresAt: 1 });

export const TicketSeatReservation = mongoose.model('TicketSeatReservation', ticketSeatReservationSchema);
export default TicketSeatReservation;
