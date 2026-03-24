import { LinearClient } from '@linear/sdk';

const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY || '',
});

// Hardcoded — Floor Giants team
const FLO_TEAM_ID = '19d55536-0758-44ce-b3ad-82b7ebb3ddcb';

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  labels?: string[];
}

async function resolveStateName(issue: any): Promise<string> {
  try {
    const state = await issue.state;
    return state?.name || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function resolveLabels(issue: any): Promise<string[]> {
  try {
    const labelsConnection = await issue.labels();
    return labelsConnection.nodes.map((l: any) => l.name);
  } catch {
    return [];
  }
}

async function resolveLabelIds(labelNames: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of labelNames) {
    try {
      const result = await linearClient.issueLabels({
        filter: { name: { eq: name } },
      });
      if (result.nodes.length > 0) {
        ids.push(result.nodes[0].id);
      }
    } catch {
      // skip unresolvable labels
    }
  }
  return ids;
}

export async function listLinearIssues(
  status?: string,
  sprint?: string,
  priority?: string
): Promise<LinearIssue[]> {
  try {
    const filters: any = {
      team: { key: { eq: 'FLO' } },
    };

    if (status) {
      filters.state = { name: { eq: status } };
    }

    if (priority) {
      const priorityMap: { [key: string]: number } = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      filters.priority = { eq: priorityMap[priority] || undefined };
    }

    if (sprint === 'current') {
      filters.cycle = { isCurrent: { eq: true } };
    } else if (sprint === 'next') {
      filters.cycle = { isNext: { eq: true } };
    }

    const issueConnection = await linearClient.issues(filters);
    const result: LinearIssue[] = [];

    for (const issue of issueConnection.nodes) {
      const labels = await resolveLabels(issue);
      const stateName = await resolveStateName(issue);
      result.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || '',
        status: stateName,
        priority: issue.priority || 0,
        labels,
      });
    }

    return result;
  } catch (err) {
    console.error('Linear list issues error:', err);
    throw err;
  }
}

export async function createLinearIssue(
  title: string,
  description: string,
  priority: string,
  labels?: string[]
): Promise<LinearIssue> {
  try {
    const priorityMap: { [key: string]: number } = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    // Resolve label names to IDs before creating
    const labelIds = labels && labels.length > 0
      ? await resolveLabelIds(labels)
      : undefined;

    const payload = await linearClient.issueCreate({
      teamId: FLO_TEAM_ID,
      title,
      description,
      priority: priorityMap[priority] || 3,
      labelIds,
    });

    const createdIssue = await payload.issue;
    if (!createdIssue) {
      throw new Error('Issue creation failed — no issue returned');
    }

    const issueLabels = await resolveLabels(createdIssue);
    const stateName = await resolveStateName(createdIssue);

    return {
      id: createdIssue.id,
      identifier: createdIssue.identifier,
      title: createdIssue.title,
      description: createdIssue.description || '',
      status: stateName,
      priority: createdIssue.priority || 0,
      labels: issueLabels,
    };
  } catch (err) {
    console.error('Linear create issue error:', err);
    throw err;
  }
}

export async function updateLinearIssue(
  issueId: string,
  status?: string,
  description?: string
): Promise<LinearIssue> {
  try {
    const updateData: any = {};

    if (description !== undefined) {
      updateData.description = description;
    }

    if (status) {
      const team = await linearClient.team(FLO_TEAM_ID);
      const stateConnection = await team.states();
      const targetState = stateConnection.nodes.find(
        (s: any) => s.name.toLowerCase() === status.toLowerCase()
      );
      if (targetState) {
        updateData.stateId = targetState.id;
      }
    }

    await linearClient.issueUpdate(issueId, updateData);

    const refreshedIssue = await linearClient.issue(issueId);
    const issueLabels = await resolveLabels(refreshedIssue);
    const stateName = await resolveStateName(refreshedIssue);

    return {
      id: refreshedIssue.id,
      identifier: refreshedIssue.identifier,
      title: refreshedIssue.title,
      description: refreshedIssue.description || '',
      status: stateName,
      priority: refreshedIssue.priority || 0,
      labels: issueLabels,
    };
  } catch (err) {
    console.error('Linear update issue error:', err);
    throw err;
  }
}
