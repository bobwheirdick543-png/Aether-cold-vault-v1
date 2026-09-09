/**
 * Infrastructure provider abstraction.
 *
 * The domain services never talk to a vendor SDK directly — they talk
 * to these interfaces. Today they are implemented on top of the
 * platform's managed Postgres + private object storage; swapping in a
 * different provider means writing one new implementation here, not
 * rewriting the product.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { VaultError } from "./security.server";

/** Relational data access, as used by the repositories. */
export type DatabaseProvider = SupabaseClient<Database>;

export type StoredBlob = {
  key: string;
  bytes: Uint8Array;
  contentType: string;
};

/**
 * Private object storage for file contents. Content-addressed: the key
 * embeds the SHA-256 of the bytes, so identical content is stored once
 * and snapshots can reference historical blobs without copying them.
 */
export interface ObjectStorageProvider {
  readonly name: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  exists(key: string): Promise<boolean>;
  removePrefix(prefix: string): Promise<void>;
  blobKey(projectId: string, hash: string): string;
}

export const OBJECT_STORAGE_BUCKET = "project-blobs";

/** Managed private-bucket implementation. */
export class SupabaseObjectStorage implements ObjectStorageProvider {
  readonly name = "lovable-cloud-object-storage";

  constructor(private readonly client: SupabaseClient<Database>) {}

  blobKey(projectId: string, hash: string): string {
    return `${projectId}/blobs/${hash}`;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const body = new Blob([new Uint8Array(bytes)], { type: contentType });
    const { error } = await this.client.storage
      .from(OBJECT_STORAGE_BUCKET)
      .upload(key, body, { contentType, upsert: true });

    if (error) {
      throw new VaultError(`Could not store file content: ${error.message}`, "storage", { key });
    }
  }

  async get(key: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage.from(OBJECT_STORAGE_BUCKET).download(key);
    if (error || !data) {
      throw new VaultError("Stored file content is unavailable.", "storage", { key });
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    const slash = key.lastIndexOf("/");
    const folder = key.slice(0, slash);
    const name = key.slice(slash + 1);
    const { data, error } = await this.client.storage
      .from(OBJECT_STORAGE_BUCKET)
      .list(folder, { search: name, limit: 1 });
    if (error) return false;
    return (data ?? []).some((entry) => entry.name === name);
  }

  async removePrefix(prefix: string): Promise<void> {
    const bucket = this.client.storage.from(OBJECT_STORAGE_BUCKET);
    let offset = 0;
    const pageSize = 1000;

    for (;;) {
      const { data, error } = await bucket.list(prefix, { limit: pageSize, offset });
      if (error || !data || data.length === 0) return;

      const keys = data.map((entry) => `${prefix}/${entry.name}`);
      await bucket.remove(keys);

      if (data.length < pageSize) return;
      offset += pageSize;
    }
  }
}
