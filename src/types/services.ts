import type { ServiceDocument } from "./database.js";

export interface ServiceView extends ServiceDocument {
  id: string;
}

export interface ServiceListResult {
  services: ServiceView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
