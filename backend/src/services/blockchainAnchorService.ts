import {
  JsonRpcProvider,
  Wallet,
  hexlify,
  isHexString,
  toUtf8Bytes,
  type Provider,
} from 'ethers';
import { config } from '../config.js';

export interface AnchorReceipt {
  txHash: string;
  blockNumber?: number;
  network?: string;
  chainId?: number;
}

interface AnchorPayload {
  hash: string;
  recordId?: string;
  timestamp: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class BlockchainAnchorService {
  private readonly enabled: boolean;
  private readonly confirmations: number;
  private readonly targetAddress: string;
  private readonly networkName?: string;
  private provider?: Provider;
  private wallet?: Wallet;

  constructor() {
    const { anchor } = config;
    this.confirmations = anchor.confirmations ?? 1;
    this.targetAddress = anchor.targetAddress || ZERO_ADDRESS;
    this.networkName = anchor.networkName;

    const hasCredentials = Boolean(anchor.rpcUrl && anchor.privateKey);
    this.enabled = anchor.enabled && hasCredentials;

    if (!this.enabled) {
      if (anchor.enabled && !hasCredentials) {
        console.warn(
          '[mini-kms] Blockchain anchoring requested but ANCHOR_RPC_URL or ANCHOR_PRIVATE_KEY is missing. Anchoring will be skipped.'
        );
      }
      return;
    }

    this.provider = new JsonRpcProvider(anchor.rpcUrl, anchor.chainId);
    this.wallet = new Wallet(anchor.privateKey!, this.provider);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Anchor an audit head hash on-chain by submitting a tiny transaction with the hash encoded in the data payload.
   */
  async anchor(hash: string, context?: { recordId?: string }): Promise<AnchorReceipt> {
    if (!this.enabled || !this.wallet) {
      throw new Error('Blockchain anchoring is disabled');
    }

    const normalizedHash = hash.startsWith('0x') ? hash : `0x${hash}`;
    if (!isHexString(normalizedHash, 32)) {
      throw new Error('Audit hash must be a 32-byte hex string');
    }

    const payload: AnchorPayload = {
      hash: normalizedHash,
      recordId: context?.recordId,
      timestamp: new Date().toISOString(),
    };
    const data = hexlify(toUtf8Bytes(JSON.stringify(payload)));

    const destination =
      this.targetAddress && this.targetAddress !== ZERO_ADDRESS
        ? (this.targetAddress as `0x${string}`)
        : (this.wallet.address as `0x${string}`);

    const tx = await this.wallet.sendTransaction({
      to: destination,
      value: 0,
      data,
    });

    const receipt = await tx.wait(this.confirmations);
    const network = await this.wallet.provider!.getNetwork();

    return {
      txHash: receipt?.hash ?? tx.hash,
      blockNumber: receipt?.blockNumber,
      network: this.networkName ?? network?.name,
      chainId: network?.chainId ? Number(network.chainId) : undefined,
    };
  }
}
