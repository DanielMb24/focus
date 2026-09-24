import { FileText, Image as ImageIcon, Film, Music, Archive, File as FileIcon } from "lucide-react";

export function formatSize(bytes: number): string {
  if (!bytes) return "0 o";
  const u = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Music;
  if (mime.includes("zip")) return Archive;
  if (mime.includes("pdf") || mime.startsWith("text/") || mime.includes("officedocument") || mime.includes("msword") || mime.includes("ms-excel") || mime.includes("ms-powerpoint")) return FileText;
  return FileIcon;
}
