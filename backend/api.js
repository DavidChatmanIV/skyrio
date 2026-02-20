const express = require("express");

const app = express();
const port = 3000;

/* ============================= */
/* Middleware */
/* ============================= */

app.use(express.json()); // REQUIRED for Atlas AI


/* ============================= */
/* Static Data */
/* ============================= */

const airports = require("./airports.json");


/* ============================= */
/* Airports API (existing) */
/* ============================= */

app.get("/api/airports", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";

  const filteredAirports = airports.filter((airport) =>
    airport.name.toLowerCase().includes(query) ||
    airport.code.toLowerCase().includes(query)
  );

  res.json(filteredAirports);
});


/* ============================= */
/* Atlas AI API */
/* ============================= */

app.post("/api/ai/chat", async (req, res) => {

  try {

    const { messages } = req.body;

    if (!messages) {
      return res.status(400).json({
        error: "messages required"
      });
    }

    console.log("Atlas request received");

    // TEMP reply (OpenAI comes next)
    res.json({
      reply:
        "Atlas: Ready. OpenAI connection will generate your travel plan."
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Atlas server error"
    });

  }

});


/* ============================= */
/* Start Server */
/* ============================= */

app.listen(port, () => {

  console.log(`🚀 Skyrio Atlas running at http://localhost:${port}`);

});