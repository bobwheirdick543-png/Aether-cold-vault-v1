/**
 * Service context.
 *
 * Every domain service call carries an explicit actor, a data provider
 * and an object-storage provider. Nothing is read from ambient state,
 * which is what lets the web app and the MCP server share one
 * authorization path.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ActorType, AuditActor } from "./audit.server";
import {
  SupabaseObjectStorage,
  type DatabaseProvider,
  type ObjectStorageProvider,
} from "./providers.server";

export type VaultActor = AuditActor & {
  type: ActorType;
  /** MCP client row id, when the actor is an authorized AI client. */
  clientId?: string;
  /** Project-scoped permissions, for non-human actors. */
  permissions?: string[];
  /** Projects this actor may touch at all; undefined = every owned project. */
  projectScope?: string[];
};

export type VaultContext = {
  db: DatabaseProvider;
  /** Privileged client, used only for storage and audit plumbing. */
  privileged: DatabaseProvider;
  storage: ObjectStorageProvider;
  actor: VaultActor;
  /** The human account that owns the data being acted on. */
  ownerId: string;
  correlationId: string;
};

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

/** Context for a signed-in person acting through the web application. */
export function userContext(options: {
  db: DatabaseProvider;
  userId: string;
  label: string;
  actorType?: ActorType;
  correlationId?: string;
}): VaultContext {
  return {
    db: options.db,
    privileged: supabaseAdmin,
    storage: new SupabaseObjectStorage(supabaseAdmin),
    actor: { id: options.userId, type: options.actorType ?? "user", label: options.label },
    ownerId: options.userId,
    correlationId: options.correlationId ?? newCorrelationId(),
  };
}

/**
 * Context for an authorized MCP client acting on behalf of a person.
 * Row-level access is re-checked explicitly by AuthorizationService
 * because this context uses the privileged data client.
 */
export function machineContext(options: {
  ownerId: string;
  clientId: string;
  label: string;
  permissions: string[];
  projectScope: string[];
  correlationId?: string;
}): VaultContext {
  return {
    db: supabaseAdmin,
    privileged: supabaseAdmin,
    storage: new SupabaseObjectStorage(supabaseAdmin),
    actor: {
      id: options.ownerId,
      type: "mcp",
      label: options.label,
      clientId: options.clientId,
      permissions: options.permissions,
      projectScope: options.projectScope,
    },
    ownerId: options.ownerId,
    correlationId: options.correlationId ?? newCorrelationId(),
  };
}
