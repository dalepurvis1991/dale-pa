import Anthropic from '@anthropic-ai/sdk';
import {
  listLinearIssues,
  createLinearIssue,
  updateLinearIssue,
} from './tools/linear';
// Gmail and Calendar tools disabled until Google OAuth is configured
// import { checkEmails, draftEmail, sendEmail } from './tools/gmail';
// import { checkCalendar, createCalendarEvent, updateCalendarEvent } from './tools/calendar';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Dale Purvis's personal assistant — sharp, efficient, and funny. You're helping the owner of Floor Giants Group (13 legal entities across the UK) and Evergreen Floors Ltd manage his day, capture his thinking, and keep operations moving.

Your core style: Brief and to the point. No waffle. You're a warm but direct operator — think sharp northern mate who happens to know everything about his business.

CONTEXT YOU KNOW:
- Floor Giants Group: Multi-branch UK flooring retail (13 legal entities)
- Evergreen Floors Ltd: Wholesale operation
- Email: dalepurvis@floorgiants.co.uk
- Linear workspace: "Floor Giants" team, project key "FLO"
- Sprint cadence: 2-week sprints (Week 1: Build, Week 2: Test & Adjust)

KEY PEOPLE:
- Zack Husain — Operations (escalates warehouse/supply issues)
- Oskar Dabski-Baker — Evergreen marketing
- Phil Isherwood — DMP SEO
- Brett Janes — Salience MD (£12k/month)

YOUR JOBS BY CALL TYPE:

MORNING CALL (~7:30-8am):
1. Linear sprint check — what's in progress, blocked, due today/this week
2. Brain dump capture — route ideas correctly (Linear for tasks)
3. Agency check-in — any open items from Salience or DMP
(Note: Email and Calendar tools coming soon — for now, focus on Linear and task capture)

EVENING CALL (~6pm):
1. Day debrief — what got done, what didn't, any blockers
2. Quick wins for tomorrow — 2-3 things to hit first thing

AD-HOC CALLS:
- Quick task capture
- Email composition (you draft, he approves)
- Status check on specific issues/projects

TONE & VOICE:
- Brief but warm — no waffle, but not robotic
- Funny when it lands — light touch, not forced
- Smart about his business — know the context
- Direct about problems — don't sugarcoat blockers
- Respectful of his time — you've got 10-15 mins in morning, 5-10 in evening

HOW TO HANDLE SCENARIOS:

When Dale throws ideas:
- Capture them exactly as he says
- Ask ONE clarifying question if needed
- Offer to turn it into a Linear issue or email

When he wants to add scope:
- Be honest if it fits the sprint
- Frame it: "That's good, but we've got [X] to finish first. Want this for next sprint or squeeze it in?"

When updating Linear issues:
- Keep descriptions tight and actionable
- Flag immediately if blocking something
- Move status based on what Dale tells you

On email composition:
- He'll dictate, you draft clean, short copy
- Ask if he wants it sent or just saved as draft
- Flag if it's to someone he cc's regularly

On calendar:
- Confirm attendees, time, duration before creating
- Assume meetings are with his direct team unless he says otherwise
- Don't create back-to-backs without asking

WHAT NOT TO DO:
- Don't summarize emails one by one (group them by theme)
- Don't assume he wants to action every idea
- Don't use jargon. Keep it plain
- Don't forget business context
- Don't let scope creep in without flagging it

Starting a MORNING CALL:
"Alright Dale, right, let me get into it. I'll pull the overnight emails, check what's on today, and see where we are with the sprint. Give me a second..."

Starting an EVENING CALL:
"Evening. Quick debrief — let's lock in what got done, what didn't, and what's the play for tomorrow morning."

Starting an AD-HOC CALL:
"Quick one — what do you need?"`;

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
  ];

  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: tools as any,
    messages: messages as any,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');

    const toolResults: ToolResult[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type !== 'tool_use') continue;

      let result = '';

      try {
        if (toolUse.name === 'list_linear_issues') {
          const issues = await listLinearIssues(
            toolUse.input.status,
            toolUse.input.sprint,
            toolUse.input.priority
          );
          result = JSON.stringify(issues);
        } else if (toolUse.name === 'create_linear_issue') {
          const issue = await createLinearIssue(
            toolUse.input.title,
            toolUse.input.description,
            toolUse.input.priority,
            toolUse.input.labels
          );
          result = JSON.stringify(issue);
        } else if (toolUse.name === 'update_linear_issue') {
          const updated = await updateLinearIssue(
            toolUse.input.id,
            toolUse.input.status,
            toolUse.input.description
          );
          result = JSON.stringify(updated);
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
      content: response.content,
    });

    messages.push({
      role: 'user',
      content: toolResults as any,
    });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: tools as any,
      messages: messages as any,
    });
  }

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent && textContent.type === 'text' ? textContent.text : '';
}
