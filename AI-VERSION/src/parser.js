import * as cheerio from "cheerio";
import { cleanPrice, cleanRating } from "./schema.js";

/** Resolve a possibly-relative href/src against the page it was found on. */
function toAbsolute(maybeRelative, pageUrl) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, pageUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Parses a catalogue page.
 * Returns { rawBooks, nextUrl } where rawBooks are the still-unvalidated
 * fields for each product on the page, and nextUrl is the absolute URL
 * of the "next" pagination link (or null on the last page).
 */
export function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);

  const rawBooks = $("article.product_pod")
    .map((_, el) => {
      const $el = $(el);
      const link = $el.find("h3 a");
      const img = $el.find("div.image_container img");

      return {
        title: link.attr("title") ?? link.text(),
        priceRaw: $el.find(".price_color").first().text(),
        availabilityRaw: $el.find(".availability").text(),
        ratingClass: $el.find("p.star-rating").attr("class") ?? "",
        url: toAbsolute(link.attr("href"), pageUrl),
        image: toAbsolute(img.attr("src"), pageUrl),
        sourcePage: pageUrl,
      };
    })
    .get();

  const nextHref = $("ul.pager li.next a").attr("href");
  const nextUrl = toAbsolute(nextHref, pageUrl);

  return { rawBooks, nextUrl };
}

/** Turns one raw scraped record into the shape the Zod schema expects. */
export function toCandidate(raw) {
  return {
    title: raw.title?.trim(),
    price: cleanPrice(raw.priceRaw),
    currency: "GBP",
    availability: raw.availabilityRaw?.trim(),
    inStock: /in stock/i.test(raw.availabilityRaw ?? ""),
    rating: cleanRating(raw.ratingClass),
    url: raw.url,
    image: raw.image,
    sourcePage: raw.sourcePage,
  };
}
