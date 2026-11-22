// LKCMedSoc inventory backend: checks the sign-in (Google or NTU email), handles photos, then asks the database to do the work.
// Used by inventory-site/. Deployed as the Supabase Edge Function "api" (verify_jwt off: it checks sign-ins itself).
import { createClient } from "npm:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const BUCKET = "photos";
const MAX_PHOTO_CHARS = 3_000_000;
const MASTER_ADMIN = "lkcmedsoc@gmail.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

class Fail extends Error { code?: string; constructor(m: string, c?: string) { super(m); this.code = c; } }

// Sign-in token -> verified email ('' = guest).
// Two kinds are accepted: a Supabase sign-in token (NTU email + password, the same accounts as every other LKCMedSoc app)
// and a Google ID token. Google sign-in is only for the shared Gmail accounts of student groups, committees, houses and
// years (their contact email in Records) and the MedSoc account; any other Google account is turned away.
const tokenCache = new Map<string, { email: string; exp: number }>();

function tokenPayload(t: string): any {
  try {
    let b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    b += "=".repeat((4 - (b.length % 4)) % 4);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
  } catch { return null; }
}

// The same rule as app.norm_email in the database: Gmail ignores dots and anything after a +.
function normEmail(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1) return s;
  let loc = s.slice(0, at), dom = s.slice(at + 1);
  if (dom === "googlemail.com") dom = "gmail.com";
  if (dom === "gmail.com") loc = loc.split("+")[0].replace(/\./g, "");
  return loc + "@" + dom;
}

// Is this Google account a group's shared account? Group accounts are the contact emails of the bodies in Records
// (records.bodies.contact_email; one field can hold several, comma-separated, e.g. a committee's Gmail and its NTU
// address) and the MedSoc account. Inventory's own body list (app.bodies) is a copy of the same Records data.
// The list is kept for 5 minutes.
let groupEmails: { set: Set<string>; at: number } | null = null;
async function isGroupAccount(email: string): Promise<boolean> {
  const e = normEmail(email);
  if (e === normEmail(MASTER_ADMIN)) return true;
  if (!groupEmails || Date.now() - groupEmails.at > 5 * 60_000) {
    const { data, error } = await sb.schema("records").from("bodies").select("contact_email");
    if (error) {
      console.error("group emails", error);
      if (!groupEmails) throw new Fail("Could not verify sign-in. Please try again.");
    } else {
      const set = new Set<string>();
      for (const b of data ?? []) for (const x of String(b.contact_email ?? "").split(/[,;\s]+/)) if (x.includes("@")) set.add(normEmail(x));
      groupEmails = { set, at: Date.now() };
    }
  }
  return groupEmails!.set.has(e);
}

async function emailFromSupabase(t: string, payload: any): Promise<string> {
  // getUser asks the Supabase auth server to check the token, so a forged or expired one is refused.
  const { data, error } = await sb.auth.getUser(t);
  const u = data?.user;
  if (error || !u?.email) throw new Fail("Please sign in again.", "AUTH");
  if (!u.email_confirmed_at) throw new Fail("Please confirm your email first, then sign in again.", "AUTH");
  const expMs = Number(payload?.exp) * 1000;
  if (!(expMs > Date.now())) throw new Fail("Please sign in again. (Sign-in expired)", "AUTH");
  const email = u.email.toLowerCase();
  tokenCache.set(t, { email, exp: Math.min(expMs, Date.now() + 5 * 60_000) });
  return email;
}

async function emailFrom(idToken: unknown): Promise<string> {
  if (!idToken) return "";
  const t = String(idToken);
  const hit = tokenCache.get(t);
  if (hit && hit.exp > Date.now()) return hit.email;
  if (tokenCache.size > 200) tokenCache.clear();

  const payload = tokenPayload(t);
  if (payload && typeof payload.iss === "string" && payload.iss.startsWith(SB_URL + "/auth/v1")) {
    return await emailFromSupabase(t, payload);
  }

  let r: Response;
  try { r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(t)); }
  catch { throw new Fail("Could not verify sign-in. Please try again."); }
  if (!r.ok) { console.error("tokeninfo HTTP", r.status); throw new Fail("Please sign in again. (Google did not accept the token, " + r.status + ")", "AUTH"); }
  const j = await r.json();
  const expMs = Number(j.exp) * 1000;
  if (String(j.aud).trim() !== CLIENT_ID.trim()) { console.error("aud mismatch", j.aud, "expected", CLIENT_ID); throw new Fail("Please sign in again. (Client ID in Supabase does not match: " + (CLIENT_ID ? "set" : "MISSING") + ")", "AUTH"); }
  if (String(j.email_verified) !== "true" || !j.email || !(expMs > Date.now())) throw new Fail("Please sign in again. (Token expired or email not verified)", "AUTH");
  const email = String(j.email).toLowerCase();
  if (!(await isGroupAccount(email))) {
    throw new Fail("Google sign-in is only for the shared Gmail accounts of student groups, committees, houses and years. Please sign in with your NTU email instead.", "AUTH");
  }
  tokenCache.set(t, { email, exp: Math.min(expMs, Date.now() + 5 * 60_000) });
  return email;
}

function parsePhoto(dataUrl: unknown): Uint8Array | null {
  if (!dataUrl) return null;
  const s = String(dataUrl);
  if (s.length > MAX_PHOTO_CHARS) throw new Fail("Photo is too large.");
  const prefix = "data:image/jpeg;base64,";
  if (!s.startsWith(prefix)) throw new Fail("Photo must be a JPEG image.");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(s.slice(prefix.length)), (c) => c.charCodeAt(0)); }
  catch { throw new Fail("Photo could not be read."); }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Fail("Photo must be a JPEG image.");
  return bytes;
}

async function savePhoto(bytes: Uint8Array, name: string): Promise<string> {
  const safe = name.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 40) || "item";
  const path = `${safe}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
  if (error) throw new Fail("Photo could not be saved.");
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function trashPhotos(urls: unknown) {
  if (!Array.isArray(urls)) return;
  const prefix = `${SB_URL}/storage/v1/object/public/${BUCKET}/`;
  const paths = urls.map(String).filter((u) => u.startsWith(prefix)).map((u) => decodeURIComponent(u.slice(prefix.length)));
  if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
}

async function rpc(email: string, action: string, payload: unknown) {
  const { data, error } = await sb.rpc("lkc_api", { p_email: email, p_action: action, p_payload: payload ?? {} });
  if (error) {
    if (error.code === "U0002") throw new Fail(error.message || "Please sign in again.", "AUTH");
    if (error.code === "U0001") throw new Fail(error.message);
    console.error("db error", error);
    throw new Fail("Something went wrong. Please try again.");
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "Bad request." }, 405);
  let body: any;
  try { body = JSON.parse(await req.text()); } catch { return reply({ error: "Bad request." }, 400); }
  const action = String(body?.action ?? "");
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  let uploaded: string | null = null;
  try {
    if (action === "PING") return reply({ data: { ok: true } });

    if (action === "SYNC_BODIES" || action === "IMPORT_ALL" || action === "EXPORT_ALL") {
      if (!SYNC_SECRET || payload.secret !== SYNC_SECRET) throw new Fail("Not allowed.");
      return reply({ data: await rpc("__sync__", action, payload) });
    }

    const email = await emailFrom(body?.idToken);

    // photos: itemData.photoBase64 or location.photoBase64 -> Storage URL passed on as _photoUrl
    const holder = payload.itemData ?? payload.location ?? null;
    if (holder && typeof holder === "object" && holder.photoBase64) {
      if (!email) throw new Fail("Please sign in again.", "AUTH");
      const bytes = parsePhoto(holder.photoBase64);
      if (bytes) {
        uploaded = await savePhoto(bytes, String(holder.name ?? "item"));
        holder._photoUrl = uploaded;
      }
    }
    if (holder && typeof holder === "object") { delete holder.photoBase64; if (!uploaded) delete holder._photoUrl; }

    let data: any;
    try { data = await rpc(email, action, payload); }
    catch (e) { if (uploaded) await trashPhotos([uploaded]); throw e; }

    if (data && typeof data === "object" && Array.isArray(data._trash)) {
      await trashPhotos(data._trash);
      delete data._trash;
    }
    return reply({ data });
  } catch (e) {
    if (e instanceof Fail) return reply({ error: e.message, ...(e.code ? { code: e.code } : {}) });
    console.error(e);
    return reply({ error: "Something went wrong. Please try again." });
  }
});
