import { v7 as uuidv7 } from 'uuid';

/**
 * Maps Mongo ObjectId hex strings to the uuids that replace them.
 *
 * Every lookup failure throws. This class must never return null for a
 * reference that was present in the source, and must never allow a row to be
 * skipped — silent data loss is the failure mode the whole ETL is built to
 * prevent.
 */
export class IdMap {
  private readonly maps = new Map<string, Map<string, string>>();

  private bucket(collection: string): Map<string, string> {
    let m = this.maps.get(collection);
    if (!m) {
      m = new Map();
      this.maps.set(collection, m);
    }
    return m;
  }

  /** Assigns (or returns the existing) uuid for a source document id. */
  assign(collection: string, objectId: string): string {
    const b = this.bucket(collection);
    const existing = b.get(objectId);
    if (existing) return existing;
    const id = uuidv7();
    b.set(objectId, id);
    return id;
  }

  /** Resolves a required reference. Throws if unknown. */
  resolve(collection: string, objectId: string): string {
    const id = this.bucket(collection).get(objectId);
    if (!id) {
      throw new Error(
        `Unresolvable reference: ${collection}/${objectId} was never assigned. ` +
          `Run etl:audit and resolve the orphan before loading.`
      );
    }
    return id;
  }

  /**
   * Resolves a nullable reference. A missing value is null; a PRESENT value
   * that does not resolve is still an error — nulling it here would hide an
   * orphan the audit was supposed to catch.
   */
  resolveOptional(
    collection: string,
    objectId: string | null | undefined
  ): string | null {
    if (objectId == null) return null;
    return this.resolve(collection, String(objectId));
  }

  size(collection: string): number {
    return this.maps.get(collection)?.size ?? 0;
  }
}
