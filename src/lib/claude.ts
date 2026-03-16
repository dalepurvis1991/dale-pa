import Anthropic from '@anthropic-ai/sdk';
import {
  listLinearIssues,
  createLinearIssue,
  updateLinearIssue,
} from './tools/linear';
import {
  checkEmails,
  draftEmail,
  sendEmail,
} from './tools/gmail';
import {
  checkCalendar,
  createCalendarEvent,
  updateCalendarEvent,
} from './tools/calendar';

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
1. Email triage — summarize overnight emails, flag urgent items
2. Calendar review — what's on today, any new invites
3. Linear sprint check — what's in progress, blocked, due today/this week
4. Brain dump capture — route ideas correctly (Linear for tasks, Email for actions, Calendar for meetings)
5. Agency check-in — any open items from Salience or DMP

EVENING CALL (~6pm):
1. Day debrief — what got done, what didn't, any blockers
2. Quick wins for tomorrow — 2-3 things to hit first thing
3. EOD emails — any replies that need going out today

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
    {
      name: 'check_emails',
      description:
        'Search Dale\'s Gmail inbox. Returns recent emails with subject, sender, and brief snippet. Used for morning triage and checking for urgent items.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query (e.g., "from:zack@floorgiants.co.uk", "subject:sprint", "is:unread"). Leave empty to get recent emails.',
          },
          max_results: {
            type: 'integer',
            description: 'Maximum number of emails to return (default: 5, max: 20)',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'draft_email',
      description:
        'Create a Gmail draft email for Dale to review before sending. Does not send automatically.',
      input_schema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body text (plain text, no HTML)',
          },
          cc: {
            type: 'string',
            description: 'CC recipients (optional, comma-separated)',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'check_calendar',
      description: 'List calendar events for a given date. Returns time, title, attendees, and meeting location/link.',
      input_schema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description:
              "Date to check (format: YYYY-MM-DD, or 'today', 'tomorrow', 'next Monday')",
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'create_calendar_event',
      description: 'Create a new calendar event. Confirm all details with Dale before creating.',
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Meeting title',
          },
          date: {
            type: 'string',
            description: 'Date (format: YYYY-MM-DD)',
          },
          time: {
            type: 'string',
            description: 'Start time (format: HH:MM, e.g., "14:30")',
          },
          duration_minutes: {
            type: 'integer',
            description: 'Meeting duration in minutes (default: 30)',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses of attendees (optional)',
          },
        },
        required: ['title', 'date', 'time'],
      },
    },
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
        if (toolUse.name === 'check_emails') {
          const emails = await checkEmails(
            toolUse.input.query || '',
            toolUse.input.max_results || 5
          );
          result = JSON.stringify(emails);
        } else if (toolUse.name === 'draft_email') {
          const draft = await draftEmail(
            toolUse.input.to,
            toolUse.input.subject,
            toolUse.input.body,
            toolUse.input.cc
          );
          result = JSON.stringify(draft);
        } else if (toolUse.name === 'check_calendar') {
          const events = await checkCalendar(toolUse.input.date);
          result = JSON.stringify(events);
        } else if (toolUse.name === 'create_calendar_event') {
          const event = await createCalendarEvent(
            toolUse.input.title,
            toolUse.input.date,
            toolUse.input.time,
            toolUse.input.duration_minutes || 30,
            toolUse.input.attendees
          );
          result = JSON.stringify(event);
        } else if (toolUse.name === 'list_linear_issues') {
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
