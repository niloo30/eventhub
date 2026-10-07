import { Readable } from "stream";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

const cloudinaryConfigured = Boolean(
  env.cloudinaryCloudName &&
    env.cloudinaryApiKey &&
    env.cloudinaryApiSecret,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

function sanitizeSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isCloudinaryConfigured() {
  return cloudinaryConfigured;
}

export function uploadImageBuffer(buffer, options = {}) {
  if (!cloudinaryConfigured) {
    throw new Error("Cloudinary is not configured.");
  }

  const originalName = options.originalName || "poster";
  const fileName = sanitizeSegment(path.parse(originalName).name) || "poster";
  const folder = [env.cloudinaryFolder, options.folder]
    .filter(Boolean)
    .join("/");

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: folder || undefined,
        public_id: `${fileName}-${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}
