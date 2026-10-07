import mongoose from "mongoose";
import { createCatalogId } from "../utils/catalogIds.js";

const screenSchema = new mongoose.Schema(
  {
    screen_id: {
      type: String,
      required: true,
      unique: true,
      default: () => createCatalogId("SCR"),
    },
    theater_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

screenSchema.index({ theater_id: 1, name: 1 }, { unique: true });

export const Screen = mongoose.model("Screen", screenSchema);
export default Screen;
