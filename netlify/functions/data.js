// Netlify Function: /api/data  ->  reads/writes one document in MongoDB.
// Single-user model: everything is stored in one document { _id, sessions, updatedAt }.
//
// Required env var (set in Netlify dashboard):  MONGODB_URI
// Optional env vars:
//   MONGODB_DB    (default "gymtracker")
//   APP_TOKEN     if set, requests must send header  x-app-token: <value>

const { MongoClient } = require("mongodb");

const DB_NAME = process.env.MONGODB_DB || "gymtracker";
const COLLECTION = "appdata";
const DOC_ID = "default";

// Reuse the connection across warm invocations.
let clientPromise = null;
function getClient() {
  if (!clientPromise) {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI not set");
    clientPromise = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 5,
    }).connect();
  }
  return clientPromise;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-app-token",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});

  // optional shared passphrase
  if (process.env.APP_TOKEN) {
    const sent = event.headers["x-app-token"] || event.headers["X-App-Token"];
    if (sent !== process.env.APP_TOKEN) return json(401, { error: "unauthorized" });
  }

  try {
    const client = await getClient();
    const col = client.db(DB_NAME).collection(COLLECTION);

    if (event.httpMethod === "GET") {
      const doc = await col.findOne({ _id: DOC_ID });
      return json(200, {
        sessions: doc ? doc.sessions || [] : [],
        foodLog: doc ? doc.foodLog || [] : [],
        goals: doc ? doc.goals || {} : {},
        updatedAt: doc ? doc.updatedAt || 0 : 0,
      });
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const sessions = Array.isArray(body.sessions) ? body.sessions : [];
      const foodLog = Array.isArray(body.foodLog) ? body.foodLog : [];
      const goals = body.goals && typeof body.goals === "object" ? body.goals : {};
      const updatedAt = Number(body.updatedAt) || Date.now();
      await col.updateOne(
        { _id: DOC_ID },
        { $set: { sessions, foodLog, goals, updatedAt } },
        { upsert: true }
      );
      return json(200, { ok: true, updatedAt });
    }

    return json(405, { error: "method not allowed" });
  } catch (err) {
    return json(500, { error: String(err.message || err) });
  }
};
