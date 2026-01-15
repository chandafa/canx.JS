# CanxJS HotWire (Real-Time)

HotWire in CanxJS provides a lightweight, real-time communication layer using **Server-Sent Events (SSE)**. It enables you to push updates to the client without the complexity of WebSockets.

## Setup

First, initialize the HotWire feature in your router or controller.

```typescript
import { hotWire } from "canxjs";

// In your controller
export class ChatController extends Controller {
  @Get("/stream")
  stream(req, res) {
    // Determine channels to subscribe to
    const channels = ["global", `user_${req.user.id}`];

    // Hand over response to HotWire
    return hotWire.upgrade(req, res, channels);
  }
}
```

## Sending Events

You can broadcast events from anywhere in your application (Controller, Queue, Scheduler).

```typescript
// Broadcast to a specific channel
hotWire.send("global", {
  type: "announcement",
  message: "System maintenance in 10 minutes.",
});

// Broadcast HTML fragment (Turbo-style)
hotWire.send(
  "chat_room_1",
  `
  <div id="messages" hx-swap-oob="beforeend">
    <div class="message">New message!</div>
  </div>
`,
  "html"
);
```

## Client-Side Consumption

On the client side, use standard `EventSource` to listen for updates.

```javascript
const evtSource = new EventSource("/stream");

evtSource.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log("New event:", data);

  // Or handle specific event types
  if (data.type === "html") {
    // Process HTML update
  }
};
```

## HotWire Protocol

CanxJS HotWire uses a simple JSON protocol for messages:

```json
{
  "channel": "global",
  "event": "message",
  "data": { ... }
}
```

Or for HTML updates:

```json
{
  "channel": "ui",
  "event": "html",
  "data": "<div>...</div>"
}
```
