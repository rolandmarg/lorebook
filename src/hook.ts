/**
 * Claude Code hook protocol types.
 *
 * Claude Code validates hook JSON output with a Zod schema that requires
 * additionalContext to be nested inside hookSpecificOutput with a matching
 * hookEventName. Outputting {"additionalContext": "..."} at the top level
 * passes validation (hookSpecificOutput is optional) but the context is
 * silently dropped — the extraction code only reads from hookSpecificOutput.
 */

/** JSON sent to UserPromptSubmit hooks via stdin. */
export interface HookInput {
  session_id: string;
  prompt: string;
  cwd: string;
  hook_event_name: string;
  transcript_path?: string;
  permission_mode?: string;
}

/** Valid JSON response for a UserPromptSubmit hook. */
export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit';
    additionalContext: string;
  };
}
