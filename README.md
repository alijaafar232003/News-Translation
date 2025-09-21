# Telegram Bridge Bot

A Telegram bot that monitors source channels, translates Hebrew messages to Arabic, and forwards them to a destination channel with album support.

## Features

- ✅ **Better Translation**: Uses Google Translate API with LibreTranslate and MyMemory fallbacks
- ✅ **Arabic Source Labels**: Uses "المصدر:" instead of "Source:"
- ✅ **Album Support**: Properly handles photo/video albums (grouped media)
- ✅ **Free Hosting Ready**: Configured for Railway, Render, and Heroku deployment
- ✅ **Media Support**: Photos, videos, documents, and text messages
- ✅ **Session Persistence**: Saves Telegram session to avoid re-authentication

## Quick Start

### 1. Get Telegram API Credentials

1. Go to [my.telegram.org/apps](https://my.telegram.org/apps)
2. Create a new application
3. Copy your `API_ID` and `API_HASH`

### 2. Set Up Environment Variables

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required variables:
- `API_ID`: Your Telegram API ID
- `API_HASH`: Your Telegram API Hash
- `SOURCE_CHANNELS`: Comma-separated channel usernames (without @)
- `DEST_CHANNEL`: Destination channel username or link

Optional variables for better translation:
- `GOOGLE_TRANSLATE_API_KEY`: Google Translate API key (recommended)
- `LIBRE_TRANSLATE_URL`: Custom LibreTranslate instance URL

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Bot

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Free Hosting Deployment

### Railway (Recommended)

1. Fork this repository
2. Go to [railway.app](https://railway.app)
3. Connect your GitHub account
4. Create a new project from your fork
5. Add environment variables in Railway dashboard
6. Deploy!

### Render

1. Fork this repository
2. Go to [render.com](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repository
5. Use these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. Add environment variables
7. Deploy!

### Heroku

1. Fork this repository
2. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Create a new app:
   ```bash
   heroku create your-app-name
   ```
4. Set environment variables:
   ```bash
   heroku config:set API_ID=your_api_id
   heroku config:set API_HASH=your_api_hash
   # ... add other variables
   ```
5. Deploy:
   ```bash
   git push heroku main
   ```

## Translation Services

The bot uses multiple translation services in order of preference:

1. **Google Translate API** (best quality, requires API key)
2. **LibreTranslate** (good quality, free public instance)
3. **MyMemory** (fallback, free but lower quality)

### Setting Up Google Translate API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Cloud Translation API
4. Create credentials (API key or service account)
5. Add the API key to your environment variables

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_ID` | ✅ | Telegram API ID |
| `API_HASH` | ✅ | Telegram API Hash |
| `SOURCE_CHANNELS` | ✅ | Comma-separated source channel usernames |
| `DEST_CHANNEL` | ✅ | Destination channel username or link |
| `TARGET_LANG` | ❌ | Target language (default: ar) |
| `GOOGLE_TRANSLATE_API_KEY` | ❌ | Google Translate API key |
| `GOOGLE_CLOUD_PROJECT_ID` | ❌ | Google Cloud project ID |
| `GOOGLE_CLOUD_KEY_FILE` | ❌ | Path to service account key file |
| `LIBRE_TRANSLATE_URL` | ❌ | LibreTranslate instance URL |

## How It Works

1. **Authentication**: The bot logs into Telegram using your credentials
2. **Session Storage**: Saves session to avoid re-authentication
3. **Message Monitoring**: Listens for new messages in source channels
4. **Album Detection**: Detects grouped media (albums) and processes them together
5. **Translation**: Translates Hebrew text to Arabic using configured services
6. **Media Forwarding**: Forwards photos, videos, and documents with translated captions
7. **Source Attribution**: Adds Arabic source link: "المصدر: https://t.me/channel/message_id"

## Troubleshooting

### Common Issues

1. **Authentication Failed**: Make sure your API credentials are correct
2. **Translation Not Working**: Check if your translation service API key is valid
3. **Media Not Forwarding**: Ensure the bot has proper permissions in channels
4. **Album Issues**: Albums are processed when the first message arrives

### Logs

The bot provides detailed logging:
- 🔁 Translation attempts
- ✅ Successful operations
- ⚠️ Warnings and fallbacks
- ❌ Errors

## License

ISC License - feel free to modify and use as needed.
