import { v5 as uuidv5 } from "uuid";

/**
 * Namespace fixe pour dériver un UUID stable à partir d'une adresse wallet.
 * Le même wallet => toujours le même profiles.id => auth.uid() cohérent.
 * Doit être un UUID RFC 4122 valide (uuid v5 le parse strictement).
 * Valeur constante : ne pas modifier après mise en prod (changerait tous les ids).
 */
const VOIDX_NAMESPACE = "d87466f6-5626-422c-9b98-ff2e98fa69cc";

export function walletToUserId(walletAddress: string): string {
  return uuidv5(walletAddress.trim(), VOIDX_NAMESPACE);
}
