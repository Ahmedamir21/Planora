import assert from 'node:assert/strict';
import handler from '../../../../../../app/api/assistant';
process.env.GEMINI_API_KEY = 'test-only';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
let seq = 0;
const selected = { courseId: 'csai201', code: 'CSAI 201', meetings: [{type:'Lecture',section:'01',meetingId:'csai-01'}] };
const base = {selectedCourses:[selected],selectedCourseIds:['csai201'],availableCourses:[
 {courseId:'csai201',code:'CSAI 201',sections:[{type:'Lecture',section:'04',meetingId:'csai-04',day:'Tue',time:'12–2',room:'G033B',instructor:'Example'}]},
 {courseId:'csai202',code:'CSAI 202',sections:[{type:'Lecture',section:'04',meetingId:'csai202-04'}]}
]};
async function run(name,message,context,expect,{modelResponse}={}){
 let providerCalls=0;
 globalThis.fetch=async(url,options)=>{
  if (url === 'https://redis.example.test') return {ok:true,status:200,json:async()=>({result:1})};
  assert(!url.includes('key='), 'Gemini key leaked into URL');
  assert.equal(options.headers['x-goog-api-key'],'test-only','Gemini key missing from private header');
  providerCalls++;
  return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(modelResponse)}]}}]})};
 };
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}};
 await handler({method:'POST',headers:{host:'example.test',origin:'https://example.test','content-type':'application/json','x-vercel-forwarded-for':`198.51.100.${(++seq % 250) + 1}`},body:{message,context}},res);
 assert.equal(res.statusCode,200,name);expect(res.body,providerCalls);console.log('PASS',name);
}
await run('exact CSAI course wins over subject ambiguity','Change CSAI 201 change lec 1 to lec 4',base,(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal.changes[0].meetingId,'csai-04')});
await run('course ticked without any section','Change CSAI 201 change lec 1 to lec 4',{...base,selectedCourses:[]},(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal,null);assert.match(b.text,/no Lecture section/) });
await run('select exact lecture when none was picked','Select CSAI 201 lec 4',{...base,selectedCourses:[]},(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal.changes[0].meetingId,'csai-04');assert.match(b.text,/selection to preview/) });
await run('course not selected','Change CSAI 201 change lec 1 to lec 4',{...base,selectedCourses:[],selectedCourseIds:[]},(b,calls)=>{assert.equal(calls,0);assert.match(b.text,/not selected/)});
await run('different current section','Change CSAI 201 change lec 2 to lec 4',base,(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal,null);assert.match(b.text,/not currently selected/)});
await run('model claims a missing preview','Can you change this section?',{},(b,calls)=>{assert.equal(calls,1);assert.equal(b.proposal,null);assert.match(b.text,/could not create a valid preview/)},{modelResponse:{text:'Here is the preview to change CSAI 201 Lecture from Section 01 to Section 04.',proposal:null,constraintsAdd:[],lockActions:[]}});

const counts = new Map();
let providerCalls = 0;
globalThis.fetch = async (url, options) => {
 if (url === 'https://redis.example.test') {
  const [command, , , key] = JSON.parse(options.body);
  assert.equal(command,'EVAL');
  const n = (counts.get(key) || 0) + 1;
  counts.set(key,n);
  return {ok:true,json:async()=>({result:n})};
 }
 providerCalls++;
 return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({text:'Ready',proposal:null,lockActions:[],constraintsAdd:[]})}]}}]})};
};
async function secured(headers = {}) {
 const response = {statusCode:200,cookie:'',setHeader(name,value){if(name==='Set-Cookie')this.cookie=value},status(code){this.statusCode=code;return this},json(data){this.body=data;return this}};
 await handler({method:'POST',headers:{host:'example.test',origin:'https://example.test','content-type':'application/json','x-vercel-forwarded-for':'203.0.113.7',...headers},body:{message:'Help with my schedule',context:{}}},response);
 return response;
}
assert.equal((await secured({origin:'https://evil.test'})).statusCode,403,'Cross-site assistant request accepted');
assert.equal((await secured({'content-type':'text/plain'})).statusCode,413,'Non-JSON assistant request accepted');
let sessionCookie = '';
for(let i=0;i<12;i++){
 const result=await secured(sessionCookie?{cookie:sessionCookie}:{});
 if(!sessionCookie) {
  sessionCookie=result.cookie.split(';')[0];
  assert.match(result.cookie,/HttpOnly; Secure; SameSite=Strict/,'Assistant cookie is not protected');
 }
 assert.equal(result.statusCode,200,'Valid request was blocked too early');
}
assert.equal((await secured({cookie:sessionCookie})).statusCode,429,'Assistant browser limit was bypassed across requests');
assert.equal(providerCalls,12,'Blocked requests still reached the AI provider');
const ipKey = [...counts.keys()].find(key => key.includes(':assistant-ip:'));
assert(ipKey,'Shared IP limit was not counted');
counts.set(ipKey,900);
assert.equal((await secured()).statusCode,429,'Shared IP ceiling was bypassed');
assert.equal(providerCalls,12,'Shared IP block still reached the AI provider');
counts.set(ipKey,0);
// Dropping the cookie must not reset the limit: cookie-less requests all count against the IP.
counts.clear(); providerCalls = 0;
let blocked = 0;
for (let i = 0; i < 100; i++) if ((await secured()).statusCode === 429) blocked++;
assert.equal(providerCalls,90,'Cookie-less requests got past the per-IP limit');
assert.equal(blocked,10,'Cookie-less requests were not blocked after the per-IP limit');
// A client-supplied X-Forwarded-For must not create a new bucket when Vercel already named the IP.
counts.clear();
await secured({'x-forwarded-for':'1.1.1.1'});
await secured({'x-forwarded-for':'2.2.2.2'});
assert.equal([...counts.keys()].filter(key => key.includes(':assistant-ip:')).length,1,'Spoofed X-Forwarded-For created its own bucket');
// The site-wide ceiling protects the shared AI quota even when every IP is different.
const globalKey = [...counts.keys()].find(key => key.includes(':assistant-global:'));
assert(globalKey,'Global limit was not counted');
counts.set(globalKey,600); providerCalls = 0;
assert.equal((await secured()).statusCode,429,'Global assistant ceiling was bypassed');
assert.equal(providerCalls,0,'Global block still reached the AI provider');
counts.clear();
console.log('PASS protected assistant origin, JSON, private API key and distributed browser limit');

const priorFetch = globalThis.fetch;
const priorError = console.error;
const logged = [];
console.error = (...args) => logged.push(args.join(' '));
globalThis.fetch = async (url, options) => url === 'https://redis.example.test'
 ? priorFetch(url, options)
 : {ok:false,status:400,json:async()=>({error:{message:'secret test-only should not appear in logs'}})};
try {
 const result = await secured();
 assert.equal(result.statusCode,502,'Upstream error did not return a safe response');
 assert(!JSON.stringify(logged).includes('test-only'),'Gemini key appeared in logs');
 assert(!JSON.stringify(result.body).includes('test-only'),'Gemini key appeared in client response');
} finally {
 console.error = priorError;
}
console.log('PASS provider errors do not log or return API secrets');
