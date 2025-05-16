import { PasskeyKit } from "passkey-kit";
import {
    PUBLIC_STELLAR_RPC_URL,
    PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    PUBLIC_FACTORY_CONTRACT_ADDRESS,
} from "$env/static/public";

export const account = new PasskeyKit({
    rpcUlr: PUBLIC_STELLAR_RPC_URL,
    networkPassphrase: PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    factoryContractId: PUBLIC_FACTORY_CONTRACT_ADDRESS,
});