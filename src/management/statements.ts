import type { Customer } from '../model';
import { money } from '../model';
export function statementText(customer:Customer,store:string){return `Hola ${customer.name}, te compartimos tu saldo en ${store}: ${money(customer.balance)}. Gracias por tu confianza.`;}
// Clipboard only: preparing a statement never sends a message to a customer.
export async function copyStatement(customer:Customer,store:string){await navigator.clipboard.writeText(statementText(customer,store));}
