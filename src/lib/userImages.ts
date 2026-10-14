/**
 * Photos the user picks for their own recipes and workout plans.
 *
 * Seeded recipes and plans get their photos from the read-only `recipe-images`
 * and `workout-images` buckets. Anything the user uploads goes to
 * `user-images` instead, under a folder named for their id, which is what the
 * storage policy keys on — one bucket where writes are allowed, scoped so a
 * user can only write inside their own folder.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "./supabaseClient";

const BUCKET = "user-images";

/** Which kind of thing the photo belongs to — becomes a folder in the path. */
export type UserImageKind = "recipes" | "workouts";

/**
 * Opens the photo library. Returns null when the user backs out, and throws
 * only when something needs saying — a denied permission is actionable, a
 * cancelled picker is not.
 */
export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo access is needed to choose a picture.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    // Both card slots are landscape (a full-width banner on workouts, a 92x104
    // thumb on recipes), so cropping to 4:3 up front beats letting the card
    // crop something portrait down to a sliver.
    aspect: [4, 3],
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

/**
 * Uploads a picked image and returns its public URL.
 *
 * The path is fixed per item rather than unique per upload, so replacing a
 * photo overwrites the old object instead of leaving it orphaned in the
 * bucket with nothing pointing at it.
 */
export async function uploadUserImage(args: {
  uri: string;
  userId: string;
  kind: UserImageKind;
  itemId: string;
}): Promise<string> {
  const { uri, userId, kind, itemId } = args;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error("Could not read that image.");

  // supabase-js wants bytes, and React Native has no Blob that survives the
  // bridge intact, so the base64 is decoded by hand — same as the avatar
  // upload in settings.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const path = `${userId}/${kind}/${itemId}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes.buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not get a link for that image.");

  // The path never changes, so without a cache buster expo-image keeps showing
  // the previous photo after a replacement.
  return `${data.publicUrl}?t=${Date.now()}`;
}
