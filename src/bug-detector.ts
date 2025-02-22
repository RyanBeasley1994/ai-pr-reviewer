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
  const bugDetectionPrompt = `You are a highly skilled code reviewer focused on detecting potential bugs and issues. Your task is to thoroughly analyze the code for any bugs, issues, or problematic patterns that could cause problems.

Input: Code changes annotated with line numbers and full file context
Task: Review the changes for substantive issues that could cause bugs or runtime problems
Output: Bug reports in JSON format with exact line numbers. For single-line issues, start=end line number.

Code to analyze:
File: ${filePath}

Diff:
\`\`\`diff
${patch}
\`\`\`

Full context:
\`\`\`
${fileContent}
\`\`\`

For each bug found, provide a JSON object with these fields:
{
  "description": "Detailed explanation of the bug and why it's an issue",
  "confidence": <number 0-100>,
  "severity": <"low"|"medium"|"high"|"critical">,
  "suggestedFix": "Specific code fix",
  "lineStart": <line number>,
  "lineEnd": <line number>
}

Important:
- Focus solely on offering specific, objective insights about actual bugs
- Pay special attention to changes in control structures, function calls, or variable assignments that could impact runtime behavior
- When suggesting fixes, be precise and ensure they match the exact lines that need to change
- If no bugs are found, return an empty array []
- Make sure line numbers in the report match the actual file
- For fixes that modify code, use proper indentation and formatting

Analyze the code now and return an array of bug reports in JSON format.`

  try {
    const [response] = await bot.chat(bugDetectionPrompt, {})

    if (!response.trim()) {
      console.warn('Bug detector received empty response from bot')
      return []
    }

    try {
      const bugReports = JSON.parse(response) as BugReport[]
      return bugReports.map(report => ({
        ...report,
        filePath
      }))
    } catch (e) {
      console.error('Failed to parse bug detector response:', e)
      console.error('Raw response:', response)
      return []
    }
  } catch (e) {
    console.error('Error during bug detection:', e)
    return []
  }
}
