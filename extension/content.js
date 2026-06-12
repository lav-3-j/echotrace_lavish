// content.js — Injected into Reddit pages
// Scrapes post + comment data for EchoTrace analysis

(function () {
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeReddit") {
      try {
        const data = scrapeRedditPage();
        sendResponse({ success: true, data });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    }
    return true; // Keep channel open for async
  });

  function scrapeRedditPage() {
    const url = window.location.href;
    const isPost = url.includes("/comments/");
    const isSubreddit = !isPost;

    let result = {
      url,
      pageType: isPost ? "post" : "subreddit",
      postTitle: "",
      subreddit: "",
      comments: [],
      postMeta: {}
    };

    // Extract subreddit name
    const subMatch = url.match(/reddit\.com\/r\/([^\/]+)/);
    result.subreddit = subMatch ? subMatch[1] : "unknown";

    if (isPost) {
      // --- Scrape Post Page ---

      // Post title (new Reddit)
      const titleEl = document.querySelector('h1[slot="title"], div[data-testid="post-container"] h1, [data-click-id="text"] h1');
      result.postTitle = titleEl ? titleEl.innerText.trim() : document.title;

      // Post metadata
      const scoreEl = document.querySelector('[data-testid="post-container"] [data-click-id="upvote"] ~ span, faceplate-number[pretty]');
      const authorEl = document.querySelector('a[data-testid="post_author_link"], [data-testid="post_author_link"]');
      result.postMeta = {
        score: scoreEl ? scoreEl.innerText : "N/A",
        author: authorEl ? authorEl.innerText.replace("u/", "") : "unknown",
        commentCount: 0
      };

      // Scrape comments (new Reddit uses shreddit-comment or old-style divs)
      const commentEls = document.querySelectorAll(
        'shreddit-comment, div[data-testid="comment"], .Comment, [data-type="comment"]'
      );

      commentEls.forEach((el, i) => {
        if (i > 80) return; // Cap at 80 comments

        // Author
        const authorLink = el.querySelector('a[href*="/user/"], [slot="commentMeta"] a');
        const author = authorLink ? authorLink.innerText.replace("u/", "").trim() : "unknown";

        // Body text
        const bodyEl = el.querySelector('[slot="comment"], div[data-testid="comment-top-meta"] ~ div p, .RichTextJSON-root');
        const body = bodyEl ? bodyEl.innerText.trim().slice(0, 400) : "";

        // Score/upvotes
        const scoreSpan = el.querySelector('faceplate-number, [aria-label*="point"], .score');
        const score = scoreSpan ? scoreSpan.innerText : "0";

        // Depth (nesting level)
        const depth = el.getAttribute("depth") || el.closest('[data-testid="comment"]')?.style?.marginLeft || "0";

        if (body) {
          result.comments.push({ author, body, score, depth: parseInt(depth) || 0, index: i });
        }
      });

      result.postMeta.commentCount = result.comments.length;

    } else {
      // --- Scrape Subreddit Feed ---
      result.postTitle = `r/${result.subreddit} feed`;

      const postEls = document.querySelectorAll(
        'article, [data-testid="post-container"], shreddit-post'
      );

      postEls.forEach((el, i) => {
        if (i > 30) return;
        const author = el.querySelector('a[data-testid="post_author_link"], [slot="authorName"]')?.innerText || "unknown";
        const title = el.querySelector('h3, h2, [slot="title"]')?.innerText?.trim() || "";
        const score = el.querySelector('faceplate-number, [id*="vote-arrows"] ~ span')?.innerText || "0";

        if (title) {
          result.comments.push({ author, body: title, score, depth: 0, index: i });
        }
      });
    }

    return result;
  }
})();
