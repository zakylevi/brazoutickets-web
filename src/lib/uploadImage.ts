import { getAuthenticatedClient } from "@/lib/authenticatedClient";

/** Convert a File to a data-URL (instant, no network). */
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const withTimeout = async <T,>(promise: Promise<T>, ms = 12000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Upload timeout")), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/** Uploads to cloud and falls back to data-URL if cloud upload fails or times out. */
export const uploadEventImage = async (
  file: File,
  eventId: string,
  folder: "flyer" | "gallery"
): Promise<string | null> => {
  const supabase = getAuthenticatedClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${eventId}/${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const { error } = await withTimeout(
      supabase.storage.from("event-images").upload(path, file, { upsert: true }),
      12000
    );

    if (error) throw error;

    const { data } = supabase.storage
      .from("event-images")
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (err) {
    console.warn("Cloud upload failed/timed out, using local preview:", err);
    return fileToDataUrl(file);
  }
};
