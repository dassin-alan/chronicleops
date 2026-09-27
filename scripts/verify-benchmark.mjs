import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const evidence="EVIDENCE";mkdirSync(evidence,{recursive:true});
const checks=[['audit',['npm','audit']],['typecheck',['npm','run','typecheck']],['unit-tests',['npm','test']],['build',['npm','run','build']],['playwright',['npm','run','test:e2e']]];
const results={};let failed=false;for(const [name,cmd] of checks){const result=spawnSync(cmd[0],cmd.slice(1),{encoding:'utf8',shell:process.platform==='win32'});writeFileSync(`${evidence}/${name}.log`,`${result.stdout}\n${result.stderr}`);results[name]={exitCode:result.status,passed:result.status===0};if(result.status!==0)failed=true;}
for(const file of ['README.md','ARCHITECTURE.md','IMPLEMENTATION_PLAN.md','FINAL_REPORT.md','BENCHMARK_MANIFEST.json'])if(!existsSync(file)){results[file]={exitCode:1,passed:false};failed=true;}
writeFileSync(`${evidence}/verification-summary.json`,JSON.stringify({generatedAt:new Date().toISOString(),results},null,2));if(failed)process.exitCode=1;
