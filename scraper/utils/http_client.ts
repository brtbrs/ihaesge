import axios, { AxiosInstance } from "axios";
import { chromium } from "playwright";

const DEFAULT_TIMEOUT_MS = 20_000;

class HttpClient {
  private readonly axiosClient: AxiosInstance;

  constructor() {
    this.axiosClient = axios.create({
      timeout: DEFAULT_TIMEOUT_MS,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  }

  async getHtml(url: string, renderJs = false): Promise<string> {
    if (!renderJs) {
      const response = await this.axiosClient.get<string>(url, { responseType: "text" });
      return response.data;
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
