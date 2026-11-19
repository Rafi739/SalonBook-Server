import { ObjectId } from "mongodb";
import { HttpError } from "./http-error.js";

export function parseMongoObjectId(value: string | undefined, resourceName: string): ObjectId {
  if (value === undefined || !/^[0-9a-fA-F]{24}$/.test(value)) {
    throw new HttpError(400, "Bad Request", `The ${resourceName} ID must be a valid MongoDB ObjectId.`);
  }
  return new ObjectId(value);
}
