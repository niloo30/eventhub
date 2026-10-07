import mongoose from "mongoose";
import { createCatalogId } from "../utils/catalogIds.js";

const theaterSchema = new mongoose.Schema(
  {
    theater_id: {
      type: String,
      required: true,
      unique: true,
      default: () => createCatalogId("THR"),
    },
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

theaterSchema.index({ name: 1, city: 1 }, { unique: true });

export const Theater = mongoose.model("Theater", theaterSchema);
export default Theater;
