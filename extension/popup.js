// popup.js — EchoTrace Extension
// Behavioral analysis + Gemini AI for bot/synthetic content detection

// ──────────────────────────────────────────────
// UI Elements
// ──────────────────────────────────────────────
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const apiStatus = document.getElementById("apiStatus");

const notReddit = document.getElementById("notReddit");
const readyState = document.getElementById("readyState");
const loadingState = document.getElementById("loadingState");
const resultsState = document.getElementById("resultsState");

const analyzeBtn = document.getElementById("analyzeBtn");
const rescanBtn = document.getElementById("rescanBtn");
const pageInfo = document.getElementById("pageInfo");
const loadingStep = document.getElementById("loadingStep");

const scoreArc = document.getElementById("scoreArc");
const scoreValue = document.getElementById("scoreValue");
const scoreVerdict = document.getElementById("scoreVerdict");
const breakdown = document.getElementById("breakdown");
const geminiBody = document.getElementById("geminiBody");

// ──────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  if (!settingsPanel.classList.contains("hidden")) {
    chrome.storage.local.get("geminiApiKey", ({ geminiApiKey }) => {
      if (geminiApiKey) {
        apiKeyInput.value = geminiApiKey;
        apiStatus.textContent = "✓ API key saved";
      }
    });
  }
});

saveApiKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key || !key.startsWith("AIza")) {
    apiStatus.style.color = "#ef4444";
    apiStatus.textContent = "Invalid key — must start with AIza";
    return;
  }
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    apiStatus.style.color = "#10b981";
    apiStatus.textContent = "✓ Saved!";
    setTimeout(() => settingsPanel.classList.add("hidden"), 1000);
  });
});

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";

  if (!url.includes("reddit.com")) {
    showScreen(notReddit);
    return;
  }

  pageInfo.textContent = `📍 ${url.replace("https://www.", "").slice(0, 60)}${url.length > 70 ? "…" : ""}`;
  showScreen(readyState);
}

// ──────────────────────────────────────────────
// Analyze Button
// ──────────────────────────────────────────────
analyzeBtn.addEventListener("click", runAnalysis);
rescanBtn.addEventListener("click", () => { showScreen(readyState); });

async function runAnalysis() {
  showScreen(loadingState);
  setLoadingStep("Extracting page data...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script if needed (in case it wasn't loaded)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).catch(() => {}); // Ignore if already injected

    // Scrape page
    const response = await chrome.tabs.sendMessage(tab.id, { action: "scrapeReddit" });

    if (!response?.success) {
      throw new Error("Could not extract page data. Try refreshing Reddit.");
    }

    const redditData = response.data;
    setLoadingStep(`Analyzing ${redditData.comments.length} comments...`);

    // Run local behavioral analysis
    const analysis = analyzeForBots(redditData);

    setLoadingStep("Preparing AI explanation...");

    // Show results
    renderResults(analysis, redditData);

    // Call Gemini for explanation
    const { geminiApiKey } = await chrome.storage.local.get("geminiApiKey");
    if (geminiApiKey) {
      callGemini(analysis, redditData, geminiApiKey);
    } else {
      geminiBody.innerHTML = `<span class="no-key-msg">Add your Gemini API key in Settings (⚙) for AI-powered explanation.</span>`;
    }

  } catch (err) {
    showScreen(readyState);
    alert("Error: " + err.message);
  }
}

// ──────────────────────────────────────────────
// 🧠 Bot Detection Engine (Local Heuristics)
// ──────────────────────────────────────────────
function analyzeForBots(data) {
  const comments = data.comments;
  if (!comments.length) return nullResult();

  const authors = {};
  let shortCommentCount = 0;
  let genericPhraseCount = 0;
  let deepNestingCount = 0;
  let highScoreNewAccountPattern = 0;

  // Generic / bot-like phrases
  const botPhrases = [
    /this is (so |very )?(true|real|important|based)/i,
    /couldn't agree more/i,
    /well said/i,
    /great post/i,
    /exactly (what|this)/i,
    /this needs more upvotes/i,
    /underrated comment/i,
    /facts\.?$/i,
    /100%$/i,
    /\bthis\b$/i
  ];

  comments.forEach(c => {
    // Track author frequency
    if (!authors[c.author]) authors[c.author] = { count: 0, scores: [], shortComments: 0 };
    authors[c.author].count++;
    authors[c.author].scores.push(parseInt(c.score) || 0);

    // Short comments (< 30 chars)
    if (c.body.length < 30) {
      shortCommentCount++;
      authors[c.author].shortComments++;
    }

    // Generic phrases
    if (botPhrases.some(p => p.test(c.body))) genericPhraseCount++;

    // Deep nesting (vote brigading pattern)
    if (c.depth >= 3) deepNestingCount++;
  });

  // Author concentration (few authors, many comments = coordinated)
  const authorList = Object.values(authors);
  const totalComments = comments.length;
  const uniqueAuthors = authorList.length;
  const authorConcentrationRatio = uniqueAuthors > 0 ? (totalComments / uniqueAuthors) : 1;

  // Top author dominance
  const maxByOneAuthor = Math.max(...authorList.map(a => a.count));
  const topAuthorDominance = maxByOneAuthor / totalComments;

  // Repetition score (same author posting many times)
  const repeatAuthors = authorList.filter(a => a.count >= 3).length;
  const repeatRatio = repeatAuthors / Math.max(uniqueAuthors, 1);

  // Score calculations (0–100 each)
  const scores = {
    "Short/Generic Comments": Math.min(100, Math.round((shortCommentCount / totalComments) * 100 * 1.2)),
    "Bot-like Phrases": Math.min(100, Math.round((genericPhraseCount / totalComments) * 150)),
    "Author Concentration": Math.min(100, Math.round(topAuthorDominance * 200)),
    "Repeat Posting": Math.min(100, Math.round(repeatRatio * 160)),
    "Deep Nesting Patterns": Math.min(100, Math.round((deepNestingCount / totalComments) * 80))
  };

  const overallScore = Math.min(100, Math.round(
    scores["Short/Generic Comments"] * 0.25 +
    scores["Bot-like Phrases"] * 0.30 +
    scores["Author Concentration"] * 0.20 +
    scores["Repeat Posting"] * 0.15 +
    scores["Deep Nesting Patterns"] * 0.10
  ));

  return {
    overallScore,
    scores,
    stats: {
      totalComments,
      uniqueAuthors,
      authorConcentrationRatio: authorConcentrationRatio.toFixed(2),
      shortCommentRatio: ((shortCommentCount / totalComments) * 100).toFixed(1),
      genericPhraseRatio: ((genericPhraseCount / totalComments) * 100).toFixed(1),
      topAuthorPct: (topAuthorDominance * 100).toFixed(1)
    }
  };
}

function nullResult() {
  return {
    overallScore: 0,
    scores: { "No Data": 0 },
    stats: { totalComments: 0, uniqueAuthors: 0 }
  };
}

// ──────────────────────────────────────────────
// 🎨 Render Results
// ──────────────────────────────────────────────
function renderResults(analysis, redditData) {
  showScreen(resultsState);

  const score = analysis.overallScore;

  // Animate score arc (circumference = 314 for r=50)
  const offset = 314 - (314 * score / 100);
  let color = score >= 60 ? "#ef4444" : score >= 30 ? "#f59e0b" : "#10b981";

  scoreArc.style.stroke = color;
  setTimeout(() => { scoreArc.style.strokeDashoffset = offset; }, 50);

  // Animate number
  animateNumber(scoreValue, 0, score, 1000);

  // Verdict
  let verdictText, verdictClass;
  if (score >= 60) {
    verdictText = "⚠️ High Bot Activity";
    verdictClass = "verdict-high";
  } else if (score >= 30) {
    verdictText = "⚡ Moderate Suspicion";
    verdictClass = "verdict-medium";
  } else {
    verdictText = "✅ Looks Mostly Human";
    verdictClass = "verdict-low";
  }
  scoreVerdict.textContent = verdictText;
  scoreVerdict.className = `score-verdict ${verdictClass}`;

  // Breakdown bars
  breakdown.innerHTML = "";
  Object.entries(analysis.scores).forEach(([name, pct]) => {
    const barColor = pct >= 60 ? "#ef4444" : pct >= 30 ? "#f59e0b" : "#10b981";
    breakdown.innerHTML += `
      <div class="breakdown-item">
        <div class="breakdown-row">
          <span class="breakdown-name">${name}</span>
          <span class="breakdown-pct" style="color:${barColor}">${pct}%</span>
        </div>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${pct}%; background:${barColor}"></div>
        </div>
      </div>
    `;
  });

  // Gemini loading animation
  geminiBody.innerHTML = `
    <div class="gemini-loading">
      <span class="dot-bounce">●</span>
      <span class="dot-bounce" style="animation-delay:.2s">●</span>
      <span class="dot-bounce" style="animation-delay:.4s">●</span>
    </div>`;
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + (to - from) * progress) + "%";
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ──────────────────────────────────────────────
// ✨ Gemini AI Explanation
// ──────────────────────────────────────────────
async function callGemini(analysis, redditData, apiKey) {
  const stats = analysis.stats;
  const prompt = `You are EchoTrace, an AI analyst specialized in detecting synthetic bot activity on social media.

Analyze this Reddit page data and explain your findings in 3-4 sentences. Be specific and insightful. Mention the most suspicious signals.

PAGE: ${redditData.pageType} on r/${redditData.subreddit}
TITLE: "${redditData.postTitle}"
SYNTHETIC SCORE: ${analysis.overallScore}/100

BEHAVIORAL SIGNALS:
- Total comments scraped: ${stats.totalComments}
- Unique authors: ${stats.uniqueAuthors}
- Short/generic comment ratio: ${stats.shortCommentRatio}%
- Bot-phrase usage rate: ${stats.genericPhraseRatio}%
- Top single author dominance: ${stats.topAuthorPct}% of comments

BREAKDOWN SCORES:
${Object.entries(analysis.scores).map(([k, v]) => `- ${k}: ${v}/100`).join("\n")}

Give a clear, direct explanation of what these signals mean. If score is low, explain why it looks human. If score is high, explain the specific bot-like patterns detected. End with a one-line recommendation.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
        })
      }
    );

    const data = await res.json();

    if (data.error) {
      geminiBody.innerHTML = `<span class="no-key-msg">⚠ Gemini error: ${data.error.message}</span>`;
      return;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    geminiBody.innerHTML = text.replace(/\n/g, "<br>");

  } catch (e) {
    geminiBody.innerHTML = `<span class="no-key-msg">⚠ Could not reach Gemini API. Check your key and internet.</span>`;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function showScreen(el) {
  [notReddit, readyState, loadingState, resultsState].forEach(s => s.classList.add("hidden"));
  el.classList.remove("hidden");
}

function setLoadingStep(text) {
  loadingStep.textContent = text;
}

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
init();