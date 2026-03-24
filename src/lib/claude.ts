import Anthropic from '@anthropic-ai/sdk';
import {
  listLinearIssues,
  createLinearIssue,
  updateLinearIssue,
} from './tools/linear';
import {
  buildMemoryContext,
  saveCallSummary,
  saveMemoryEntries,
  type MemoryEntry,
  type CallSummary,
} from './memory';
import { getSystemPrompt } from './soul';
// Gmail and Calendar tools disabled until Google OAuth is configured
// import { checkEmails, draftEmail, sendEmail } from './tools/gmail';
// import { checkCalendar, createCalendarEvent, updateCalendarEvent } from './tools/calendar';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export async function orchestrateConversation(
  userMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  // Load soul (SOUL.md + STYLE.md) and memory context in parallel
  let soulPrompt = '';
  let memoryContext = '';
  try {
    [soulPrompt, memoryContext] = await Promise.all([
      getSystemPrompt(),
      buildMemoryContext().catch((err) => {
        console.error('Failed to load memory context (continuing without):', err);
        return '';
      }),
    ]);
  } catch (err) {
    console.error('Failed to load soul prompt:', err);
    soulPrompt = 'You are Dale Purvis\'s personal assistant. Be brief, direct, and helpful.';
  }

  const systemPromptWithMemory = memoryContext
    ? `${soulPrompt}${memoryContext}`
    : soulPrompt;

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];

  const tools = [
    // Gmail and Calendar tools disabled until Google OAuth is configured
    // They can be re-enabled by uncommenting and adding GOOGLE_* env vars
    {
      name: 'list_linear_issues',
      description:
        'Pull Linear issues from the Floor Giants sprint. Filter by status, sprint, or priority.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description:
              "Filter by status (e.g., 'in progress', 'blocked', 'to do', 'done'). Leave empty for all.",
          },
          sprint: {
            type: 'string',
            description: "Filter by sprint (e.g., 'current', 'next'). Default: 'current'.",
          },
          priority: {
            type: 'string',
            description:
              "Filter by priority (e.g., 'urgent', 'high', 'medium'). Leave empty for all.",
          },
        },
      },
    },
    {
      name: 'create_linear_issue',
      description:
        'Create a new Linear issue. Used to capture ideas, tasks, and action items from Dale\'s brain dumps.',
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short, clear issue title',
          },
          description: {
            type: 'string',
            description:
              'Detailed description of the work (e.g., what Dale said, context, acceptance criteria)',
          },
          priority: {
            type: 'string',
            description: "Priority level: 'urgent', 'high', 'medium', 'low' (default: 'medium')",
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: "Labels to tag the issue (e.g., 'feature', 'bug', 'ops', 'evergreen')",
          },
          project: {
            type: 'string',
            description: "Project key (default: 'FLO' for Floor Giants)",
          },
        },
        required: ['title', 'description', 'priority'],
      },
    },
    {
      name: 'update_linear_issue',
      description:
        'Update an existing Linear issue (status, description, etc.). Used to move work through the sprint.',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Linear issue ID (e.g., "FLO-47")',
          },
          status: {
            type: 'string',
            description: 'New status (e.g., "to do", "in progress", "done", "blocked")',
          },
          description: {
            type: 'string',
            description: 'Updated description (optional)',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create_cowork_handoff',
      description:
        'Hand off a task to Claude Cowork for execution. Use this when Dale asks you to do something you cannot do during a call — send an email, book a calendar event, research something, update Odoo, draft a document, etc. Cowork will pick it up automatically and execute it. Always confirm to Dale what you\'ve handed off.',
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short, clear title of what needs to be done (e.g., "Draft email to Brett re Hull delivery")',
          },
          description: {
            type: 'string',
            description:
              'Full instructions for Cowork — be specific. Include: what to do, who it involves, any context Dale gave, and what the output should be. Write as if briefing a colleague who wasn\'t on the call.',
          },
          priority: {
            type: 'string',
            description: "Priority: 'urgent', 'high', 'medium', 'low' (default: 'medium')",
          },
        },
        required: ['title', 'description', 'priority'],
      },
    },
  ];

  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPromptWithMemory,
    tools: tools as any,
    messages: messages as any,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');

    const toolResults: ToolResult[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type !== 'tool_use') continue;

      const input = toolUse.input as Record<string, any>;
      let result = '';

      try {
        if (toolUse.name === 'list_linear_issues') {
          const issues = await listLinearIssues(
            input.status,
            input.sprint,
            input.priority
          );
          result = JSON.stringify(issues);
        } else if (toolUse.name === 'create_linear_issue') {
          const issue = await createLinearIssue(
            input.title,
            input.description,
            input.priority,
            input.labels
          );
          result = JSON.stringify(issue);
        } else if (toolUse.name === 'update_linear_issue') {
          const updated = await updateLinearIssue(
            input.id,
            input.status,
            input.description
          );
          result = JSON.stringify(updated);
        } else if (toolUse.name === 'create_cowork_handoff') {
          const issue = await createLinearIssue(
            input.title,
            `🤖 **Cowork Handoff — created during voice call**\n\n${input.description}`,
            input.priority,
            ['🤖 Claude Action']
          );
          result = JSON.stringify({ ...issue, handoff: true });
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${toolUse.name}` });
        }
      } catch (err) {
        result = JSON.stringify({ error: String(err) });
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({
      role: 'assistant',
      content: response.content as any,
    });

    messages.push({
      role: 'user',
      content: toolResults as any,
    });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPromptWithMemory,
      tools: tools as any,
      messages: messages as any,
    });
  }

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent && textContent.type === 'text' ? textContent.text : '';
}

// ── Post-Call Memory Extraction ─────────────────────────────────────────
// Called at call_ended to generate a structured summary + extract memories

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system for Dale Purvis's PA. Given a call transcript, extract:

1. A concise summary (2-3 sentences max)
2. Key decisions made (array of strings)
3. Action items / follow-ups (array of strings)
4. Topics discussed (array of short labels)
5. Dale's mood (one word: focused, frustrated, energised, tired, neutral, excited, stressed)
6. Important facts to remember for future calls — these become memory entries

For memory entries, categorise each as:
- "decision" — something Dale decided
- "task" — something that needs doing
- "idea" — something Dale floated but didn't commit to
- "person" — a note about someone (supplier, staff, contact)
- "preference" — how Dale likes things done
- "context" — business context worth remembering
- "followup" — something to check back on

Rate importance 1-5 (5 = critical, always surface; 1 = nice to know).

Respond ONLY with valid JSON in this exact format:
{
  "summary": "...",
  "key_decisions": ["..."],
  "action_items": ["..."],
  "topics_discussed": ["..."],
  "mood": "...",
  "memories": [
    {
      "category": "decision|task|idea|person|preference|context|followup",
      "summary": "...",
      "details": "...",
      "tags": ["..."],
      "importance": 1-5
    }
  ]
}`;

interface ExtractedMemory {
  summary: string;
  key_decisions: string[];
  action_items: string[];
  topics_discussed: string[];
  mood: string;
  memories: Array<{
    category: MemoryEntry['category'];
    summary: string;
    details?: string;
    tags?: string[];
    importance: number;
  }>;
}

export async function generateCallSummary(
  callId: string,
  callType: 'morning' | 'evening' | 'adhoc',
  conversationHistory: ConversationMessage[]
): Promise<void> {
  if (conversationHistory.length === 0) return;

  const transcript = conversationHistory
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: MEMORY_EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Call type: ${callType}\nCall ID: ${callId}\n\nTranscript:\n${transcript}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') return;

    const extracted: ExtractedMemory = JSON.parse(textContent.text);

    // Save the call summary
    await saveCallSummary({
      call_id: callId,
      call_type: callType,
      summary: extracted.summary,
      key_decisions: extracted.key_decisions,
      action_items: extracted.action_items,
      topics_discussed: extracted.topics_discussed,
      mood: extracted.mood,
    });

    // Save individual memory entries
    if (extracted.memories && extracted.memories.length > 0) {
      const entries: MemoryEntry[] = extracted.memories.map((mem) => ({
        call_id: callId,
        category: mem.category,
        summary: mem.summary,
        details: mem.details,
        tags: mem.tags,
        importance: mem.importance,
      }));
      await saveMemoryEntries(entries);
    }

    console.log(
      `Memory saved for call ${callId}: ${extracted.memories?.length || 0} entries, summary: "${extracted.summary.substring(0, 80)}..."`
    );
  } catch (err) {
    console.error('Memory extraction failed (non-blocking):', err);
    // Non-blocking — don't let memory failures break the call flow
  }
}
