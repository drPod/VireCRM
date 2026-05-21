/**
 * Single source of truth for the "ask your AI assistant to finish the OAuth
 * handshake" prompt. The string is read both during the initial enable flow
 * (auto-copied to the clipboard) and inside the AwaitingAuthHelper card on
 * pending connectors.
 */
export function buildConnectorConnectPrompt(args: {
  connectorId: string;
  providerLabel: string;
}): string {
  return `Please connect the "${args.connectorId}" connector to this project so I can use ${args.providerLabel}. Use the standard_connectors connect tool with connector_id "${args.connectorId}", then confirm when it's linked.`;
}
