import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from analyzers import (
    linguistic_score,
    sentiment_score,
    temporal_score,
    coordination_score,
    get_graph_data,
    fusion
)

load_dotenv()

app = FastAPI(title="EchoTrace AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Payload(BaseModel):
    comments: list[str]
    timestamps: list[float]
    mentions: list[list[str]]


def get_explanation(scores: dict, classification: str) -> str:
    def rule_based():
        strongest = max(scores.items(), key=lambda x: x[1])
        label_map = {
            "linguistic":   "semantic similarity between comments",
            "sentiment":    "emotional uniformity across the thread",
            "temporal":     "inhuman timing patterns between replies",
            "coordination": "tight account coordination topology"
        }
        label = label_map.get(strongest[0], strongest[0])
        return (
            f"The strongest signal was {label} at {strongest[1]}%, "
            f"indicating {classification.lower()} behavior patterns. "
            f"Combined analysis across all four behavioral layers "
            f"confirms this classification."
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return rule_based()

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            f"A social media thread was analyzed for synthetic amplification.\n"
            f"Results:\n"
            f"- Linguistic similarity: {scores['linguistic']}% "
            f"(high means comments are suspiciously similar in meaning)\n"
            f"- Sentiment uniformity: {scores['sentiment']}% "
            f"(high means everyone expresses identical emotion)\n"
            f"- Temporal anomaly: {scores['temporal']}% "
            f"(high means replies appeared at inhuman speed)\n"
            f"- Coordination index: {scores['coordination']}% "
            f"(high means accounts are tightly clustered)\n"
            f"Final verdict: {classification}\n\n"
            f"Write exactly 2 sentences explaining this verdict. "
            f"Reference the specific scores. "
            f"No intro phrases. Just explanation directly."
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return rule_based()


@app.get("/health")
def health():
    return {"status": "ok", "service": "EchoTrace AI"}


@app.post("/analyze")
async def analyze(data: Payload):
    start = time.time()

    l = linguistic_score(data.comments)
    s = sentiment_score(data.comments)
    t = temporal_score(data.timestamps)
    c = coordination_score(data.mentions)
    score = fusion(l, s, t, c)

    if score > 70:
        classification = "Bot Swarm"
        confidence = "High"
        action = "Flag + Escalate to Human Review"
    elif score > 40:
        classification = "Mixed Activity"
        confidence = "Medium"
        action = "Monitor + Flag for Review"
    else:
        classification = "Human"
        confidence = "High"
        action = "No Action Required"

    scores = {
        "linguistic":    round(l * 100, 1),
        "sentiment":     round(s * 100, 1),
        "temporal":      round(t * 100, 1),
        "coordination":  round(c * 100, 1),
    }

    return {
        "synthetic_score": score,
        **scores,
        "classification":  classification,
        "confidence":      confidence,
        "action":          action,
        "explanation":     get_explanation(scores, classification),
        "graph":           get_graph_data(data.mentions),
        "analysis_time":   round(time.time() - start, 2)
    }