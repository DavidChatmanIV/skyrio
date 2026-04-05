import { Duffel } from "@duffel/api";

const token = process.env.DUFFEL_API_KEY;

if (!token) {
  console.warn("⚠️ Missing DUFFEL_API_KEY");
}

export const duffel = new Duffel({
  token,
});