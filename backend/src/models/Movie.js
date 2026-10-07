import mongoose from "mongoose";
import { createCatalogId } from "../utils/catalogIds.js";

const movieSeatSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 1, max: 3 },
    name: { type: String, required: true, trim: true },
    rows: { type: Number, required: true, min: 1 },
    seatsPerRow: { type: Number, required: true, min: 1 },
    totalSeats: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const movieSchema = new mongoose.Schema(
  {
    movie_id: {
      type: String,
      required: true,
      unique: true,
      default: () => createCatalogId("MOV"),
    },
    title: { type: String, required: true, trim: true },
    genre: { type: String, default: "General", trim: true },
    duration: { type: Number, default: 150 },
    rating: { type: Number, default: 0, min: 0, max: 10 },
    subtitle: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    posterUrl: { type: String },
    language: { type: String, trim: true },
    tags: [{ type: String }],
    seatLayout: { type: [movieSeatSectionSchema], default: [] },
    section1Seats: { type: Number, default: 0, min: 0 },
    section2Seats: { type: Number, default: 0, min: 0 },
    section3Seats: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

movieSchema.index({ title: 1 });

export const Movie = mongoose.model("Movie", movieSchema);
export default Movie;
