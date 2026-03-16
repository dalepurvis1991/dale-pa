import { NextRequest, NextResponse } from 'next/server';
import { orchestrateConversation } from '@/lib/claude';
import {
  saveMessage,
  getConversationHistory,
  createCallRecord,
  updateCallRecord,
  deleteConversationMessages,
} from '@/lib/db';

interface RetellMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RetellWebhookPayload {
  event: 'call_started' | 'call_ended' | 'call_analyzed';
  call_id: string;
  transcript?: RetellMessage[];
  response_id?: string;
  user_transcript?: string;
  user_message?: string;
  user_audio_duration?: number;
}

interface RetellResponse {
  response_id: string;
  content: string;
  content_complete: boolean;
  end_call: boolean;
}

const callMetadata: {
  [key: string]: {
    startTime: Date;
    type?: 'morning' | 'evening' | 'adhoc';
    summary?: string;
  };
} = {};

export async function POST(request: NextRequest) {
  try {
    const payload: RetellWebhookPayload = await request.json();

    const { call_id, event, response_id, transcript, user_message } = payload;

    if (event === 'call_started') {
      callMetadata[call_id] = {
        startTime: new Date(),
        type: detectCallType(),
      };

      await createCallRecord({
        call_id,
        type: callMetadata[call_id].type || 'adhoc',
        duration_seconds: 0,
        summary: 'Call in progress',
      });

      return NextResponse.json({
        response_id: response_id || `${Date.now()}`,
        content:
          'Alright Dale, right, let me get into it. I\'ll check your emails and where we are with things. Give me a second...',
        content_complete: true,
        end_call: false,
      } as RetellResponse);
    }

    if (event === 'call_ended') {
      const startTime = callMetadata[call_id]?.startTime || new Date();
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      let summary = 'Call completed';
      const history = await getConversationHistory(call_id);
      if (history.length > 0) {
        const lastMessage = history[history.length - 1];
        summary = lastMessage.content.substring(0, 200);
      }

      await updateCallRecord(call_id, {
        duration_seconds: durationSeconds,
        summary,
      });

      delete callMetadata[call_id];

      return NextResponse.json({
        response_id: response_id || `${Date.now()}`,
        content: '',
        content_complete: true,
        end_call: true,
      } as RetellResponse);
    }

    if (event === 'call_analyzed') {
      if (!response_id || !user_message) {
        return NextResponse.json({
          response_id: response_id || `${Date.now()}`,
          content: 'I didn\'t catch that. Could you say that again?',
          content_complete: true,
          end_call: false,
        } as RetellResponse);
      }

      await saveMessage({
        call_id,
        role: 'user',
        content: user_message,
      });

      const history = await getConversationHistory(call_id);
      const conversationHistory = history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      let assistantResponse = '';

      try {
        assistantResponse = await orchestrateConversation(user_message, conversationHistory);
      } catch (err) {
        console.error('Claude orchestration error:', err);
        assistantResponse = 'Bit of a hiccup there. Can you run that by me again?';
      }

      if (assistantResponse) {
        await saveMessage({
          call_id,
          role: 'assistant',
          content: assistantResponse,
        });
      }

      const shouldEndCall =
        assistantResponse.toLowerCase().includes('all sorted') ||
        assistantResponse.toLowerCase().includes('cheers') ||
        assistantResponse.toLowerCase().includes('catch you later') ||
        assistantResponse.toLowerCase().includes('anything else');

      return NextResponse.json({
        response_id,
        content: assistantResponse || 'Sorry, I got a bit confused there.',
        content_complete: true,
        end_call: shouldEndCall,
      } as RetellResponse);
    }

    return NextResponse.json(
      { error: 'Unknown event type' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Retell webhook error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function detectCallType(): 'morning' | 'evening' | 'adhoc' {
  const hour = new Date().getHours();

  if (hour >= 7 && hour < 9) {
    return 'morning';
  } else if (hour >= 17 && hour < 19) {
    return 'evening';
  } else {
    return 'adhoc';
  }
}
