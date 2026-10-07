import mongoose from "mongoose";
import { createCatalogId } from "../utils/catalogIds.js";

const showSchema = new mongoose.Schema(
  {
    show_id: {
      type: String,
      required: true,
      unique: true,
      default: () => createCatalogId("SHW"),
    },
    movie_id: { type: String, required: true, index: true },
    screen_id: { type: String, required: true, index: true },
    type: { type: String, enum: ["movie"], default: "movie" },
    date: { type: Date, required: true },
    currency: { type: String, default: "INR" },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

showSchema.index({ movie_id: 1, date: 1 });
showSchema.index({ screen_id: 1, date: 1 });

export const Show = mongoose.model("Show", showSchema);
export default Show;
