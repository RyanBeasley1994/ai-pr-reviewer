import type {Bot} from './bot'
import type {Inputs} from './inputs'
import type {Options} from './options'

export interface BugReport {
  description: string
  confidence: number // 0-100
  severity: 'low' | 'medium' | 'high' | 'critical'
  suggestedFix: string
  filePath: string
  lineStart: number
  lineEnd: number
}

export async function detectBugs(
  bot: Bot,
  inputs: Inputs,
  options: Options,
  filePath: string,
  fileContent: string,
  patch: string
): Promise<BugReport[]> {
  const bugDetectionPrompt = `You are a highly skilled code reviewer focused on detecting potential bugs and issues. Analyze the following code changes and identify any potential bugs, security issues, or problematic patterns.

For each issue found, provide:
1. A clear description of the bug/issue
2. A confidence score (0-100) based on how certain you are this is a real issue
3. Severity level (low/medium/high/critical)
4. A specific suggestion for how to fix it

Focus on:
- Logic errors
- Race conditions
- Memory leaks
- Security vulnerabilities
- Performance issues
- Error handling issues
- Edge cases
- API misuse
- Common programming mistakes

Code to analyze:
File: ${filePath}

Diff:
${patch}

Full context:
${fileContent}

Format your response as a JSON array of bug reports, each containing:
{
  "description": "Bug description",
  "confidence": 90,
  "severity": "high",
  "suggestedFix": "Code fix suggestion",
  "lineStart": 123,
  "lineEnd": 125
}
`

  const [response] = await bot.chat(bugDetectionPrompt, {})

  try {
    const bugReports = JSON.parse(response) as BugReport[]
    return bugReports.map(report => ({
      ...report,
      filePath
    }))
  } catch (e) {
    return []
  }
}
