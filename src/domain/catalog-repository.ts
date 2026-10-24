import type { Catalog } from "./models";

export interface CatalogRepository {
  getCatalog(): Promise<Catalog>;
}