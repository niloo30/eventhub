import { useContext } from "react";
import LocationContext from "./locationContext.js";

export function useLocationSelection() {
  const value = useContext(LocationContext);

  if (!value) {
    throw new Error("useLocationSelection must be used within LocationProvider.");
  }

  return value;
}
