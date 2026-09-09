/**
 * SecurityService
 *
 * Central, reusable security rules for the vault. Every path that
 * enters the system — from the UI, from a ZIP archive, or from an
 * authorized MCP client — is normalised and validated here.
 *
 * Filename-based sensitivity detection is the FIRST layer only; the
 * interface is shaped so content scanning, credential detection and
 * redaction can be added behind the same calls later.
 */

export const VAULT_LIMITS = {
  /** Longest single path segment. */
  maxSegmentLength: 200,
  /** Longest full path. */
  maxPathLength: 1024,
  /** Deepest nesting allowed inside a project. */
  maxDepth: 24,
  /** Largest single file we will store. */
  maxFileBytes: 5 * 1024 * 1024,
  /** Largest text file we will open in the editor. */
  maxEditableBytes: 1 * 1024 * 1024,
  /** Largest node count in one project. */
  maxNodesPerProject: 5000,
  /** Largest total project size. */
  maxProjectBytes: 200 * 1024 * 1024,
  /** Archive ingest limits. */
  archive: {
    maxUploadBytes: 20 * 1024 * 1024,
    maxEntries: 3000,
    maxTotalExtractedBytes: 120 * 1024 * 1024,
    maxEntryBytes: 5 * 1024 * 1024,
    /** Rejects zip bombs: extracted / compressed ratio ceiling. */
    maxCompressionRatio: 120,
  },
} as const;

export class VaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | "validation"
      | "not_found"
      | "forbidden"
      | "conflict"
      | "limit"
      | "unsafe_archive"
      | "storage"
      | "unauthorized",
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "VaultError";
  }
}

export const validationError = (message: string, detail?: Record<string, unknown>) =>
  new VaultError(message, "validation", detail);

const RESERVED_SEGMENTS = new Set([".", "..", "", "__proto__"]);

/** Windows device names that must never become file names. */
const RESERVED_WINDOWS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/**
 * Validates a single file or folder name (no separators allowed).
 */
export function assertValidName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) throw validationError("A name is required.");
  if (trimmed.length > VAULT_LIMITS.maxSegmentLength)
    throw validationError(`Names must be ${VAULT_LIMITS.maxSegmentLength} characters or fewer.`);
  if (trimmed.includes("/") || trimmed.includes("\\"))
    throw validationError("Names cannot contain slashes.");
  if (RESERVED_SEGMENTS.has(trimmed)) throw validationError(`"${trimmed}" is not a valid name.`);
  if (RESERVED_WINDOWS.has(trimmed.toLowerCase().split(".")[0] ?? ""))
    throw validationError(`"${trimmed}" is a reserved name.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed))
    throw validationError("Names cannot contain control characters.");
  if (trimmed.endsWith(".") || trimmed.endsWith(" "))
    throw validationError("Names cannot end with a dot or space.");

  return trimmed;
}

/**
 * Normalises an arbitrary (possibly hostile) path into a safe,
 * project-relative POSIX path. Throws on traversal, absolute paths,
 * drive letters, UNC paths and excessive depth.
 */
export function normalizePath(rawPath: string): string {
  const input = rawPath.replace(/\\/g, "/").trim();

  if (!input) throw validationError("A path is required.");
  if (input.length > VAULT_LIMITS.maxPathLength)
    throw validationError("That path is too long.");
  if (input.startsWith("/")) throw validationError("Absolute paths are not allowed.");
  if (/^[a-zA-Z]:/.test(input)) throw validationError("Drive-letter paths are not allowed.");
  if (input.startsWith("//")) throw validationError("Network paths are not allowed.");

  const segments = input.split("/").filter((segment) => segment !== "" && segment !== ".");

  if (segments.some((segment) => segment === ".."))
    throw validationError("Paths cannot navigate outside the project.");
  if (segments.length === 0) throw validationError("A path is required.");
  if (segments.length > VAULT_LIMITS.maxDepth)
    throw validationError(`Paths cannot be deeper than ${VAULT_LIMITS.maxDepth} levels.`);

  return segments.map((segment) => assertValidName(segment)).join("/");
}

export function pathParent(path: string): string | null {
  const index = path.lastIndexOf("/");
  return index === -1 ? null : path.slice(0, index);
}

export function pathName(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function pathDepth(path: string): number {
  return path.split("/").length - 1;
}

/** True when `candidate` is inside (or equal to) `folder`. */
export function isWithin(folder: string, candidate: string): boolean {
  return candidate === folder || candidate.startsWith(`${folder}/`);
}

/* ------------------------------------------------------------------ *
 * Sensitive file policy
 * ------------------------------------------------------------------ */

const SENSITIVE_PATTERNS: RegExp[] = [
  /^\.env$/i,
  /^\.env\..*/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.keystore$/i,
  /^id_rsa$/i,
  /^id_dsa$/i,
  /^id_ecdsa$/i,
  /^id_ed25519$/i,
  /^credentials(\..*)?$/i,
  /^secrets?(\..*)?$/i,
  /^service-account.*\.json$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^\.pgpass$/i,
  /^.*\.kdbx$/i,
];

export type SensitivityVerdict = {
  isSensitive: boolean;
  reason?: string;
};

/**
 * First-layer sensitivity classification, by filename.
 * Content scanning plugs in behind this same signature later.
 */
export function classifySensitivity(path: string): SensitivityVerdict {
  const name = pathName(path);
  const matched = SENSITIVE_PATTERNS.find((pattern) => pattern.test(name));
  if (matched) {
    return { isSensitive: true, reason: `Filename matches a protected-secret pattern (${name}).` };
  }
  if (path.split("/").some((segment) => segment.toLowerCase() === ".ssh")) {
    return { isSensitive: true, reason: "Stored inside an .ssh directory." };
  }
  return { isSensitive: false };
}

/**
 * Policy gate for reading content out of the vault.
 * Human owners may read their own sensitive files; non-owner actors
 * (administrators, MCP clients) may not, unless explicitly allowed.
 */
export function assertReadableContent(
  node: { path: string; is_sensitive: boolean },
  actor: { type: "user" | "admin" | "system" | "mcp"; isOwner: boolean; allowSensitive?: boolean },
): void {
  if (!node.is_sensitive) return;
  if (actor.allowSensitive) return;
  if (actor.type === "user" && actor.isOwner) return;

  throw new VaultError(
    "This file is protected by the sensitive-file policy and cannot be read through this channel.",
    "forbidden",
    { path: node.path, policy: "sensitive_file" },
  );
}

/* ------------------------------------------------------------------ *
 * File typing
 * ------------------------------------------------------------------ */

const EXTENSION_MIME: Record<string, string> = {
  ts: "text/typescript",
  tsx: "text/typescript-jsx",
  js: "text/javascript",
  jsx: "text/javascript-jsx",
  mjs: "text/javascript",
  cjs: "text/javascript",
  json: "application/json",
  md: "text/markdown",
  mdx: "text/markdown",
  css: "text/css",
  scss: "text/x-scss",
  html: "text/html",
  svg: "image/svg+xml",
  yml: "text/yaml",
  yaml: "text/yaml",
  toml: "text/toml",
  sql: "application/sql",
  py: "text/x-python",
  rb: "text/x-ruby",
  go: "text/x-go",
  rs: "text/x-rust",
  java: "text/x-java",
  kt: "text/x-kotlin",
  swift: "text/x-swift",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c++",
  cs: "text/x-csharp",
  php: "text/x-php",
  sh: "text/x-sh",
  txt: "text/plain",
  csv: "text/csv",
  xml: "application/xml",
  lock: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/vnd.microsoft.icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  pdf: "application/pdf",
  zip: "application/zip",
};

export function detectMimeType(path: string): string {
  const name = pathName(path).toLowerCase();
  const extension = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  if (EXTENSION_MIME[extension]) return EXTENSION_MIME[extension];
  if (name.startsWith(".") || !extension) return "text/plain";
  return "application/octet-stream";
}

export function isTextMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/sql" ||
    mimeType === "application/xml" ||
    mimeType === "image/svg+xml"
  );
}

/** SHA-256 content fingerprint, used for content-addressed storage. */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const buffer = new Uint8Array(bytes).buffer as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
