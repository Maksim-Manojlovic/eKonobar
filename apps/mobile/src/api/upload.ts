import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiGet, BASE_URL } from "./client";
import { loadSession } from "@/auth/storage";

/**
 * Image upload.
 *
 * POST /api/upload is multipart, so it cannot go through `api()` — that wrapper
 * JSON-encodes the body and sets a JSON content-type. This is the one place a
 * raw fetch is correct, and it still attaches the bearer token by hand.
 *
 * React Native's FormData takes `{ uri, name, type }` rather than a Blob; the
 * platform reads the file off disk itself. Do not try to fetch the uri into a
 * Blob first — it works on web and quietly produces an empty file here.
 */

export type UploadType = "avatar" | "venue-photo" | "sanitary-doc" | "leave-doc";

/** Mirrors the route: 5 MB, images everywhere, PDFs only for document types. */
const MAX_BYTES = 5 * 1024 * 1024;

export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Pristup galeriji nije odobren.");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality:    0.8,
    // The server crops avatars to 400×400 anyway, but shrinking before upload
    // keeps a 12 MP phone photo under the 5 MB limit.
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function uploadAsset(
  asset: ImagePicker.ImagePickerAsset,
  type: UploadType,
): Promise<string> {
  if (asset.fileSize && asset.fileSize > MAX_BYTES) {
    throw new Error("Fajl je veći od 5 MB.");
  }

  const session = await loadSession();
  if (!session) throw new Error("Sesija je istekla.");

  const form = new FormData();
  // The cast is unavoidable: RN's FormData accepts this shape, the DOM lib type
  // does not describe it.
  form.append("file", {
    uri:  asset.uri,
    name: asset.fileName ?? `upload-${Date.now()}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  } as unknown as Blob);
  form.append("type", type);

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method:  "POST",
    // Deliberately no content-type: fetch must set the multipart boundary itself.
    headers: { authorization: `Bearer ${session.accessToken}` },
    body:    form,
  });

  if (!res.ok) {
    let message = `Otpremanje nije uspelo (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* keep the status-derived message */
    }
    throw new Error(message);
  }

  const { url } = (await res.json()) as { url: string };
  return url;
}

// ── Sanitary book ─────────────────────────────────────────────────────────────

export type SanitaryRecord = {
  id:           string;
  status:       string;
  expiryDate:   string | null;
  uploadedAt:   string;
  rejectReason: string | null;
  reviewedAt:   string | null;
} | null;

export const useSanitaryBook = () =>
  useQuery({
    queryKey: ["sanitary", "mine"],
    queryFn:  () => apiGet<SanitaryRecord>("/api/verification/sanitary"),
  });

export function useSubmitSanitary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fileUrl: string; expiryDate?: string | null }) =>
      api("/api/verification/sanitary", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sanitary"] });
      // Approval flips passport.sanitaryBookValid, so that view is stale too.
      qc.invalidateQueries({ queryKey: ["passport"] });
    },
  });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function useSetProfilePhoto() {
  const qc = useQueryClient();
  return useMutation({
    // PUT /api/passport also syncs User.image, so one call covers both.
    mutationFn: (profilePhoto: string) =>
      api("/api/passport", { method: "PUT", body: { profilePhoto } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["passport"] }),
  });
}
