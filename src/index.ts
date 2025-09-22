import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createInterface } from "readline/promises";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { createServer } from "http";

// --- Configuration ---
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH!;
const SOURCES = (process.env.SOURCE_CHANNELS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const DEST = process.env.DEST_CHANNEL!;
const TRANSLATE_BOT = "YTranslateBot";

// --- Utilities ---
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => rl.question(q);

function isImageDoc(doc: any): boolean {
  return doc?.mimeType?.startsWith("image/");
}

function isVideoDoc(doc: any): boolean {
  return doc?.mimeType?.startsWith("video/");
}

// --- Hebrew Detection ---
function hasHebrew(text: string): boolean {
  if (!text?.trim()) return false;
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

// --- Translation with Telegram Bot ---
const pendingTranslations = new Map<string, {
  resolve: (value: string) => void;
  timeout: NodeJS.Timeout;
  originalText: string;
}>();

async function translateWithBot(text: string): Promise<string> {
  if (!text?.trim()) {
    console.log("❌ Empty text - returning as is");
    return text;
  }
  
  console.log(`📝 Checking text: "${text.substring(0, 50)}..."`);
  
  if (!hasHebrew(text)) {
    console.log("📝 No Hebrew detected - keeping original");
    return text;
  }
  
  console.log(`🔄 Translating Hebrew → Arabic using @${TRANSLATE_BOT}`);
  
  return new Promise((resolve) => {
    const translationId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    const timeout = setTimeout(() => {
      pendingTranslations.delete(translationId);
      console.warn(`⏰ Translation timeout - using original text`);
      resolve(text);
    }, 15000);
    
    pendingTranslations.set(translationId, {
      resolve,
      timeout,
      originalText: text
    });
    
    client.getEntity(TRANSLATE_BOT).then(botEntity => {
      const messageToSend = `${translationId}\n${text}`;
      return client.sendMessage(botEntity, { message: messageToSend });
    }).catch(error => {
      clearTimeout(timeout);
      pendingTranslations.delete(translationId);
      console.error(`❌ Failed to send to @${TRANSLATE_BOT}:`, error);
      resolve(text);
    });
  });
}

// --- Album Handling ---
const albumGroups = new Map<string, { messages: any[]; timeout: NodeJS.Timeout }>();

async function processAlbum(messages: any[]): Promise<void> {
  if (!messages.length) return;

  const textMsg = messages.find(msg => msg.message?.trim());
  const originalText = textMsg?.message?.trim() || "";
  const translatedText = originalText ? await translateWithBot(originalText) : "";

  const peer = await messages[0].getChat();
  const username = "username" in (peer as any) && (peer as any).username 
    ? String((peer as any).username).toLowerCase() 
    : "";

  const caption = translatedText || originalText;
  const sourceName = username || "Unknown";
  const fullCaption = caption ? `${caption}\n\nالمصدر: ${sourceName}` : `المصدر: ${sourceName}`;

  try {
    const destEntity = await client.getEntity(DEST);
    const mediaFiles = messages
      .filter(msg => msg.photo || (msg.media && (isImageDoc(msg.document) || isVideoDoc(msg.document))))
      .map(msg => {
        if (msg.photo) {
          return msg.photo;
        } else if (msg.media && isVideoDoc(msg.document)) {
          return msg.media;
        } else if (msg.media && isImageDoc(msg.document)) {
          return msg.media;
        }
        return null;
      })
      .filter(Boolean);

    if (mediaFiles.length > 0) {
      await client.sendFile(destEntity, {
        file: mediaFiles,
        caption: fullCaption,
        forceDocument: false
      });
      console.log(`📸 Album sent (${mediaFiles.length} items)`);
    }
  } catch (e) {
    console.error("❌ Album send failed:", e);
  }
}

// --- Main Bot Logic ---
let client: TelegramClient;

async function main(): Promise<void> {
  // Health server
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Active');
  });
  server.listen(process.env.PORT || 3000);

  // Load session
  let sessionString = process.env.SESSION?.trim() || "";
  if (!sessionString) {
    // Try base64 encoded session
    const b64Session = process.env.SESSION_B64?.trim();
    if (b64Session) {
      sessionString = Buffer.from(b64Session, 'base64').toString('utf8');
      console.log("🔑 Using base64 decoded session");
    }
  }
  if (!sessionString && existsSync("./session.txt")) {
    sessionString = await readFile("./session.txt", "utf8").catch(() => "");
  }

  // Clear invalid session
  if (sessionString) {
    console.log("🔑 Found existing session, testing validity...");
  } else {
    console.log("🔑 No existing session found");
  }

  client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5
  });

  // Login if needed or if session is invalid
  if (!sessionString) {
    console.log("🔑 No session found - starting fresh login...");
    // In prod there is no TTY; fail fast instead of hanging
    if (process.env.NODE_ENV === "production" || process.env.CI) {
      throw new Error("Missing Telegram SESSION. Set the SESSION env var.");
    }
    await client.start({
      phoneNumber: async () => await ask("Phone: "),
      password: async () => await ask("2FA (optional): "),
      phoneCode: async () => await ask("Code: "),
      onError: console.error,
    });
    await writeFile("./session.txt", (client.session as StringSession).save(), "utf8");
    await rl.close();
  } else {
    console.log("🔑 Trying to connect with existing session...");
    try {
      await client.connect();
      console.log("✅ Session valid - connected successfully");
    } catch (error: any) {
      console.log("❌ Session invalid - starting fresh login...");
      console.log("Error:", error.message);
      
      // Clear invalid session
      sessionString = "";
      client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 5
      });
      
      // In prod there is no TTY; fail fast instead of hanging
      if (process.env.NODE_ENV === "production" || process.env.CI) {
        throw new Error("Invalid Telegram SESSION. Delete SESSION env var and set a new one.");
      }
      
      await client.start({
        phoneNumber: async () => await ask("Phone: "),
        password: async () => await ask("2FA (optional): "),
        phoneCode: async () => await ask("Code: "),
        onError: console.error,
      });
      
      // Save new session
      await writeFile("./session.txt", (client.session as StringSession).save(), "utf8");
      console.log("✅ New session saved");
      await rl.close();
    }
  }

  const destEntity = await client.getEntity(DEST);

  // Message handler
  client.addEventHandler(async (event: NewMessageEvent) => {
    const msg = event.message;
    if (!msg) return;

    const peer = await msg.getChat();
    const username = "username" in (peer as any) && (peer as any).username 
      ? String((peer as any).username).toLowerCase() 
      : "";

    // Handle translation bot responses
    if (username === TRANSLATE_BOT.toLowerCase()) {
      const messageText = msg.message?.trim() || "";
      
      // Remove first line (العربية: ID) and get clean translation
      const lines = messageText.split('\n');
      const translatedText = lines.length >= 2 ? lines.slice(1).join('\n').trim() : messageText;
      
      // Resolve oldest pending translation
      if (pendingTranslations.size > 0) {
        const firstKey = pendingTranslations.keys().next().value;
        if (firstKey) {
          const pending = pendingTranslations.get(firstKey);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingTranslations.delete(firstKey);
            console.log(`✅ Translation received`);
            pending.resolve(translatedText);
          }
        }
      }
      return;
    }

    // Check if from allowed source
    console.log(`📥 Message from: ${username}`);
    console.log(`🔍 Allowed sources: ${SOURCES.join(", ")}`);
    if (!SOURCES.includes(username)) {
      console.log(`❌ Source not allowed - ignoring message`);
      return;
    }
    console.log(`✅ Source allowed - processing message`);

    // Handle albums
    if (msg.groupedId) {
      const groupKey = `${msg.chatId}_${msg.groupedId}`;
      
      if (albumGroups.has(groupKey)) {
        const group = albumGroups.get(groupKey)!;
        group.messages.push(msg);
        clearTimeout(group.timeout);
        group.timeout = setTimeout(() => {
          processAlbum(group.messages);
          albumGroups.delete(groupKey);
        }, 2000);
      } else {
        const timeout = setTimeout(() => {
          const group = albumGroups.get(groupKey);
          if (group) {
            processAlbum(group.messages);
            albumGroups.delete(groupKey);
          }
        }, 2000);
        
        albumGroups.set(groupKey, { messages: [msg], timeout });
      }
      return;
    }

    // Handle individual messages
    const originalText = msg.message?.trim() || "";
    console.log(`📝 Original text: "${originalText}"`);
    const translatedText = originalText ? await translateWithBot(originalText) : "";
    console.log(`🔄 Translated text: "${translatedText}"`);
    
    const sourceName = username || "Unknown";
    const caption = translatedText || originalText;
    const fullCaption = caption ? `${caption}\n\nالمصدر: ${sourceName}` : `المصدر: ${sourceName}`;
    console.log(`📤 Final caption: "${fullCaption}"`);

    try {
      if (msg.media) {
        if (msg.photo) {
          await client.sendMessage(destEntity, {
            message: fullCaption,
            file: msg.photo,
            forceDocument: false
          });
        } else if (isImageDoc(msg.document)) {
          await client.sendMessage(destEntity, {
            message: fullCaption,
            file: msg.media,
            forceDocument: false
          });
        } else if (isVideoDoc(msg.document)) {
          await client.sendMessage(destEntity, {
            message: fullCaption,
            file: msg.media,
            forceDocument: false
          });
        }
      } else if (fullCaption) {
        await client.sendMessage(destEntity, {
          message: fullCaption
        });
      }
    } catch (e) {
      console.error("❌ Send failed:", e);
    }
  }, new NewMessage({}));

  console.log(`🚀 Bridge: ${SOURCES.join(", ")} → ${DEST}`);
  console.log(`🤖 Using @${TRANSLATE_BOT} for Hebrew translations`);

  // Keep alive
  setInterval(() => {}, 30000);
}

main().catch(console.error);