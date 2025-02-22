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

Input: Code changes and their context
Task: Review for bugs, including:
1. Issues in the changed code itself
2. Problems with how the changed code interacts with existing code
3. Issues with function calls, even if the function definition isn't visible
4. Potential runtime issues based on how the code is used

Code to analyze:
File: ${filePath}

Changes made (diff):
\`\`\`diff
${patch}
\`\`\`

Full file context:
\`\`\`
${fileContent}
\`\`\`

For each potential issue found, provide a JSON object with:
{
  "description": "Detailed explanation of why this could cause problems",
  "confidence": <number 0-100>,
  "severity": <"low"|"medium"|"high"|"critical">,
  "suggestedFix": "Specific code fix",
  "lineStart": <line number>,
  "lineEnd": <line number>
}

Important:
- Analyze both the changes themselves AND how they're used in the broader context
- Consider function calls carefully - they may have bugs even if you can't see the function definition
- Look for potential runtime issues, type mismatches, and logical errors
- If you see a function being called, consider common bugs that could exist in its implementation
- If no bugs are found, return an empty array []

IMPORTANT: Return ONLY a JSON array. Do not include any other text, markdown, or formatting.

Analyze the code now and return an array of bug reports in JSON format.`

  try {
    // Clean up the patch to ensure it's in a standard format
    const cleanedPatch = patch
      .replace(/---new_hunk---\n/g, '')
      .replace(/---old_hunk---\n/g, '')
      .trim()

    const [response] = await bot.chat(bugDetectionPrompt, {})

    if (!response || !response.trim()) {
      console.warn('Bug detector received empty response')
      return []
    }

    try {
      // Log the raw response for debugging
      console.debug('Raw bot response:', response)

      // If response is an object with a message property (API response format)
      let textToProcess = response
      if (typeof response === 'object' && response !== null) {
        interface MessageResponse {
          message?: {
            content?: string
          }
          text?: string
        }

        const typedResponse = response as MessageResponse
        if (typedResponse.message?.content) {
          textToProcess = typedResponse.message.content
          console.debug('Extracted content from message:', textToProcess)
        } else if (typedResponse.text) {
          textToProcess = typedResponse.text
          console.debug('Extracted text from response:', textToProcess)
        } else {
          console.error('Unexpected response format:', response)
          return []
        }
      }

      // Clean up the response by removing any markdown code block formatting
      const cleanedResponse = String(textToProcess)
        .replace(/^```json\s*/g, '') // Remove opening ```json with any whitespace
        .replace(/^```\s*/g, '') // Remove opening ``` with any whitespace
        .replace(/\s*```$/g, '') // Remove closing ``` with any whitespace
        .replace(/^\s*\[\s*\]\s*$/, '[]') // Clean up empty array formatting
        .trim()

      console.debug('Cleaned response:', cleanedResponse)

      // Handle empty array case
      if (cleanedResponse === '[]') {
        console.debug('No bugs found in the code')
        return []
      }

      const bugReports = JSON.parse(cleanedResponse) as BugReport[]

      // Validate the parsed reports
      if (!Array.isArray(bugReports)) {
        console.error('Bug detector response is not an array:', cleanedResponse)
        return []
      }

      // Validate each report has required fields
      const validReports = bugReports.filter(report => {
        const isValid =
          typeof report.description === 'string' &&
          typeof report.confidence === 'number' &&
          report.confidence >= 0 &&
          report.confidence <= 100 &&
          ['low', 'medium', 'high', 'critical'].includes(report.severity) &&
          typeof report.suggestedFix === 'string' &&
          typeof report.lineStart === 'number' &&
          typeof report.lineEnd === 'number' &&
          report.lineStart <= report.lineEnd

        if (!isValid) {
          console.warn('Invalid bug report:', report)
        }
        return isValid
      })

      return validReports.map(report => ({
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
