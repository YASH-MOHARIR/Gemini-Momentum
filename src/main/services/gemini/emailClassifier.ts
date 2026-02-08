import { getClient, MODELS } from './client'
import { EmailDetail } from '../gmail'

export interface EmailAction {
  type: 'log_to_excel' | 'log_to_sheet' | 'notify' | 'mark_read' | 'archive' | 'star' | 'delete'
  filename?: string // For log_to_excel
  sheetName?: string // For log_to_sheet (Spreadsheet Title)
  tabName?: string   // For log_to_sheet (Worksheet Name)
  data?: any // For log_to_excel/sheet (extracted fields)
  reason?: string
}

export interface EvaluationResult {
  category: 'job' | 'receipt' | 'important' | 'spam' | 'other'
  confidence: number
  actions: EmailAction[]
  matchedRule?: string
}

export async function evaluateEmail(
  email: EmailDetail,
  userRules: string[] = []
): Promise<EvaluationResult> {
  try {
    const client = getClient()
    const model = client.getGenerativeModel({
      model: MODELS.FLASH, // Flash is fast and good for this
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })

    const rulesText =
      userRules.length > 0
        ? `USER RULES:\n${userRules.map((r) => `- ${r}`).join('\n')}`
        : 'USER RULES: None (Use default categorization)'

    const prompt = `You are an intelligent email automation agent.
Analyze the email below and determine the best course of action based on the User Rules.

CATEGORIES:
- job: Job applications, interview requests, recruiter emails
- receipt: Order confirmations, invoices, receipts, payment notifications
- important: Urgent requests, personal emails from known contacts
- spam: Marketing, newsletters, unsolicited offers
- other: Anything else

ACTIONS:
- log_to_excel: If a rule says to "log", "save", or "track" data to an Excel file.
    * REQUIREMENT: You MUST extract relevant data (Date, Vendor, Amount, Currency, Items) into the 'data' field.
    * REQUIREMENT: You MUST specify the 'filename' from the rule (e.g. "expenses.xlsx"). If no filename is specified, use "momentum_email_log.xlsx".
- log_to_sheet: If a rule says to "log", "save", or "track" data to a Google Sheet.
    * REQUIREMENT: You MUST extract relevant data into the 'data' field.
    * REQUIREMENT: You MUST specify the 'sheetName' (Spreadsheet Title) from the rule. If not specified, use "Momentum Email Log".
    * REQUIREMENT: You MUST specify the 'tabName' if mentioned (default to "Sheet1").
- notify: If important or specified by rule.
- mark_read: If specified by rule.
- archive: If specified by rule.
- star: If specified by rule.
- delete: If specified by rule.

${rulesText}

EMAIL DATA:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Snippet: ${email.snippet}
Body (truncated): ${email.body.substring(0, 1500)}

INSTRUCTIONS:
1. Classify the email.
2. Check if ANY User Rule applies to this email.
3. If a rule matches, generate the corresponding actions.
4. If "log_to_excel" is triggered, EXTRACT the structured data immediately.
5. Return JSON.

JSON FORMAT:
{
  "category": "string",
  "confidence": number,
  "matched_rule": "The exact user rule text that was triggered (if any), otherwise null",
  "actions": [
    {
      "type": "log_to_excel",
      "filename": "expenses.xlsx",
      "data": { "date": "YYYY-MM-DD", "vendor": "...", "amount": 123.45, "currency": "USD", "items": "..." }
    },
    { "type": "notify", "reason": "Important receipt" }
  ]
}
`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    try {
      const json = JSON.parse(responseText)
      return {
        category: json.category || 'other',
        confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
        actions: Array.isArray(json.actions) ? json.actions : [],
        matchedRule: json.matched_rule
      }
    } catch (e) {
      console.error('[EMAIL EVALUATOR] Failed to parse JSON:', responseText)
      return { category: 'other', confidence: 0.0, actions: [] }
    }
  } catch (error) {
    console.error('[EMAIL EVALUATOR] Error:', error)
    return { category: 'other', confidence: 0.0, actions: [] }
  }
}
