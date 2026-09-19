export const AUTH_EXPIRED_EVENT = "auth-expired";
export const AUTH_CHANGED_EVENT = "auth-changed";

type ForceLogoutOptions = {
  message?: string;
  openLogin?: boolean;
};

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payloadBase64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = payloadBase64.padEnd(
      payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4),
      "="
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getUserRole(): string | null {
  return localStorage.getItem("role");
}

export function isTokenExpired(token?: string | null): boolean {
  const finalToken = token ?? getToken();
  if (!finalToken) return true;

  const payload = decodeJwtPayload(finalToken);
  if (!payload?.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

export function getTokenExpiryDelayMs(token?: string | null): number | null {
  const finalToken = token ?? getToken();
  if (!finalToken) return null;

  const payload = decodeJwtPayload(finalToken);
  if (!payload?.exp) return null;

  const nowMs = Date.now();
  const expMs = payload.exp * 1000;
  return Math.max(expMs - nowMs, 0);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

export function clearAuthStorage() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("email");
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("avatar");
}

export function forceLogout(options?: ForceLogoutOptions) {
  clearAuthStorage();

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));

  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: {
        message:
          options?.message ||
          "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
        openLogin: options?.openLogin ?? true,
      },
    })
  );
}

export function logoutIfTokenExpired(options?: ForceLogoutOptions): boolean {
  const token = getToken();
  if (!token) return true;

  if (isTokenExpired(token)) {
    forceLogout(options);
    return true;
  }

  return false;
}