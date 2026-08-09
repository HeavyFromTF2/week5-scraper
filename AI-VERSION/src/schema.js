import { z } from "zod";

// "Three" -> 3, etc. Anything unrecognised becomes NaN and fails validation.
const RATING_WORDS = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };

/** "£51.77" -> 51.77 (number). Returns NaN if nothing numeric is found. */
export function cleanPrice(rawText = "") {
  const match = String(rawText).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

/** "star-rating Three" -> 3 */
export function cleanRating(starRatingClass = "") {
  const word = String(starRatingClass).replace(/star-rating/i, "").trim();
  return RATING_WORDS[word] ?? NaN;
}

export const BookSchema = z.object({
  title: z.string().trim().min(1, "title is empty"),
  price: z.number({ invalid_type_error: "price is not numeric" }).positive("price must be > 0"),
  currency: z.string().min(1),
  availability: z.string().trim().min(1),
  inStock: z.boolean(),
  rating: z.number().int().min(1).max(5),
  url: z.string().url("url is not a valid absolute URL"),
  image: z.string().url("image is not a valid absolute URL"),
  sourcePage: z.string().url(),
});
