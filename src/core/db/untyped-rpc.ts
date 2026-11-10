// Call newly introduced SQL functions without editing generated database types.
type RpcError = { code?: string; message: string };
type RpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RpcError | null }>;
};

export async function invokeUntypedRpc<T>(
  client: unknown,
  functionName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await (client as RpcClient).rpc(functionName, args);
  if (error) {
    throw new Error(`Database operation ${functionName} failed.`, {
      cause: error,
    });
  }
  return data as T;
}
