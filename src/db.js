"use strict";

const { MongoClient } = require("mongodb");

const DEFAULT_URI = "mongodb://127.0.0.1:27017/?replicaSet=rs0";
const DEFAULT_DATABASE = "lab4_lab6";

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return {
    client,
    database: client.db(process.env.MONGODB_DB || DEFAULT_DATABASE)
  };
}

module.exports = { connectDatabase, DEFAULT_DATABASE, DEFAULT_URI };
