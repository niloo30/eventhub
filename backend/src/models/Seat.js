import mongoose from "mongoose";
import { createCatalogId } from "../utils/catalogIds.js";

const seatSchema = new mongoose.Schema(
  {
    seat_id: {
      type: String,
      required: true,
      unique: true,
      default: () => createCatalogId("SET"),
    },
    screen_id: { type: String, required: true, index: true },
    label: { type: String, required: true, trim: true },
    row: { type: String, required: true, trim: true },
    number: { type: Number, required: true },
    section: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
  },
  { timestamps: true },
);

seatSchema.index({ screen_id: 1, row: 1, number: 1 }, { unique: true });

export const Seat = mongoose.model("Seat", seatSchema);
export default Seat;
