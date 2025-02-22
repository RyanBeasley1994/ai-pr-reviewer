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

Respond with a JSON object in this exact format:
{
  "analysis": "Your detailed analysis of the code and explanation of any issues found",
  "bugReports": [
    {
      "description": "Detailed explanation of why this could cause problems",
      "confidence": <number 0-100>,
      "severity": "low" | "medium" | "high" | "critical",
      "suggestedFix": "The exact code that should replace the problematic lines, with proper indentation preserved",
      "lineStart": <line number>,
      "lineEnd": <line number>
    }
  ]
}

Important:
- Focus on actual bugs that will cause runtime issues or incorrect behavior
- For each bug, provide the exact code that should replace the problematic lines
- Preserve the exact indentation and code style when suggesting fixes
- The fix should only include the specific lines that need to change
- Do not include natural language instructions in the suggestedFix (no "Change X to Y" or "Remove Z")
- If no bugs are found, provide your analysis explaining why and return an empty bugReports array

IMPORTANT: Return ONLY valid JSON. No other text, no markdown, no code blocks.`

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

      // Extract the text content from various response formats
      let textToProcess = response
      if (typeof response === 'object' && response !== null) {
        interface MessageResponse {
          message?: { content?: string }
          text?: string
          detail?: { choices?: Array<{ message?: { content?: string } }> }
        }

        const typedResponse = response as MessageResponse
        if (typedResponse.message?.content) {
          textToProcess = typedResponse.message.content
        } else if (typedResponse.text) {
          textToProcess = typedResponse.text
        } else if (typedResponse.detail?.choices?.[0]?.message?.content) {
          textToProcess = typedResponse.detail.choices[0].message.content
        } else {
          console.error('Unexpected response format:', response)
          return []
        }
      }

      // Strip any markdown code block syntax before parsing
      textToProcess = textToProcess.trim()
        .replace(/^```(?:json)?\n/, '') // Remove opening code block
        .replace(/\n```$/, '')          // Remove closing code block
        .trim()

      // Parse the response as JSON
      const parsedResponse = JSON.parse(textToProcess)
      
      // Log the analysis for debugging
      console.debug('Analysis:', parsedResponse.analysis)

      // Return the bug reports
      const bugReports = parsedResponse.bugReports || []
      
      // Validate each report has required fields and proper code formatting
      const validReports = bugReports.filter((report: BugReport) => {
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

      return validReports.map((report: BugReport) => ({
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
