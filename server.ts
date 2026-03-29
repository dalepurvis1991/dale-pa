/**
 * Custom Next.js server with WebSocket support for Retell Custom LLM
 *
 * This replaces `next start` so we can handle both:
 *   - HTTP requests → passed through to Next.js as normal
 *   - WebSocket upgrades at /api/retell → Retell Custom LLM protocol
 *
 * Deploy on Railway (supports persistent Node.js + WebSocket).
 * Vercel is fine for the dashboard but can't hold open WebSocket connections.
 */

import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';

// Use relative imports — tsx runs from project root, path aliases not resolved here
import { orchestrateConversation, generateCallSummary } from './src/lib/claude';
import {
  saveMessage,
  getConversationHistory,
  createCallRecord,
  updateCallRecord,
} from './src/lib/db';
import { cleanupExpiredMemories } from './src/lib/memory';

// ── Types ────────────────────────────────────────────────────────────────────

interface RetellTranscriptItem {
  role: 'agent' | 'user';
  content: string;
}

interface RetellCallDetailsMessage {
  interaction_type: 'call_details';
  call: {
    call_id: string;
    call_status: string;
    metadata?: Record<string, unknown>;
  };
}

interface RetellResponseRequiredMessage {
  interaction_type: 'response_required' | 'reminder_required';
  response_id: number;
  transcript: RetellTranscriptItem[];
  call: {
    call_id: string;
  };
}

interface RetellPingMessage {
  interaction_type: 'ping_pong';
  timestamp: number;
}

type RetellMessage =
  | RetellCallDetailsMessage
  | RetellResponseRequiredMessage
  | RetellPingMessage;

// ── Per-call state ────────────────────────────────────────────────────────────

const callMetadata: Record<
  string,
  { startTime: Date; type: 'morning' | 'evening' | 'adhoc' }
> = {};

function detectCallType(): 'morning' | 'evening' | 'adhoc' {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return 'morning';
  if (hour >= 17 && hour < 19) return 'evening';
  return 'adhoc';
}

// ── WebSocket handler ─────────────────────────────────────────────────────────

function handleRetellConnection(ws: WebSocket, req: IncomingMessage): void {
  let callId: string | null = null;

  console.log(`[Retell] New WebSocket connection from ${req.socket.remoteAddress}`);

  ws.on('message', async (data: Buffer) => {
    let message: RetellMessage;

    try {
      message = JSON.parse(data.toString()) as RetellMessage;
    } catch {
      console.error('[Retell] Failed to parse message:', data.toString().slice(0, 200));
      return;
    }

    // ── Ping/pong keepalive ──────────────────────────────────────────────────
    if (message.interaction_type === 'ping_pong') {
      ws.send(JSON.stringify({ response_type: 'ping_pong', timestamp: message.timestamp }));
      return;
    }

    // ── Call details (call just connected) ───────────────────────────────────
    if (message.interaction_type === 'call_details') {
      callId = message.call.call_id;
      const callType = detectCallType();

      callMetadata[callId] = { startTime: new Date(), type: callType };

      try {
        await createCallRecord({
          call_id: callId,
          type: callType,
          duration_seconds: 0,
          summary: 'Call in progress',
        });
      } catch (err) {
        console.error('[Retell] Failed to create call record:', err);
      }

      // Send opening greeting — brief and snappy
      ws.send(
        JSON.stringify({
          response_type: 'response',
          response_id: 0,
          content:
            "Alright Dale. I've got Linear open. What do you need?",
          content_complete: true,
          end_call: false,
        })
      );

      console.log(`[Retell] Call started: ${callId} (${callType})`);
      return;
    }

    // ── Response required (user spoke) ───────────────────────────────────────
    if (
      message.interaction_type === 'response_required' ||
      message.interaction_type === 'reminder_required'
    ) {
      const { response_id, transcript } = message;

      if (!callId) {
        callId = message.call?.call_id || null;
        if (!callId) {
          console.error('[Retell] response_required received but no call_id set');
          return;
        }
      }

      // Extract the latest user utterance from transcript
      const userItems = transcript.filter((t) => t.role === 'user');
      const userMessage = userItems[userItems.length - 1]?.content?.trim() || '';

      if (!userMessage) {
        // Reminder with no new user message — send a nudge
        ws.send(
          JSON.stringify({
            response_type: 'response',
            response_id,
            content: 'Still here — go ahead.',
            content_complete: true,
            end_call: false,
          })
        );
        return;
      }

      console.log(`[Retell] User (${callId}): ${userMessage.slice(0, 80)}`);

      // Persist user message
      try {
        await saveMessage({ call_id: callId, role: 'user', content: userMessage });
      } catch (err) {
        console.error('[Retell] Failed to save user message:', err);
      }

      // Build conversation history from DB (excluding message we just saved)
      let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
      try {
        const history = await getConversationHistory(callId);
        conversationHistory = history
          .slice(0, -1)
          .map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
      } catch (err) {
        console.error('[Retell] Failed to load conversation history:', err);
      }

      // Call Claude with tools
      let assistantResponse = '';
      try {
        assistantResponse = await orchestrateConversation(userMessage, conversationHistory);
      } catch (err) {
        console.error('[Retell] Claude orchestration error:', err);
        assistantResponse = "Bit of a hiccup there. Can you run that by me again?";
      }

      // Persist assistant response
      if (assistantResponse) {
        try {
          await saveMessage({ call_id: callId, role: 'assistant', content: assistantResponse });
        } catch (err) {
          console.error('[Retell] Failed to save assistant message:', err);
        }
      }

      console.log(`[Retell] Assistant (${callId}): ${assistantResponse.slice(0, 80)}`);

      const shouldEndCall =
        assistantResponse.toLowerCase().includes('catch you later') ||
        assistantResponse.toLowerCase().includes('all sorted');

      ws.send(
        JSON.stringify({
          response_type: 'response',
          response_id,
          content: assistantResponse || "Sorry, got a bit confused there.",
          content_complete: true,
          end_call: shouldEndCall,
        })
      );

      return;
    }

    console.warn('[Retell] Unknown interaction_type:', (message as any).interaction_type);
  });

  // ── Call ended ───────────────────────────────────────────────────────────────
  ws.on('close', async () => {
    console.log(`[Retell] WebSocket closed for call: ${callId}`);
    if (!callId) return;

    const meta = callMetadata[callId];
    if (!meta) return;

    const durationSeconds = Math.floor((Date.now() - meta.startTime.getTime()) / 1000);

    try {
      const history = await getConversationHistory(callId);
      const summary =
        history.length > 0 ? history[history.length - 1].content.slice(0, 200) : 'Call completed';

      await updateCallRecord(callId, { duration_seconds: durationSeconds, summary });

      const conversationHistory = history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Background: extract memories + generate summary (non-blocking)
      generateCallSummary(callId, meta.type, conversationHistory).catch((err) =>
        console.error('[Retell] Background memory generation failed:', err)
      );
      cleanupExpiredMemories().catch(() => {});
    } catch (err) {
      console.error('[Retell] Failed to finalize call record:', err);
    }

    delete callMetadata[callId];
  });

  ws.on('error', (err) => {
    console.error(`[Retell] WebSocket error for call ${callId}:`, err.message);
  });
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  // Upgrade HTTP → WebSocket only at /api/retell
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url ?? '/');
    if (pathname === '/api/retell') {
      wss.handleUpgrade(req, socket as any, head, (ws) => {
        handleRetellConnection(ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);

  server.listen(port, () => {
    console.log(`> Dale PA ready on http://localhost:${port}`);
    console.log(`> WebSocket endpoint: ws://localhost:${port}/api/retell`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
  });
});
