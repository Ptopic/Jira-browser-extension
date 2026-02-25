import { Storage } from "@plasmohq/storage";

const APP_URL = process.env.PLASMO_PUBLIC_APP_URL || "http://localhost:3000";

const storage = new Storage({ area: "local" });

export interface AuthToken {
  value: string;
  expiresAt: number;
}

export async function getCookieToken(): Promise<string | null> {
	const chromeApi = (globalThis as { chrome?: any }).chrome;

	if (!chromeApi?.cookies?.get) {
		return null;
	}

  return new Promise((resolve) => {
    chromeApi.cookies.get(
      {
        url: APP_URL,
        name: "auth_token",
      },
      (cookie: { value?: string } | null) => {
        if (cookie && cookie.value) {
          resolve(cookie.value);
        } else {
          resolve(null);
        }
      }
    );
  });
}

export async function getStoredAuthToken(): Promise<string | null> {
  const tokenData = await storage.get<AuthToken>("auth_token");
  return tokenData?.value ?? null;
}

export async function syncTokenFromCookie(): Promise<string | null> {
  const cookieToken = await getCookieToken();
  
  if (!cookieToken) {
    await storage.remove("auth_token");
    return null;
  }

  await storage.set("auth_token", {
    value: cookieToken,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 28,
  } as AuthToken);

  return cookieToken;
}

export { storage };
