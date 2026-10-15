"use strict";

const { ObjectId } = require("mongodb");
const { InputValidationError, validateSpecies } = require("./validation");

function serializeSpecies(species) {
  if (!species) {
    return null;
  }
  return { ...species, _id: species._id.toHexString() };
}

function parseId(id) {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
    throw new InputValidationError("id must be a 24-character MongoDB ObjectId.");
  }
  return new ObjectId(id);
}

class SpeciesRepository {
  constructor(collection) {
    this.collection = collection;
  }

  async create(input) {
    const species = validateSpecies(input);
    const now = new Date();
    const document = { ...species, createdAt: now, updatedAt: now };
    const result = await this.collection.insertOne(document);
    return serializeSpecies({ ...document, _id: result.insertedId });
  }

  async list() {
    const documents = await this.collection.find({}).sort({ scientificName: 1 }).toArray();
    return documents.map(serializeSpecies);
  }

  async getById(id) {
    const document = await this.collection.findOne({ _id: parseId(id) });
    return serializeSpecies(document);
  }

  async updateById(id, input) {
    const species = validateSpecies(input, { partial: true });
    const document = await this.collection.findOneAndUpdate(
      { _id: parseId(id) },
      { $set: { ...species, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return serializeSpecies(document);
  }

  async deleteById(id) {
    const result = await this.collection.deleteOne({ _id: parseId(id) });
    return result.deletedCount === 1;
  }
}

module.exports = { SpeciesRepository, parseId, serializeSpecies };
