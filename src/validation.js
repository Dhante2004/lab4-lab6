"use strict";

const CONSERVATION_STATUSES = new Set([
  "Least Concern",
  "Near Threatened",
  "Vulnerable",
  "Endangered",
  "Critically Endangered",
  "Extinct in the Wild",
  "Extinct",
  "Data Deficient",
  "Not Evaluated"
]);

const SPECIES_FIELDS = ["scientificName", "commonName", "habitat", "conservationStatus"];

class InputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputValidationError";
  }
}

function validateSpecies(input, { partial = false } = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new InputValidationError("Species input must be an object.");
  }

  const suppliedFields = Object.keys(input);
  const unknownFields = suppliedFields.filter((field) => !SPECIES_FIELDS.includes(field));
  if (unknownFields.length > 0) {
    throw new InputValidationError(`Unknown species field(s): ${unknownFields.join(", ")}.`);
  }
  if (partial && suppliedFields.length === 0) {
    throw new InputValidationError("Provide at least one species field to update.");
  }

  const validated = {};
  for (const field of SPECIES_FIELDS) {
    const supplied = Object.hasOwn(input, field);
    if (!supplied) {
      if (!partial) {
        throw new InputValidationError(`Missing required field: ${field}.`);
      }
      continue;
    }

    const value = input[field];
    if (typeof value !== "string") {
      throw new InputValidationError(`${field} must be a string.`);
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      throw new InputValidationError(`${field} cannot be blank.`);
    }

    const maxLength = field === "habitat" ? 500 : 120;
    if (trimmedValue.length > maxLength) {
      throw new InputValidationError(`${field} cannot exceed ${maxLength} characters.`);
    }

    if (field === "conservationStatus" && !CONSERVATION_STATUSES.has(trimmedValue)) {
      throw new InputValidationError(
        `conservationStatus must be one of: ${[...CONSERVATION_STATUSES].join(", ")}.`
      );
    }

    validated[field] = trimmedValue;
  }

  return validated;
}

module.exports = { CONSERVATION_STATUSES, InputValidationError, validateSpecies };
