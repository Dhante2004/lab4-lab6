"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { InputValidationError, validateSpecies } = require("../src/validation");
const { SpeciesRepository, parseId } = require("../src/species-repository");
const { parseArguments, run } = require("../src/cli");

const validSpecies = {
  scientificName: "Panthera tigris",
  commonName: "Tiger",
  habitat: "Forests and grasslands",
  conservationStatus: "Endangered"
};

test("accepts a complete species record and trims whitespace", () => {
  assert.deepEqual(
    validateSpecies({ ...validSpecies, commonName: " Tiger " }),
    { ...validSpecies, commonName: "Tiger" }
  );
});

test("rejects missing, blank, and wrongly typed required fields", () => {
  assert.throws(() => validateSpecies({}), InputValidationError);
  assert.throws(() => validateSpecies({ ...validSpecies, habitat: "  " }), InputValidationError);
  assert.throws(() => validateSpecies({ ...validSpecies, habitat: 42 }), InputValidationError);
  assert.throws(
    () => validateSpecies({ ...validSpecies, habitat: "x".repeat(501) }),
    /cannot exceed 500/
  );
});

test("rejects invalid conservation statuses and unknown fields", () => {
  assert.throws(
    () => validateSpecies({ ...validSpecies, conservationStatus: "Doing fine" }),
    /conservationStatus/
  );
  assert.throws(() => validateSpecies({ ...validSpecies, extra: "value" }), /Unknown species field/);
});

test("accepts partial updates and rejects empty updates", () => {
  assert.deepEqual(validateSpecies({ habitat: " Wetlands " }, { partial: true }), {
    habitat: "Wetlands"
  });
  assert.throws(() => validateSpecies({}, { partial: true }), /at least one/);
});

test("accepts only 24-character hexadecimal MongoDB ids", () => {
  assert.equal(parseId("507f1f77bcf86cd799439011").toHexString(), "507f1f77bcf86cd799439011");
  assert.throws(() => parseId("not-an-object-id"), /24-character/);
});

test("performs species create, list, read, update, and delete operations", async () => {
  const insertedId = parseId("507f1f77bcf86cd799439011");
  const store = new Map();
  const collection = {
    async insertOne(document) {
      store.set(insertedId.toHexString(), { ...document, _id: insertedId });
      return { insertedId };
    },
    find() {
      return {
        sort() {
          return this;
        },
        async toArray() {
          return [...store.values()];
        }
      };
    },
    async findOne(filter) {
      return store.get(filter._id.toHexString()) || null;
    },
    async findOneAndUpdate(filter, update) {
      const current = store.get(filter._id.toHexString());
      if (!current) {
        return null;
      }
      const updated = { ...current, ...update.$set };
      store.set(filter._id.toHexString(), updated);
      return updated;
    },
    async deleteOne(filter) {
      return { deletedCount: Number(store.delete(filter._id.toHexString())) };
    }
  };
  const repository = new SpeciesRepository(collection);

  const created = await repository.create(validSpecies);
  assert.equal(created._id, insertedId.toHexString());
  assert.deepEqual((await repository.list()).map((species) => species._id), [created._id]);
  assert.equal((await repository.getById(created._id)).scientificName, validSpecies.scientificName);
  assert.equal((await repository.updateById(created._id, { habitat: "Wetlands" })).habitat, "Wetlands");
  assert.equal(await repository.deleteById(created._id), true);
  assert.equal(await repository.getById(created._id), null);
  assert.equal(await repository.deleteById(created._id), false);
});

test("rejects duplicate and value-less CLI options", () => {
  assert.throws(() => parseArguments(["get", "--id", "first", "--id", "second"]), /only be supplied once/);
  assert.throws(() => parseArguments(["get", "--id"]), /requires a value/);
});

test("rejects the id option when creating a species", async () => {
  await assert.rejects(run(["create", "--id", "ignored"]), /Unknown option/);
  await assert.rejects(
    run(["create", "--scientific-name", " ", "--common-name", "Tiger", "--habitat", "Forest", "--conservation-status", "Endangered"]),
    /cannot be blank/
  );
  await assert.rejects(run(["get", "--id", "not-an-id"]), /24-character/);
});
