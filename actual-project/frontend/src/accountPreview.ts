export interface PreviewProfile {
  nickname: string;
  joinedLeaderboard: boolean;
}
export function validNickname(value: string) {
  return (
    value.trim().length >= 3 &&
    value.trim().length <= 30 &&
    !value.includes("@") &&
    !/\d{7,}/.test(value.replace(/[\s()+-]/g, ""))
  );
}
export function readPreviewProfile(participantId: string): PreviewProfile {
  try {
    const value = JSON.parse(
      localStorage.getItem("rs_preview_profile:" + participantId) ?? "null",
    );
    return {
      nickname: typeof value?.nickname === "string" ? value.nickname : "",
      joinedLeaderboard: value?.joinedLeaderboard === true,
    };
  } catch {
    return { nickname: "", joinedLeaderboard: false };
  }
}
export function savePreviewProfile(
  participantId: string,
  profile: PreviewProfile,
) {
  localStorage.setItem(
    "rs_preview_profile:" + participantId,
    JSON.stringify(profile),
  );
}
