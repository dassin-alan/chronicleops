export const natural = (a:string,b:string) => a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" });
export const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T;
export const checksum = (value:unknown) => { const text = JSON.stringify(value); let h=2166136261; for(let i=0;i<text.length;i++) h=Math.imul(h^text.charCodeAt(i),16777619); return (h>>>0).toString(16); };
export const id = (prefix:string, n:number) => `${prefix}-${n}`;
