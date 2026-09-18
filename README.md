# Popcorn

Sync any video with friends, live. A synchronized watch-party platform with real-time video synchronization, chat, host controls, and peer-to-peer screen sharing.

## Tech Stack

- **Frontend / Web**: Next.js (App Router), TypeScript, Tailwind CSS
- **Realtime Sync**: Socket.io (Node.js/TS)
- **Database**: MongoDB Atlas
- **Media**: YouTube IFrame API + WebRTC Screen Share

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file:
```env
MONGODB_URI=your_mongodb_connection_string
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 3. Run Development Servers
Start the Next.js dev server:
```bash
npm run dev
```

Start the realtime sync server:
```bash
npm run server:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
