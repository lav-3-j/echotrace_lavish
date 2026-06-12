import numpy as np
from sentence_transformers import SentenceTransformer, util
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import networkx as nx

print("Loading models...")
_bert = SentenceTransformer('all-MiniLM-L6-v2')
_vader = SentimentIntensityAnalyzer()
print("Models ready.")


def linguistic_score(comments: list) -> float:
    if len(comments) < 2:
        return 0.0
    embeddings = _bert.encode(comments, convert_to_tensor=True)
    sim_matrix = util.cos_sim(embeddings, embeddings).numpy()
    rows, cols = np.triu_indices(len(comments), k=1)
    return float(np.mean(sim_matrix[rows, cols]))


def sentiment_score(comments: list) -> float:
    if len(comments) < 2:
        return 0.0
    scores = [_vader.polarity_scores(c)['compound'] for c in comments]
    variance = float(np.var(scores))
    return max(0.0, 1.0 - (variance * 5))


def temporal_score(timestamps: list) -> float:
    if len(timestamps) < 2:
        return 0.0
    gaps = np.diff(sorted(timestamps))
    if len(gaps) == 0:
        return 0.0
    inhuman = sum(1 for g in gaps if g < 3)
    return float(inhuman / len(gaps))


def coordination_score(mentions_list: list) -> float:
    G = nx.Graph()
    for mentions in mentions_list:
        for i in range(len(mentions)):
            for j in range(i + 1, len(mentions)):
                G.add_edge(mentions[i], mentions[j])
    if len(G.nodes) == 0:
        return 0.0
    return float(nx.average_clustering(G))


def get_graph_data(mentions_list: list) -> dict:
    G = nx.Graph()
    for mentions in mentions_list:
        for i in range(len(mentions)):
            for j in range(i + 1, len(mentions)):
                G.add_edge(mentions[i], mentions[j])
    return {
        "nodes": [{"id": n} for n in G.nodes()],
        "edges": [{"source": e[0], "target": e[1]} for e in G.edges()]
    }


def fusion(l: float, s: float, t: float, c: float) -> float:
    raw = (l * 0.35) + (s * 0.25) + (t * 0.25) + (c * 0.15)
    return round(min(raw * 100, 100.0), 1)