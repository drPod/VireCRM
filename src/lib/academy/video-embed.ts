/**
 * Convert a pasted video URL into an embeddable iframe src for the
 * Academy lesson player. Supports YouTube (watch + youtu.be + shorts),
 * Loom, Vimeo, Wistia, and direct MP4/WebM/MOV files. Returns null when
 * the URL doesn't match a known pattern so the caller can fall back to a
 * simple link.
 */
export type VideoEmbed =
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string }
  | null;

export function getVideoEmbed(rawUrl: string | null | undefined): VideoEmbed {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube — watch?v=, youtu.be/<id>, /shorts/<id>, /embed/<id>
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.searchParams.get("v") ||
      url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/)?.[1] ||
      null;
    if (id) {
      return {
        kind: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      };
    }
  }
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    if (id) {
      return {
        kind: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      };
    }
  }

  // Loom — share links and embed links both have the id at /share/<id> or /embed/<id>
  if (host === "loom.com") {
    const id = url.pathname.match(/\/(?:share|embed)\/([a-z0-9]{16,})/i)?.[1];
    if (id) return { kind: "iframe", src: `https://www.loom.com/embed/${id}` };
  }

  // Vimeo — vimeo.com/<id>
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{6,})/)?.[1];
    if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }

  // Wistia
  if (host.endsWith("wistia.com") || host.endsWith("wistia.net")) {
    const id = url.pathname.match(/\/(?:medias|embed)\/([\w-]+)/)?.[1];
    if (id) return { kind: "iframe", src: `https://fast.wistia.net/embed/iframe/${id}` };
  }

  // Direct video file
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url.pathname)) {
    return { kind: "video", src: url.toString() };
  }

  return null;
}
