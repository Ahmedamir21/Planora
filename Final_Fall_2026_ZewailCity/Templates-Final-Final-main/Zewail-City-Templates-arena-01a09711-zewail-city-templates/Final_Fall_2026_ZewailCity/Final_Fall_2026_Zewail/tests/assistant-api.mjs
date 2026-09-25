import assert from 'node:assert/strict';
import handler from '../../../../../../app/api/assistant';
process.env.GEMINI_API_KEY = 'test-only';
let seq = 0;
const selected = { courseId: 'csai201', code: 'CSAI 201', meetings: [{type:'Lecture',section:'01',meetingId:'csai-01'}] };
const base = {selectedCourses:[selected],selectedCourseIds:['csai201'],availableCourses:[
 {courseId:'csai201',code:'CSAI 201',sections:[{type:'Lecture',section:'04',meetingId:'csai-04',day:'Tue',time:'12–2',room:'G033B',instructor:'Example'}]},
 {courseId:'csai202',code:'CSAI 202',sections:[{type:'Lecture',section:'04',meetingId:'csai202-04'}]}
]};
async function run(name,message,context,expect,{modelResponse}={}){
 let providerCalls=0;
 globalThis.fetch=async()=>{providerCalls++;return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(modelResponse)}]}}]})}};
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}};
 await handler({method:'POST',headers:{'x-forwarded-for':`regression-${++seq}`},body:{message,context}},res);
 assert.equal(res.statusCode,200,name);expect(res.body,providerCalls);console.log('PASS',name);
}
await run('exact CSAI course wins over subject ambiguity','Change CSAI 201 change lec 1 to lec 4',base,(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal.changes[0].meetingId,'csai-04')});
await run('course ticked without any section','Change CSAI 201 change lec 1 to lec 4',{...base,selectedCourses:[]},(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal,null);assert.match(b.text,/no Lecture section/) });
await run('course not selected','Change CSAI 201 change lec 1 to lec 4',{...base,selectedCourses:[],selectedCourseIds:[]},(b,calls)=>{assert.equal(calls,0);assert.match(b.text,/not selected/)});
await run('different current section','Change CSAI 201 change lec 2 to lec 4',base,(b,calls)=>{assert.equal(calls,0);assert.equal(b.proposal,null);assert.match(b.text,/not currently selected/)});
await run('model claims a missing preview','Can you change this section?',{},(b,calls)=>{assert.equal(calls,1);assert.equal(b.proposal,null);assert.match(b.text,/could not create a valid preview/)},{modelResponse:{text:'Here is the preview to change CSAI 201 Lecture from Section 01 to Section 04.',proposal:null,constraintsAdd:[],lockActions:[]}});
