/**
 * Local WebAuthn (Passkeys) integration for offline biometric lock.
 * Since this is an offline-first app without a server, we generate
 * dummy challenges and don't do cryptographic verification of signatures.
 * The goal is simply to trigger the OS-level biometric prompt (Windows Hello,
 * TouchID, FaceID) to unlock the app locally.
 */

// Generate a random 32-byte challenge
function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Convert string to Uint8Array
function strToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to Base64url (for storage if needed)
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Register a local passkey (triggers biometric setup).
 * Returns the credential ID which must be stored locally (e.g. in Dexie).
 */
export async function registerBiometrics(username: string = "FinApp User"): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn (Passkeys) non supporté par ce navigateur.");
  }

  const userId = crypto.getRandomValues(new Uint8Array(16));
  
  const createOptions: PublicKeyCredentialCreationOptions = {
    challenge: generateChallenge() as BufferSource,
    rp: {
      name: "FinApp Local",
      // id: window.location.hostname // Optional, usually inferred
    },
    user: {
      id: userId as BufferSource,
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },   // ES256
      { type: "public-key", alg: -257 }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Force device authenticator (FaceID, TouchID, Windows Hello)
      userVerification: "required",        // Force biometric or PIN
    },
    timeout: 60000,
    attestation: "none",
  };

  const credential = await navigator.credentials.create({
    publicKey: createOptions
  }) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Enregistrement annulé ou échoué.");
  }

  // Return the credential ID (base64url encoded) to store locally
  return bufferToBase64url(credential.rawId);
}

/**
 * Authenticate using a previously registered credential ID.
 * Triggers the biometric prompt.
 */
export async function authenticateBiometrics(credentialIdBase64url: string): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn (Passkeys) non supporté par ce navigateur.");
  }

  // Convert base64url credential ID back to Uint8Array
  // Note: For a strictly local check without a server, we can sometimes just allow any 
  // platform authenticator to verify, but specifying the allowCredentials is more robust.
  const base64 = credentialIdBase64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const decodedStr = atob(base64 + pad);
  const credentialId = new Uint8Array(decodedStr.length);
  for (let i = 0; i < decodedStr.length; ++i) {
    credentialId[i] = decodedStr.charCodeAt(i);
  }

  const getOptions: PublicKeyCredentialRequestOptions = {
    challenge: generateChallenge() as BufferSource,
    allowCredentials: [
      {
        id: credentialId as BufferSource,
        type: "public-key",
      }
    ],
    userVerification: "required", // Require actual biometric/PIN check
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: getOptions
    }) as PublicKeyCredential;

    if (!assertion) {
      return false;
    }

    // If we reach here, the OS biometric check passed!
    return true;
  } catch (error) {
    console.error("Biometric authentication failed", error);
    return false;
  }
}
