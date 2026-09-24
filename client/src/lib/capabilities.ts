// Détection centralisée des capacités navigateur (§107). Jamais de tests dispersés.
export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}
export function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}
export function supportsWebShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}
export function supportsFileShare(files?: File[]): boolean {
  try {
    if (typeof navigator === "undefined" || !("canShare" in navigator)) return false;
    if (!files?.length) return "share" in navigator;
    return (navigator as Navigator & { canShare(d: { files: File[] }): boolean }).canShare({ files });
  } catch {
    return false;
  }
}
export function supportsCameraCapture(): boolean {
  // input capture est une indication, pas une garantie : on l'offre toujours sur mobile
  return typeof document !== "undefined" && "mediaDevices" in (navigator ?? {});
}
export function supportsOPFS(): boolean {
  try {
    return typeof navigator !== "undefined" && "storage" in navigator && "getDirectory" in (navigator.storage as object);
  } catch {
    return false;
  }
}
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator as Navigator & { userAgentData?: { mobile: boolean } }).userAgentData?.mobile === true;
}
