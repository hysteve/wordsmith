import fs from "fs/promises";
import path from "path";
import "../env.ts";
import axios from "axios";


// Load config from external file or env
const configPath =
  process.env.LM_CONFIG_PATH || path.join(process.cwd(), "lm-config.json");
let lmConfig = {};
try {
  lmConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
} catch (e) {
  lmConfig = {
    provider: process.env.LM_PROVIDER || "openai",
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: process.env.LMSTUDIO_ENDPOINT,
    model: process.env.LM_MODEL || "gpt-4",
  };
}

export function lmAvailable() {
  return (
    (lmConfig.provider === "openai" && lmConfig.apiKey) ||
    (lmConfig.provider === "lmstudio" && lmConfig.endpoint)
  );
}

export async function runLM(prompt, options = {}) {
  if (!lmAvailable() || options.skipLM) {
    return { skipped: true, reason: "No LM config or skipLM set" };
  }
  if (lmConfig.provider === "openai") {
    // OpenAI API
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: lmConfig.model,
        messages: [{ role: "user", content: prompt }],
        ...options.openai,
      },
      {
        headers: {
          Authorization: `Bearer ${lmConfig.apiKey}`,
        },
      },
    );
    return response.data.choices[0].message.content;
  } else if (lmConfig.provider === "lmstudio") {
    // LMStudio API
    const response = await axios.post(lmConfig.endpoint, {
      prompt,
      ...options.lmstudio,
    });
    return response.data.result || response.data.choices?.[0]?.text;
  }
  throw new Error("No valid LM provider configured");
}
