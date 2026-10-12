const axios = require("axios");
const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const config = require("./config");

const SYSTEM_PROMPT = `You are an interview coding assistant. Answer the user's question directly and accurately.
For coding problems, explain the approach briefly, then provide a correct, readable solution and its complexity when useful. Ask a clarifying question only when essential. Keep responses concise and use Markdown.`;

let isInitialized = false;

function initializeLLMService() {
  if (isInitialized) return;

  ipcMain.handle("analyze-screenshot", async (event, data) => {
    try {
      return await makeLLMRequest(event, data);
    } catch (error) {
      throw new Error(`Failed to analyze screenshot: ${error.message}`);
    }
  });

  ipcMain.handle("test-response", async (event, request) => {
    try {
      const data =
        typeof request === "string" ? { prompt: request } : request || {};
      return await makeLLMRequest(event, data);
    } catch (error) {
      throw new Error(`Failed to get assistant response: ${error.message}`);
    }
  });

  isInitialized = true;
}

async function makeLLMRequest(event, data = {}) {
  const apiKey = config.getOpenAIKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Open Settings and add your API key."
    );
  }
  if (!apiKey.startsWith("sk-")) {
    throw new Error("Invalid OpenAI API key format.");
  }

  const content = [];
  const history = Array.isArray(data.history) ? data.history : [];
  for (const message of history.slice(-10)) {
    if (
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim()
    ) {
      content.push({ role: message.role, content: message.content });
    }
  }

  const prompt =
    typeof data.prompt === "string" && data.prompt.trim()
      ? data.prompt.trim()
      : "Analyze this screenshot and provide concise, actionable insights.";
  const userContent = [{ type: "input_text", text: prompt }];

  if (data.filePath) {
    const screenshotDirectory = path.resolve(
      require("electron").app.getPath("userData"),
      "screenshots"
    );
    const screenshotPath = path.resolve(data.filePath);
    const relativePath = path.relative(screenshotDirectory, screenshotPath);
    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath) ||
      !fs.existsSync(screenshotPath)
    ) {
      throw new Error("Screenshot file not found in the app screenshots folder.");
    }

    const imageBuffer = await fs.promises.readFile(screenshotPath);
    userContent.push({
      type: "input_image",
      image_url: `data:image/png;base64,${imageBuffer.toString("base64")}`,
    });
  }

  content.push({ role: "user", content: userContent });

  const messageId = data.messageId || randomUUID();
  try {
    const response = await axios({
      method: "post",
      url: "https://api.openai.com/v1/responses",
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      data: {
        model: "gpt-4o-mini",
        instructions: SYSTEM_PROMPT,
        input: content,
        max_output_tokens: 1200,
      },
    });

    const resultContent =
      response.data.output_text ||
      (response.data.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n");
    if (!resultContent) {
      throw new Error("The assistant returned an empty response.");
    }

    const result = {
      success: true,
      messageId,
      content: resultContent,
      provider: "openai",
      model: "gpt-4o-mini",
      status: "completed",
    };
    if (!event.sender.isDestroyed()) {
      event.sender.send("stream-update", {
        messageId,
        content: resultContent,
        isComplete: true,
        status: "completed",
      });
    }
    return result;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        throw new Error(
          "Invalid API key. Check the key in Settings and try again."
        );
      }
      const apiMessage = error.response.data?.error?.message;
      throw new Error(`OpenAI API error: ${apiMessage || error.message}`);
    }
    if (error.request) {
      throw new Error(
        "No response received from OpenAI. Check your internet connection and try again."
      );
    }
    throw error;
  }
}

module.exports = {
  initializeLLMService,
};
