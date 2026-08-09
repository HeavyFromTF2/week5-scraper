import http from "node:http";

function bookArticle(i, opts = {}) {
  const price = opts.badPrice ? "n/a" : `£${(10 + i).toFixed(2)}`;
  const rating = opts.badRating ? "star-rating Weird" : "star-rating Three";
  const title = opts.emptyTitle ? "" : `Test Book ${i}`;
  return `
    <li class="col-xs-6 col-sm-4 col-md-3 col-lg-3">
      <article class="product_pod">
        <div class="image_container">
          <a href="../../catalogue/test-book-${i}_${i}/index.html"><img src="../../media/cache/book-${i}.jpg" /></a>
        </div>
        <p class="${rating}"></p>
        <h3><a href="../../catalogue/test-book-${i}_${i}/index.html" title="Test Book ${i}">${title}</a></h3>
        <div class="product_price">
          <p class="price_color">${price}</p>
          <p class="instock availability"><i class="icon-ok"></i> In stock</p>
        </div>
      </article>
    </li>`;
}

function page(n, { next, badItem }) {
  const items = Array.from({ length: 20 }, (_, idx) => {
    const i = (n - 1) * 20 + idx + 1;
    if (badItem && idx === 0) return bookArticle(i, { badPrice: true });
    return bookArticle(i);
  }).join("\n");

  const pager = next
    ? `<ul class="pager"><li class="next"><a href="${next}">next</a></li></ul>`
    : `<ul class="pager"></ul>`;

  return `<!DOCTYPE html><html><body>
    <div class="page">
      <ol>${items}</ol>
      ${pager}
    </div>
  </body></html>`;
}

const server = http.createServer((req, res) => {
  const url = req.url;

  if (url === "/index.html" || url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page(1, { next: "catalogue/page-2.html" }));
    return;
  }

  if (url === "/catalogue/page-2.html") {
    // simulate a broken page (404) to exercise the error-catching path
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }

  if (url === "/catalogue/page-3.html") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page(3, { next: null, badItem: true }));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not Found");
});

const PORT = 4173;
server.listen(PORT, () => {
  console.log(`mock server on http://127.0.0.1:${PORT}/index.html`);
});
