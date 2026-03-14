import axios from "axios";
import { chromium } from "playwright";

const DEFAULT_TIMEOUT_MS = 20_000;

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchWithRetry(url: string, retries = 3, retryDelayMs = 1_000): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.get<string>(url, {
        timeout: DEFAULT_TIMEOUT_MS,
        responseType: "text",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(retryDelayMs * attempt);
      }
    }
  }

  throw lastError;
}

class HttpClient {
  async getHtml(url: string, renderJs = false): Promise<string> {
    if (!renderJs) {
      return fetchWithRetry(url);
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: DEFAULT_TIMEOUT_MS });
      return await page.content();
    } finally {
      await browser.close();
    }
  }
}

export const httpClient = new HttpClient();
