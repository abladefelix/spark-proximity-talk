let permissionPromptQueue: Promise<void> = Promise.resolve();

/**
 * Android rejects a second runtime-permission request while another system
 * permission sheet is open. Keep native prompts strictly sequential.
 */
export function runNativePermissionPrompt<T>(prompt: () => Promise<T>): Promise<T> {
  const result = permissionPromptQueue.then(prompt, prompt);
  permissionPromptQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}