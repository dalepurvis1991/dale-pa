import { LinearClient } from '@linear/sdk';

const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY || '',
});

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  labels?: string[];
}

export async function listLinearIssues(
  status?: string,
  sprint?: string,
  priority?: string
): Promise<LinearIssue[]> {
  try {
    const team = await linearClient.teams.findOne('Floor Giants');

    if (!team) {
      throw new Error('Floor Giants team not found');
    }

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

    const issues = await linearClient.issues(filters);
    const result: LinearIssue[] = [];

    for (const issue of issues) {
      const labels = (await issue.labels()).nodes.map((l) => l.name);
      result.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || '',
        status: issue.state?.name || 'unknown',
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
    const team = await linearClient.teams.findOne('Floor Giants');

    if (!team) {
      throw new Error('Floor Giants team not found');
    }

    const priorityMap: { [key: string]: number } = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const createInput = {
      teamId: team.id,
      title,
      description,
      priority: priorityMap[priority] || 3,
    };

    const issue = await linearClient.issues.create(createInput);

    if (labels && labels.length > 0) {
      for (const labelName of labels) {
        const existingLabels = await linearClient.issueLabels({ filter: { name: { eq: labelName } } });
        if (existingLabels.nodes.length > 0) {
          await issue.addLabel(existingLabels.nodes[0].id);
        }
      }
    }

    const issueLabels = (await issue.labels()).nodes.map((l) => l.name);

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      status: issue.state?.name || 'To Do',
      priority: issue.priority || 0,
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
    const issue = await linearClient.issue(issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const updateData: any = {};

    if (description !== undefined) {
      updateData.description = description;
    }

    if (status) {
      const team = await linearClient.teams.findOne('Floor Giants');
      if (team) {
        const workflowStates = await linearClient.workflowStates({ filter: { team: { id: { eq: team.id } } } });
        const targetState = workflowStates.nodes.find(
          (s) => s.name.toLowerCase() === status.toLowerCase()
        );
        if (targetState) {
          updateData.stateId = targetState.id;
        }
      }
    }

    await issue.update(updateData);

    const refreshedIssue = await linearClient.issue(issueId);
    const issueLabels = (await refreshedIssue!.labels()).nodes.map((l) => l.name);

    return {
      id: refreshedIssue!.id,
      identifier: refreshedIssue!.identifier,
      title: refreshedIssue!.title,
      description: refreshedIssue!.description || '',
      status: refreshedIssue!.state?.name || 'unknown',
      priority: refreshedIssue!.priority || 0,
      labels: issueLabels,
    };
  } catch (err) {
    console.error('Linear update issue error:', err);
    throw err;
  }
}
