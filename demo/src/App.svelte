<script lang="ts">
	import base64url from "base64url";
	import { Buffer } from "buffer";
	import {
		account,
		fundPubkey,
		fundSigner,
		native,
		server,
	} from "./lib/common";
	import { Keypair } from "@stellar/stellar-sdk/minimal";
    import { SignerStore, SignerKey, type SignerLimits, type Signer } from "passkey-kit";

	// TODO need to support two toggles:
	// - between temp and persistent
	// - and admin, basic and policy
	// - full visual support for admin, basic and policy keys

	const ADMIN_KEY = "AAAAEAAAAAEAAAABAAAAAQ=="; // TODO very rough until we're actually parsing the limits object
	const NATIVE_SAC =
		"CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
	const SAMPLE_POLICY =
		"CBJQC7FVOAJTBMOOSRUTAED3JVHGNHPKSKPXSREOWFHL7O6LW2ATQZAU";
	const SECRET = "SBEIDWQVWNLPCP35EYQ6GLWKFQ2MDY7APRLOQ3AJNU6KSE7FXGA7C55W";
	const PUBLIC = "GBVQMKYWGELU6IKLK2U6EIIHTNW5LIUYJE7FUQPG4FAB3QQ3KAINFVYS";

	let keyId: string;
	let contractId: string;
	let adminSigner: string | undefined;
	let balance: string;
	let signers: Signer[] = [];

	let keyName: string = "";
	// let keyAdmin: boolean = false;

	let customWalletAddress = '';
	let customError = '';
	let customLoading = false;
	let customBalance = '';
	let showDashboard = false;

	if (localStorage.hasOwnProperty("sp:keyId")) {
		keyId = localStorage.getItem("sp:keyId")!;
		connect(keyId);
	}

	async function customRegisterPasskey() {
		customError = '';
		customLoading = true;
		try {
			const user = prompt("Give this passkey a name");
			if (!user) {
				customLoading = false;
				return;
			}
			const { keyId, contractId, signedTx } = await account.createWallet("Custom Demo", user);
			await server.send(signedTx);
			customWalletAddress = contractId;
			await fetchCustomBalance();
			showDashboard = true;
		} catch (e) {
			customError = e instanceof Error ? e.message : String(e);
		} finally {
			customLoading = false;
		}
	}

	async function customSignInPasskey() {
		customError = '';
		customLoading = true;
		try {
			// No prompt for passkey name, just call connectWallet
			const { keyId, contractId } = await account.connectWallet({
				getContractId: (keyId) => server.getContractId({ keyId }),
			});
			customWalletAddress = contractId;
			await fetchCustomBalance();
			showDashboard = true;
		} catch (e) {
			customError = e instanceof Error ? e.message : String(e);
		} finally {
			customLoading = false;
		}
	}

	async function fetchCustomBalance() {
		if (!customWalletAddress) return;
		try {
			const { result } = await native.balance({ id: customWalletAddress });
			customBalance = (Number(result) / 10_000_000).toFixed(7) + ' XLM';
		} catch (e) {
			customBalance = 'Error fetching balance';
		}
	}

	function signOut() {
		customWalletAddress = '';
		customBalance = '';
		customError = '';
		showDashboard = false;
	}

	async function register() {
		const user = prompt("Give this passkey a name");

		if (!user) return;

		try {
			const {
				keyId: kid,
				contractId: cid,
				signedTx,
			} = await account.createWallet("Super Peach", user);
			
			const res = await server.send(signedTx);

			console.log(res);

			keyId = base64url(kid);
			localStorage.setItem("sp:keyId", keyId);

			contractId = cid;
			console.log("register", cid);

			await getWalletSigners();
			await fundWallet();
		} catch (err: any) {
			console.error(err);
			alert(err.message);
		}
	}
	async function connect(keyId_?: string) {
		try {
			const { keyId: kid, contractId: cid } = await account.connectWallet(
				{
					keyId: keyId_,
					getContractId: (keyId) => server.getContractId({ keyId }),
				},
			);

			keyId = base64url(kid);
			localStorage.setItem("sp:keyId", keyId);

			contractId = cid;
			console.log("connect", cid);

			await getWalletBalance();
			await getWalletSigners();
		} catch (err: any) {
			console.error(err);
			// alert(err.message)
		}
	}
	async function reset() {
		localStorage.removeItem("sp:keyId");
		location.reload();
	}

	async function addSigner(publicKey?: string) {
		try {
			let id: Buffer;
			let pk: Buffer;

			if (publicKey && keyId) {
				id = base64url.toBuffer(keyId);
				pk = base64url.toBuffer(publicKey);
				// keyAdmin = false;
			} else {
				if (!keyName) return;

				const { keyId: kid, publicKey } = await account.createKey(
					"Super Peach",
					keyName,
				);

				id = kid;
				pk = publicKey;
			}

			const { sequence } = await account.rpc.getLatestLedger()
			const at = await account.addSecp256r1(id, pk, undefined, SignerStore.Temporary, sequence + 518_400);

			await account.sign(at, { keyId: adminSigner });
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletSigners();

			keyName = "";
			// keyAdmin = false;
		} catch (err: any) {
			console.error(err);
			alert(err.message);
		}
	}
	async function addEd25519Signer() {
		const pubkey = PUBLIC; // prompt('Enter public key');

		if (pubkey) {
			const signer_limits = undefined;

			// const signer_limits: SignerLimits = new Map();
			// const signer_keys: SignerKey[] = [];

			// signer_keys.push(SignerKey.Policy(SAMPLE_POLICY));

			// signer_limits.set(NATIVE_SAC, signer_keys);

			const at = await account.addEd25519(pubkey, signer_limits, SignerStore.Temporary);

			await account.sign(at, { keyId: adminSigner });
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletSigners();
		}
	}
	async function addPolicySigner() {
		const signer_limits: SignerLimits = new Map();
		const signer_keys: SignerKey[] = [];

		signer_keys.push(SignerKey.Ed25519(PUBLIC));

		signer_limits.set(NATIVE_SAC, signer_keys);

		const at = await account.addPolicy(SAMPLE_POLICY, signer_limits, SignerStore.Temporary);

		await account.sign(at, { keyId: adminSigner });
		const res = await server.send(at.built!);

		console.log(res);

		await getWalletSigners();
	}
	async function removeSigner(signer: string, type: string) {
		try {
			let key: SignerKey;

			switch (type) {
				case "Policy":
					key = SignerKey.Policy(signer);
					break;
				case "Ed25519":
					key = SignerKey.Ed25519(signer);
					break;
				case "Secp256r1":
					key = SignerKey.Secp256r1(signer);
					break;
				default:
					throw new Error("Invalid signer type");
			}

			const at = await account.remove(key);

			await account.sign(at, { keyId: adminSigner });
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletSigners();
		} catch (err: any) {
			console.error(err);
			alert(err.message);
		}
	}
	async function fundWallet() {
		const { built, ...transfer } = await native.transfer({
			to: contractId,
			from: fundPubkey,
			amount: BigInt(100 * 10_000_000),
		});

		await transfer.signAuthEntries({
			address: fundPubkey,
			signAuthEntry: fundSigner.signAuthEntry,
		});

		const res = await server.send(built!);

		console.log(res);

		await getWalletBalance();
	}

	////
	async function multisigTransfer() {
		const keypair = Keypair.fromSecret(SECRET);

		const at = await native.transfer({
			to: fundPubkey,
			from: contractId,
			amount: BigInt(10_000_000),
		});

		await account.sign(at, { keyId: adminSigner });
		await account.sign(at, { keypair });
		await account.sign(at, { policy: SAMPLE_POLICY });

		console.log(at.built!.toXDR());

		const res = await server.send(at);

		console.log(res);

		await getWalletBalance();
	}
	////

	async function ed25519Transfer() {
		const secret = SECRET; // prompt('Enter secret key');

		if (secret) {
			const keypair = Keypair.fromSecret(secret);
			const at = await native.transfer({
				to: fundPubkey,
				from: contractId,
				amount: BigInt(10_000_000),
			});

			await account.sign(at, { keypair });

			// NOTE won't work if the ed25519 signer has a policy signer_key restriction
			// If you want this to work you need to remove the policy restriction from the ed25519 signer first
			// (though that will make the policy transfer less interesting)
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletBalance();
		}
	}

	////
	async function policyTransfer() {
		const keypair = Keypair.fromSecret(SECRET);

		let at = await native.transfer({
			to: fundPubkey,
			from: contractId,
			amount: BigInt(10_000_000),
		});

		await account.sign(at, { keypair });
		await account.sign(at, { policy: SAMPLE_POLICY });

		console.log(at.built!.toXDR());

		const res = await server.send(at.built!);

		console.log(res);

		await getWalletBalance();
	}
	////

	async function walletTransfer(signer: string, kind: string) {
		if (kind === "Policy") {
			return policyTransfer();
		} else if (kind === "Ed25519") {
			return ed25519Transfer();
		}

		const at = await native.transfer({
			to: fundPubkey,
			from: contractId,
			amount: BigInt(10_000_000),
		});

		await account.sign(at, { keyId: signer });
		const res = await server.send(at.built!);

		console.log(res);

		await getWalletBalance();
	}
	async function getWalletBalance() {
		const { result } = await native.balance({ id: contractId });

		balance = result.toString();
		console.log(balance);
	}
	async function getWalletSigners() {
		signers = await server.getSigners(contractId);
		console.log(signers);

		const adminKeys = signers.filter(({ limits }) => limits === ADMIN_KEY);

		adminSigner = (
			adminKeys.find(({ key }) => keyId === key) || adminKeys[0]
		).key;
	}

	async function customAddFunds() {
		if (!customWalletAddress) return;
		try {
			customLoading = true;
			const { built, ...transfer } = await native.transfer({
				to: customWalletAddress,
				from: fundPubkey,
				amount: BigInt(100 * 10_000_000),
			});
			await transfer.signAuthEntries({
				address: fundPubkey,
				signAuthEntry: fundSigner.signAuthEntry,
			});
			await server.send(built!);
			await fetchCustomBalance();
		} catch (e) {
			customError = e instanceof Error ? e.message : String(e);
		} finally {
			customLoading = false;
		}
	}
</script>

<!-- Custom Stellar Passkey Demo UI and Dashboard -->
{#if !showDashboard}
  <div class="custom-demo-card" style="max-width: 480px; margin: 2rem auto; background: #23262F; border-radius: 1rem; box-shadow: 0 2px 16px #0004; padding: 2rem;">
    <h2 style="color: #fff; font-size: 2rem; font-weight: bold; margin-bottom: 1rem; display: flex; align-items: center;">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="margin-right: 0.5rem;"><circle cx="16" cy="16" r="16" fill="#5C6DF7"/><path d="M10 16.5L15 21.5L22 10.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Stellar Passkey Demo
    </h2>
    <p style="color: #bbb; margin-bottom: 1.5rem;">Register or sign in to a Stellar wallet using a passkey (WebAuthn). This uses the real passkey-kit SDK and works just like the official demo.</p>
    <button on:click={customRegisterPasskey} disabled={customLoading} style="font-size: 1.1rem; padding: 0.75rem 2rem; border-radius: 0.5rem; background: #5C6DF7; color: #fff; border: none; cursor: pointer; font-weight: 600; margin-right: 1em;">
      {customLoading ? 'Processing...' : 'Register Stellar Passkey Wallet'}
    </button>
    <button on:click={customSignInPasskey} disabled={customLoading} style="font-size: 1.1rem; padding: 0.75rem 2rem; border-radius: 0.5rem; background: #2326F7; color: #fff; border: none; cursor: pointer; font-weight: 600;">
      {customLoading ? 'Processing...' : 'Sign In with Passkey'}
    </button>
    {#if customWalletAddress}
      <div style="margin-top: 1.5rem; color: #7fff7f; font-size: 1.1rem;">
        Wallet Contract ID: <code style="color: #fff; background: #181A20; padding: 0.2em 0.5em; border-radius: 0.3em;">{customWalletAddress}</code>
      </div>
    {/if}
    {#if customError}
      <div style="margin-top: 1.5rem; color: #ff7f7f; font-size: 1.1rem;">{customError}</div>
    {/if}
  </div>
{/if}

{#if showDashboard}
  <div style="min-height: 100vh; background: #181A20; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 2rem 0;">
    <div style="width: 100%; max-width: 1100px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h1 style="color: #fff; font-size: 2.2rem; font-weight: bold; letter-spacing: -1px;">Stellar Smart Wallet</h1>
        <button on:click={signOut} style="font-size: 1.1rem; padding: 0.5rem 2rem; border-radius: 0.5rem; background: #ff5c5c; color: #fff; border: none; cursor: pointer; font-weight: 600;">Sign Out</button>
      </div>
      <!-- Tax Summary -->
      <div style="display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 220px; background: #23262F; border-radius: 1rem; padding: 1.5rem;">
          <div style="color: #bbb; font-size: 1.1rem;">Total Realized P/L</div>
          <div style="color: #7fff7f; font-size: 2rem; font-weight: bold;">$900.00</div>
        </div>
        <div style="flex: 1; min-width: 220px; background: #23262F; border-radius: 1rem; padding: 1.5rem;">
          <div style="color: #bbb; font-size: 1.1rem;">Taxable Events</div>
          <div style="color: #fff; font-size: 2rem; font-weight: bold;">2</div>
        </div>
        <div style="flex: 1; min-width: 220px; background: #23262F; border-radius: 1rem; padding: 1.5rem;">
          <div style="color: #bbb; font-size: 1.1rem;">Est. Tax Liability</div>
          <div style="color: #ff7f7f; font-size: 2rem; font-weight: bold;">$270.00</div>
          <div style="color: #bbb; font-size: 0.95rem;">at 30% rate</div>
        </div>
        <div style="flex: 1; min-width: 220px; background: #23262F; border-radius: 1rem; padding: 1.5rem;">
          <div style="color: #bbb; font-size: 1.1rem;">Short vs Long Term</div>
          <div><span style="color: #ff7f7f;">Short: -$100.00</span> <span style="color: #7fff7f; margin-left: 1em;">Long: $1,000.00</span></div>
        </div>
      </div>
      <!-- Holdings & Capital Gains -->
      <div style="display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap;">
        <div style="flex: 2; min-width: 350px; background: #23262F; border-radius: 1rem; padding: 1.5rem;">
          <h2 style="color: #fff; font-size: 1.3rem; font-weight: bold; margin-bottom: 1rem;">Holdings</h2>
          <table style="width: 100%; color: #fff; border-collapse: collapse;">
            <thead>
              <tr style="color: #bbb;">
                <th align="left">Token</th>
                <th align="right">Quantity</th>
                <th align="right">Avg. Cost</th>
                <th align="right">Current Price</th>
                <th align="right">Market Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>XLM</td>
                <td align="right">{customBalance.split(' ')[0]}</td>
                <td align="right">$0.42</td>
                <td align="right">$0.45</td>
                <td align="right">${(parseFloat(customBalance.split(' ')[0]) * 0.45).toFixed(2)}</td>
              </tr>
              <tr>
                <td>BTC</td>
                <td align="right">0.25</td>
                <td align="right">$38,000.00</td>
                <td align="right">$42,000.00</td>
                <td align="right">$10,500.00</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="flex: 1; min-width: 300px; background: #23262F; border-radius: 1rem; padding: 1.5rem;">
          <h2 style="color: #fff; font-size: 1.3rem; font-weight: bold; margin-bottom: 1rem;">Capital Gains</h2>
          <table style="width: 100%; color: #fff; border-collapse: collapse;">
            <thead>
              <tr style="color: #bbb;">
                <th align="left">Token</th>
                <th align="right">Realized P/L</th>
                <th align="right">Short Term</th>
                <th align="right">Long Term</th>
                <th align="right">Events</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>BTC</td>
                <td align="right" style="color: #7fff7f;">$1,000.00</td>
                <td align="right">—</td>
                <td align="right" style="color: #7fff7f;">$1,000.00</td>
                <td align="right">2</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Recent Transactions -->
      <div style="background: #23262F; border-radius: 1rem; padding: 1.5rem; margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.3rem; font-weight: bold; margin-bottom: 1rem;">Recent Transactions</h2>
        <table style="width: 100%; color: #fff; border-collapse: collapse;">
          <thead>
            <tr style="color: #bbb;">
              <th align="left">Date</th>
              <th align="left">Token</th>
              <th align="right">Amount</th>
              <th align="right">Type</th>
              <th align="right">P/L</th>
              <th align="right">Last Trade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2025-04-16</td>
              <td>BTC</td>
              <td align="right">0.10</td>
              <td align="right">Sell</td>
              <td align="right" style="color: #7fff7f;">$400.00</td>
              <td align="right">Apr 16, 2025</td>
            </tr>
            <tr>
              <td>2025-03-10</td>
              <td>XLM</td>
              <td align="right">1,000</td>
              <td align="right">Buy</td>
              <td align="right" style="color: #bbb;">—</td>
              <td align="right">Mar 10, 2025</td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Wallet Info -->
      <div style="background: #23262F; border-radius: 1rem; padding: 1.5rem; margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.3rem; font-weight: bold; margin-bottom: 1rem;">Wallet Info</h2>
        <div style="margin-bottom: 1.2rem;">
          <strong>Wallet Contract ID:</strong>
          <div style="word-break: break-all; background: #181A20; padding: 0.5em; border-radius: 0.3em; margin-top: 0.3em;">{customWalletAddress}</div>
        </div>
        <div style="margin-bottom: 1.2rem; display: flex; align-items: center; gap: 1em;">
          <strong>Balance:</strong> {customBalance}
          <button on:click={fetchCustomBalance} style="font-size: 0.95em; padding: 0.3em 1em; border-radius: 0.3em; background: #5C6DF7; color: #fff; border: none; cursor: pointer; font-weight: 500;">Refresh</button>
          <button on:click={customAddFunds} style="font-size: 0.95em; padding: 0.3em 1em; border-radius: 0.3em; background: #7fff7f; color: #181A20; border: none; cursor: pointer; font-weight: 500;">Add Funds</button>
        </div>
      </div>
    </div>
  </div>
{/if}
