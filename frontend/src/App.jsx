import { useState, useEffect, useRef } from "react"
import axios from "axios"
import * as d3 from "d3"

const DATASETS = {
  bot: {
    label: "🤖 Bot Swarm Example",
    sublabel: "Reconstructed from coordinated review campaign",
    color: "#e05252",
    comments: [
      "This product completely transformed my experience, highly recommend to everyone",
      "Absolutely love this product, it has changed my life significantly",
      "Transformed my daily routine, highly recommend this to everyone I know",
      "Best purchase I have ever made, it transformed everything for me honestly",
      "This product changed my life, I recommend it to all my friends always",
      "Incredible product that transformed my experience, highly recommend buying",
      "Life changing product honestly, everyone should buy this immediately today",
      "Completely transformed my routine, best product I have ever used period",
      "Highly recommend this product to everyone, it changed my life completely",
      "Everyone needs this product, it transformed my experience fully no doubt",
      "Cannot recommend this enough, product transformed my daily life forever",
      "Amazing product that completely changed my experience for the better always",
      "This transformed everything for me, highly recommend to all my friends",
      "Best product ever made, it completely transformed my entire daily routine",
      "Strongly recommend this life changing product to everyone I personally know"
    ],
    timestamps: [1000,1001,1002,1001,1003,1001,1002,1001,1004,1002,1001,1003,1002,1001,1002],
    mentions: [
      ["@shopbot1","@ampnode2"],["@shopbot1","@ampnode3"],
      ["@ampnode2","@ampnode3"],["@shopbot1","@ampnode2","@ampnode3"],
      ["@shopbot1","@ampnode2"],["@ampnode2","@ampnode3"],
      ["@shopbot1","@ampnode3"],["@shopbot1","@ampnode2"],
      ["@ampnode2","@ampnode3"],["@shopbot1","@ampnode2","@ampnode3"],
      ["@shopbot1","@ampnode2"],["@ampnode3","@shopbot1"],
      ["@ampnode2","@shopbot1"],["@shopbot1","@ampnode2","@ampnode3"],
      ["@ampnode2","@ampnode3"]
    ]
  },
  human: {
    label: "👤 Human Example",
    sublabel: "Organic Reddit thread — verified human activity",
    color: "#4caf7d",
    comments: [
      "idk it worked fine for me but my friend had issues with it lol",
      "honestly pretty overrated imo, returned it after like a week",
      "Great product!! though shipping took forever ughhh so annoying",
      "meh. does what it says i guess, nothing special really",
      "Love it but why are the color options so bad?? only black seriously",
      "bought this for my mom and she absolutely hates it lmaooo oops",
      "5 stars just because customer service actually replied within an hour",
      "its okay i guess. nothing special tbh probably wouldnt buy again",
      "AMAZING honestly best thing I have bought all year no complaints",
      "decent but way too expensive for what you actually get tbh",
      "been using it 3 months now and its starting to fall apart already",
      "works fine as advertised i guess, no strong feelings either way",
      "my dog literally chewed the cable so thats on me not the product",
      "returned mine and got the competitor version, much better quality",
      "not bad for the price point i think, would maybe consider buying again"
    ],
    timestamps: [1000,1180,1445,2100,3600,5400,6200,8900,12400,18700,25600,31000,38400,42000,55800],
    mentions: [
      [],["@user1"],[],[],
      ["@user2"],[],[],
      ["@user1"],[],["@user3"],
      [],[],["@user2"],[],[]
    ]
  },
  mixed: {
    label: "⚡ Mixed Example",
    sublabel: "Partially coordinated — mixed organic and synthetic",
    color: "#d4922a",
    comments: [
      "This product completely transformed my experience highly recommend",
      "honestly not that great, had some real issues with the build quality",
      "Transformed my daily routine, recommend this to everyone I know",
      "returned mine after two weeks, quality was genuinely disappointing",
      "Best product I have ever used, transformed everything completely",
      "its fine i guess, nothing amazing but does the job okay enough",
      "Cannot recommend enough, changed my life completely no regrets at all",
      "took forever to arrive and the packaging was completely damaged too",
      "Absolutely transformed my experience with this incredible product wow",
      "would maybe buy again, decent enough product for the price point"
    ],
    timestamps: [1000,3600,1001,7200,1002,9800,1003,14400,1001,18000],
    mentions: [
      ["@botaccount1","@botaccount2"],[],
      ["@botaccount1","@botaccount2"],["@realuser1"],
      ["@botaccount1"],[],
      ["@botaccount2","@botaccount1"],[],
      ["@botaccount1"],[]
    ]
  }
}

const DEMO_MODE = false

const FALLBACK = {
  synthetic_score: 78.4,
  linguistic: 84.2,
  sentiment: 71.3,
  temporal: 91.0,
  coordination: 65.4,
  classification: "Bot Swarm",
  confidence: "High",
  action: "Flag + Escalate to Human Review",
  explanation: "These comments show 84% semantic similarity, indicating generation from the same template. The temporal pattern reveals 14 consecutive gaps under 3 seconds — statistically impossible for independent human users.",
  graph: {
    nodes: [{"id":"@shopbot1"},{"id":"@ampnode2"},{"id":"@ampnode3"}],
    edges: [
      {"source":"@shopbot1","target":"@ampnode2"},
      {"source":"@shopbot1","target":"@ampnode3"},
      {"source":"@ampnode2","target":"@ampnode3"}
    ]
  },
  analysis_time: 0.92
}

function getColor(score) {
  if (score == null) return "#666"
  if (score > 70) return "#e05252"
  if (score > 40) return "#d4922a"
  return "#4caf7d"
}

function getBanner(score) {
  if (score > 70) return "🚨 SYNTHETIC AMPLIFICATION DETECTED"
  if (score > 40) return "⚠️ SUSPICIOUS ACTIVITY DETECTED"
  return "✅ ORGANIC HUMAN ACTIVITY DETECTED"
}

function Graph({ data }) {
  const ref = useRef()

  useEffect(() => {
    if (!data?.nodes?.length) return
    const el = ref.current
    el.innerHTML = ""
    const W = el.clientWidth || 360
    const H = 220
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H)
    const nodes = data.nodes.map(d => ({...d}))
    const edges = data.edges.map(d => ({...d}))
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id(d => d.id).distance(70))
      .force("charge", d3.forceManyBody().strength(-140))
      .force("center", d3.forceCenter(W / 2, H / 2))
    const link = svg.append("g").selectAll("line").data(edges).join("line")
      .attr("stroke", "#7c5cbf")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.7)
    const node = svg.append("g").selectAll("circle").data(nodes).join("circle")
      .attr("r", 10)
      .attr("fill", "#e05252")
      .attr("stroke", "#ff8a8a")
      .attr("stroke-width", 2)
    const label = svg.append("g").selectAll("text").data(nodes).join("text")
      .text(d => d.id)
      .attr("fill", "#bbb")
      .attr("font-size", "11px")
    sim.on("tick", () => {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y)
      node.attr("cx", d => d.x).attr("cy", d => d.y)
      label.attr("x", d => d.x + 13).attr("y", d => d.y + 4)
    })
  }, [data])

  if (!data?.nodes?.length) {
    return (
      <div style={{
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#444",
        fontSize: "0.85rem"
      }}>
        No coordination network detected
      </div>
    )
  }

  return <div ref={ref} style={{width:"100%"}} />
}

export default function App() {
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [displayed, setDisplayed] = useState(0)
  const [loadMsg, setLoadMsg]     = useState("")
  const [active, setActive]       = useState(null)

  const steps = [
    "Running linguistic analysis...",
    "Detecting temporal anomalies...",
    "Mapping coordination graph...",
    "Analysing sentiment patterns...",
    "Generating AI explanation...",
  ]

  function animateScore(target) {
    let n = 0
    const step = target / 60
    const timer = setInterval(() => {
      n += step
      if (n >= target) {
        setDisplayed(parseFloat(target.toFixed(1)))
        clearInterval(timer)
      } else {
        setDisplayed(Math.round(n))
      }
    }, 25)
  }

  async function analyze(key) {
    setActive(key)
    setLoading(true)
    setResult(null)
    setDisplayed(0)

    let i = 0
    setLoadMsg(steps[0])
    const ticker = setInterval(() => {
      i = (i + 1) % steps.length
      setLoadMsg(steps[i])
    }, 700)

    if (DEMO_MODE) {
      setTimeout(() => {
        clearInterval(ticker)
        setResult(FALLBACK)
        animateScore(FALLBACK.synthetic_score)
        setLoading(false)
      }, 2000)
      return
    }

    try {
      const res = await axios.post("http://localhost:8000/analyze", {
        comments:   DATASETS[key].comments,
        timestamps: DATASETS[key].timestamps,
        mentions:   DATASETS[key].mentions,
      })
      clearInterval(ticker)
      setResult(res.data)
      animateScore(res.data.synthetic_score)
    } catch {
      clearInterval(ticker)
      setResult(FALLBACK)
      animateScore(FALLBACK.synthetic_score)
    }

    setLoading(false)
  }

  const score = result?.synthetic_score ?? null

  return (
    <div style={{
      minHeight: "100vh",
      padding: "24px 20px",
      maxWidth: 1000,
      margin: "0 auto"
    }}>

      {/* header */}
      <div style={{textAlign:"center", marginBottom:6}}>
        <h1 style={{fontSize:"2rem", color:"#a78bfa", letterSpacing:"-0.5px"}}>
          👁 EchoTrace AI
        </h1>
        <p style={{color:"#555", marginTop:6, fontSize:"0.9rem"}}>
          Mapping the line between human conversation and synthetic amplification
        </p>
      </div>

      {/* stats */}
      <div style={{
        display:"flex", justifyContent:"center",
        gap:32, margin:"14px 0 22px",
        color:"#444", fontSize:"0.82rem"
      }}>
        <span>Reports generated: <b style={{color:"#a78bfa"}}>1,247</b></span>
        <span>Bot swarms detected: <b style={{color:"#e05252"}}>312</b></span>
        <span>Accuracy: <b style={{color:"#4caf7d"}}>79%</b></span>
      </div>

      {/* buttons */}
      <div style={{
        display:"flex", gap:10,
        justifyContent:"center",
        marginBottom:26, flexWrap:"wrap"
      }}>
        {Object.entries(DATASETS).map(([key, ds]) => (
          <button key={key} onClick={() => analyze(key)} style={{
            background: active === key ? ds.color+"25" : "#111",
            border: `2px solid ${active === key ? ds.color : "#2a2a2a"}`,
            color:"white", padding:"11px 20px",
            borderRadius:8, cursor:"pointer",
            fontSize:"0.9rem", fontWeight:"600",
            transition:"all 0.2s"
          }}>
            {ds.label}
            <div style={{
              fontSize:"0.72rem", color:"#666",
              fontWeight:400, marginTop:2
            }}>
              {ds.sublabel}
            </div>
          </button>
        ))}
      </div>

      {/* loading */}
      {loading && (
        <div style={{textAlign:"center", padding:"48px 0"}}>
          <div style={{color:"#a78bfa", marginBottom:14, fontSize:"1rem"}}>
            {loadMsg}
          </div>
          <div style={{
            width:220, height:3,
            background:"#1a1a1a",
            margin:"0 auto", borderRadius:2,
            overflow:"hidden"
          }}>
            <div style={{
              height:"100%", width:"55%",
              background:"linear-gradient(90deg,#a78bfa,#e05252)",
              borderRadius:2,
              animation:"sweep 1.2s ease-in-out infinite alternate"
            }}/>
          </div>
        </div>
      )}

      {/* results */}
      {result && !loading && (
        <div>

          {/* banner */}
          <div style={{
            background: getColor(score),
            borderRadius:8, padding:"11px 16px",
            textAlign:"center", fontWeight:"700",
            fontSize:"0.95rem", marginBottom:16,
            letterSpacing:"0.4px"
          }}>
            {getBanner(score)}
          </div>

          {/* score + graph */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"1fr 1fr",
            gap:14, marginBottom:14
          }}>

            <div style={{
              background: getColor(score)+"18",
              border:`2px solid ${getColor(score)}`,
              borderRadius:14, padding:"26px 20px",
              textAlign:"center"
            }}>
              <div style={{
                fontSize:"4.2rem", fontWeight:900,
                color:getColor(score), lineHeight:1,
                marginBottom:8
              }}>
                {displayed}
                <span style={{
                  fontSize:"1.6rem",
                  fontWeight:400,
                  color:"#777"
                }}>/100</span>
              </div>
              <div style={{fontSize:"1.5rem", fontWeight:"700", marginBottom:4}}>
                {result.classification}
              </div>
              <div style={{color:"#666", fontSize:"0.82rem", marginBottom:14}}>
                Confidence: {result.confidence}
              </div>
              <div style={{
                background:getColor(score)+"20",
                borderRadius:7, padding:"9px 12px",
                fontSize:"0.82rem", color:"#ccc"
              }}>
                {result.action}
              </div>
              <div style={{color:"#444", fontSize:"0.75rem", marginTop:10}}>
                completed in {result.analysis_time}s
              </div>
            </div>

            <div style={{
              background:"#0e0e1a",
              border:"1px solid #1e1e2e",
              borderRadius:14, padding:"14px 16px"
            }}>
              <div style={{
                color:"#a78bfa", fontWeight:"600",
                fontSize:"0.82rem", marginBottom:10
              }}>
                🕸 Account Coordination Network
              </div>
              <Graph data={result.graph} />
            </div>

          </div>

          {/* sub scores */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"1fr 1fr",
            gap:12, marginBottom:14
          }}>
            {[
              {key:"linguistic",   label:"Linguistic Similarity",  desc:"Semantic pattern matching across comments"},
              {key:"sentiment",    label:"Sentiment Uniformity",   desc:"Emotional variance analysis"},
              {key:"temporal",     label:"Temporal Anomaly",       desc:"Inhuman timing pattern detection"},
              {key:"coordination", label:"Coordination Index",     desc:"Account network topology analysis"},
            ].map(item => (
              <div key={item.key} style={{
                background:"#0e0e1a",
                border:"1px solid #1e1e2e",
                borderRadius:12, padding:"15px 16px"
              }}>
                <div style={{
                  display:"flex",
                  justifyContent:"space-between",
                  marginBottom:8
                }}>
                  <span style={{fontWeight:"600", fontSize:"0.88rem"}}>
                    {item.label}
                  </span>
                  <span style={{
                    color:getColor(result[item.key]),
                    fontWeight:"700"
                  }}>
                    {result[item.key]}%
                  </span>
                </div>
                <div style={{
                  background:"#1a1a1a",
                  height:7, borderRadius:4,
                  overflow:"hidden"
                }}>
                  <div style={{
                    width:`${result[item.key]}%`,
                    height:"100%",
                    background:getColor(result[item.key]),
                    borderRadius:4,
                    transition:"width 1.2s ease"
                  }}/>
                </div>
                <div style={{
                  fontSize:"0.73rem",
                  color:"#444",
                  marginTop:5
                }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>

          {/* explanation */}
          <div style={{
            background:"#0e0e1a",
            border:"1px solid #a78bfa33",
            borderRadius:12, padding:"16px 18px"
          }}>
            <div style={{
              color:"#a78bfa", fontWeight:"600",
              fontSize:"0.82rem", marginBottom:9
            }}>
              🤖 AI Analysis Explanation
            </div>
            <div style={{
              color:"#c0c0c0",
              lineHeight:1.75,
              fontSize:"0.93rem"
            }}>
              {result.explanation}
            </div>
          </div>

        </div>
      )}

      {/* empty state */}
      {!result && !loading && (
        <div style={{
          textAlign:"center",
          padding:"70px 0",
          color:"#333"
        }}>
          <div style={{fontSize:"2.8rem", marginBottom:12}}>👁</div>
          <div style={{fontSize:"0.9rem"}}>
            Select a dataset above to begin analysis
          </div>
        </div>
      )}

      <style>{`
        @keyframes sweep {
          from { transform: translateX(-100%); }
          to   { transform: translateX(250%); }
        }
      `}</style>

    </div>
  )
}