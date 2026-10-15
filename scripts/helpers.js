"use strict";

const { MongoClient, MongoNetworkError, MongoServerSelectionError } = require("mongodb");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function connectToPrimary(uri, { previousPrimary = null, timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 1000,
      heartbeatFrequencyMS: 500
    });

    try {
      await client.connect();
      const hello = await client.db("admin").command({ hello: 1 });
      if (hello.isWritablePrimary && (!previousPrimary || hello.me !== previousPrimary)) {
        return { client, primaryHost: hello.me };
      }
      lastError = new Error(
        previousPrimary
          ? `Still waiting for a different primary; current primary is ${hello.me || "unknown"}.`
          : "No writable primary is available yet."
      );
    } catch (error) {
      if (!(error instanceof MongoServerSelectionError) && !(error instanceof MongoNetworkError)) {
        await client.close();
        throw error;
      }
      lastError = error;
    }

    await client.close();
    await delay(250);
  }

  throw new Error(`Timed out after ${timeoutMs} ms while waiting for a primary.`, { cause: lastError });
}

module.exports = { connectToPrimary };
