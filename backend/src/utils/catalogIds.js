import crypto from "crypto";

export function createCatalogId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export default createCatalogId;
